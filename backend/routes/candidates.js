import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

import { extractText } from "../services/fileExtractor.js";
import { parseCVWithAI } from "../services/cvParser.js";
import { scoreCandidate } from "../services/scorer.js";
import { generateCandidateInsights } from "../services/languageGenerator.js";
import { computeTraits, applyOceanScores } from "../services/oceanScorer.js";
import { applyInterviewScores } from "../services/interviewScorer.js";
import { applyHrNotes } from "../services/hrNotesScorer.js";
import { generateFinalAnalysis } from "../services/finalAnalyser.js";
import { computeSuccessFit } from "../services/successFit.js";
import { buildScoreBreakdown } from "../services/scoreBreakdown.js";
import { generateRecommendation } from "../services/recommendationEngine.js";
import { notify, readLog, phoneDigits, whatsappConfigured } from "../services/whatsappService.js";
import { chatJSON, chatText } from "../services/aiClient.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
const CANDIDATES_PATH = path.join(DATA_DIR, "candidates.json");
const SCORES_PATH = path.join(DATA_DIR, "scores.json");
const DEMO_PATH = path.join(DATA_DIR, "demo-candidates.json");

// --- tiny JSON helpers ---
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJSON = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2));
const today = () => new Date().toISOString().slice(0, 10);
const findJob = (jobId) => readJSON(JOBS_PATH).find((j) => j.job_id === jobId);

// Read-only lookup across live candidates + demo fallback data.
function findCandidate(candidateId) {
  const live = readJSON(CANDIDATES_PATH);
  const hit = live.find((c) => c.candidate_id === candidateId);
  if (hit) return hit;
  try {
    return readJSON(DEMO_PATH).find((c) => c.candidate_id === candidateId);
  } catch {
    return undefined;
  }
}

/**
 * Score a candidate, generate insights, build + persist the score object,
 * embed it on the candidate, and return the score object.
 */
async function runScoring(candidate, job) {
  const scores = scoreCandidate(candidate, job);
  const insights = await generateCandidateInsights(candidate, job, scores);

  const scoreObj = {
    score_id: uuidv4(),
    candidate_id: candidate.candidate_id,
    job_id: job.job_id,
    scored_date: today(),
    cv_partial_score: scores.cv_partial_score,
    cv_coverage: scores.cv_coverage,
    scored_coverage: scores.cv_coverage,
    pending_sources: scores.pending_sources,
    full_score_available: scores.full_score_available,
    benchmark_score: scores.benchmark_score,
    benchmark_maturity: scores.benchmark_maturity,
    criteria_scores: scores.criteria_scores,
    combined_score: scores.combined_score,
    lane: scores.lane,
    must_have_penalty: scores.must_have_penalty,
    missing_must_haves: scores.missing_must_haves,
    dealbreaker_triggered: scores.dealbreaker_triggered,
    dealbreakers_hit: scores.dealbreakers_hit,
    strengths: insights.strengths,
    weaknesses: insights.weaknesses,
    gaps: insights.gaps,
    summary: insights.summary,
  };

  const allScores = readJSON(SCORES_PATH);
  allScores.push(scoreObj);
  writeJSON(SCORES_PATH, allScores);

  candidate.score = scoreObj;
  // Session 11: attach the hiring-intelligence layer.
  candidate.score_breakdown = buildScoreBreakdown(candidate, job);
  candidate.recommendation = await generateRecommendation(candidate, job);
  return scoreObj;
}

/**
 * Refresh the score breakdown + recommendation after a score change
 * (OCEAN / interview / notes). Mutates the candidate in place.
 */
async function refreshIntelligence(candidate, job) {
  candidate.score_breakdown = buildScoreBreakdown(candidate, job);
  candidate.recommendation = await generateRecommendation(candidate, job);
}

// --- multer: temp storage, keep original extension ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * POST /api/upload-cv  (multipart: file, jobId)
 * Upload -> extract -> parse -> score -> persist fully scored candidate.
 */
router.post("/upload-cv", upload.single("file"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    const { jobId } = req.body;
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    if (!jobId) return res.status(400).json({ error: "Missing jobId." });

    const job = findJob(jobId);
    if (!job) return res.status(400).json({ error: `Unknown jobId: ${jobId}` });

    const extracted = await extractText(tempPath);
    if (extracted.unsupported) {
      return res.status(400).json({ error: extracted.message });
    }
    if (extracted.confidence < 50) {
      return res.status(422).json({
        error:
          "CV could not be read clearly. Please upload a cleaner PDF or DOCX.",
      });
    }

    const profile = await parseCVWithAI(extracted.text, jobId);
    const parseOverall = profile.overall_parse_confidence ?? 50;

    const candidate = {
      candidate_id: uuidv4(),
      job_id: jobId,
      source: "upload",
      submitted_date: today(),
      parse_confidence_overall: parseOverall,
      low_confidence_warning: parseOverall < 70,
      profile,
      score: null,
      hr_notes: [],
      override: null,
    };

    // Score automatically — HR never triggers scoring manually.
    await runScoring(candidate, job);

    const candidates = readJSON(CANDIDATES_PATH);
    candidates.push(candidate);
    writeJSON(CANDIDATES_PATH, candidates);

    return res.status(201).json(candidate);
  } catch (err) {
    console.error("upload-cv error:", err);
    return res
      .status(500)
      .json({ error: "Failed to process CV.", detail: err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.unlink(tempPath, () => {});
  }
});

/**
 * POST /api/score-candidate  { candidate_id, job_id }
 * Re-run scoring for an existing candidate.
 */
router.post("/score-candidate", async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;
    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === candidate_id);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });

    const job = findJob(job_id || candidates[idx].job_id);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    await runScoring(candidates[idx], job);
    writeJSON(CANDIDATES_PATH, candidates);
    return res.json(candidates[idx]);
  } catch (err) {
    console.error("score-candidate error:", err);
    return res.status(500).json({ error: "Failed to score candidate." });
  }
});

/**
 * POST /api/interview-questions  { candidate_id, job_id }
 * Generate 7 tailored questions (2 per gap + 3 general).
 */
router.post("/interview-questions", async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;
    const candidate = findCandidate(candidate_id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(job_id || candidate.job_id);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const gaps = candidate.score?.gaps || [];
    const system =
      "You are an expert interviewer and HR consultant. Generate targeted interview questions based on the candidate's profile and identified gaps. " +
      "Questions must be specific to this candidate, not generic. " +
      "Never ask about family, health, religion, race, gender, or marital status. Return valid JSON only.";

    const user = `Generate interview questions for ${candidate.profile.name} applying for ${job.role_title}.

Their top 2 gaps are: ${JSON.stringify(gaps)}

Their experience summary: ${JSON.stringify(
      (candidate.profile.work_history || []).map(
        (w) => `${w.title} at ${w.employer} (${w.duration_months} months)`
      )
    )}

Key role requirements: ${JSON.stringify(job.requirements.key_responsibilities)}

Return this JSON:
{
  "questions": [
    { "question": "one clear sentence", "type": "behavioural|situational|competency", "targets_gap": "which gap this addresses, or null if general" }
  ]
}

Generate exactly 7 questions:
- 2 targeting gap 1
- 2 targeting gap 2
- 3 general role-fit questions
Mix behavioural, situational, and competency types.`;

    const result = await chatJSON({ system, user, temperature: 0.5 });
    return res.json({ questions: result.questions || [] });
  } catch (err) {
    console.error("interview-questions error:", err);
    return res.status(500).json({ error: "Failed to generate questions." });
  }
});

/**
 * POST /api/compare-candidates  { candidate_id_1, candidate_id_2, job_id }
 */
router.post("/compare-candidates", async (req, res) => {
  try {
    const { candidate_id_1, candidate_id_2, job_id } = req.body;
    const a = findCandidate(candidate_id_1);
    const b = findCandidate(candidate_id_2);
    if (!a || !b) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(job_id || a.job_id);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const summarize = (c) => ({
      name: c.profile.name,
      age: c.profile.age,
      total_experience_months: c.profile.total_experience_months,
      lane: c.score?.lane,
      strengths: c.score?.strengths,
      gaps: c.score?.gaps,
      work_history: (c.profile.work_history || []).map(
        (w) => `${w.title} at ${w.employer}`
      ),
    });

    const system =
      "You are an expert HR advisor comparing two candidates. Be direct and specific. " +
      "Do not reference gender, race, religion, or marital status. Return plain text only.";
    const user = `Compare these two candidates for ${job.role_title}.
Candidate A: ${JSON.stringify(summarize(a))}
Candidate B: ${JSON.stringify(summarize(b))}

Write 3-4 sentences for an HR manager explaining who is stronger for what reason, what each is better at, and which specific factor should drive the final decision.`;

    const comparison_text = await chatText({ system, user, temperature: 0.4 });
    return res.json({ comparison_text });
  } catch (err) {
    console.error("compare-candidates error:", err);
    return res.status(500).json({ error: "Failed to compare candidates." });
  }
});

/**
 * POST /api/ocean-assessment { candidate_id, responses }
 * Scores the ocean criteria and recomputes the combined score.
 */
router.post("/ocean-assessment", (req, res) => {
  try {
    const { candidate_id, responses } = req.body;
    if (!responses) return res.status(400).json({ error: "Missing responses." });
    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === candidate_id);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(candidates[idx].job_id);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const traits = computeTraits(responses);
    applyOceanScores(candidates[idx], job, traits);
    writeJSON(CANDIDATES_PATH, candidates);
    return res.json(candidates[idx]);
  } catch (err) {
    console.error("ocean-assessment error:", err);
    return res.status(500).json({ error: "Failed to score assessment." });
  }
});

/**
 * GET /api/demo-candidates — pre-scored fallback candidates for the demo.
 */
router.get("/demo-candidates", (req, res) => {
  try {
    res.json(readJSON(DEMO_PATH));
  } catch (err) {
    res.status(500).json({ error: "Failed to load demo candidates." });
  }
});

/**
 * GET /api/candidates/:jobId — all candidates for a role, sorted by combined score.
 */
router.get("/candidates/:jobId", (req, res) => {
  try {
    const list = readJSON(CANDIDATES_PATH)
      .filter((c) => c.job_id === req.params.jobId)
      .sort(
        (x, y) =>
          (y.score?.combined_score ?? -1) - (x.score?.combined_score ?? -1)
      );
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load candidates." });
  }
});

/**
 * DELETE /api/candidates/:jobId/:candidateId — remove a candidate + their scores.
 * Only affects live candidates (demo fallback data is read-only).
 */
router.delete("/candidates/:jobId/:candidateId", (req, res) => {
  try {
    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1)
      return res.status(404).json({ error: "Candidate not found (demo data can't be deleted)." });

    candidates.splice(idx, 1);
    writeJSON(CANDIDATES_PATH, candidates);

    // Clean up the candidate's score records too.
    try {
      const scores = readJSON(SCORES_PATH).filter(
        (s) => s.candidate_id !== req.params.candidateId
      );
      writeJSON(SCORES_PATH, scores);
    } catch {
      /* scores file optional */
    }

    res.json({ ok: true, candidate_id: req.params.candidateId });
  } catch (err) {
    console.error("delete candidate error:", err);
    res.status(500).json({ error: "Failed to delete candidate." });
  }
});

/**
 * POST /api/candidates/:jobId/:candidateId/send-interview-invite
 * Body: { interview_type, date, time } → sends a WhatsApp invite, stores invite state.
 */
router.post("/candidates/:jobId/:candidateId/send-interview-invite", async (req, res) => {
  try {
    const { interview_type, date, time } = req.body;
    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const cand = candidates[idx];
    const phone = cand.profile?.contact?.phone;
    if (!phone) return res.status(400).json({ error: "No phone number on file for this candidate." });

    const result = await notify(phone, "interview_invite", {
      name: cand.profile?.name,
      role: job.role_title,
      interview_type,
      date,
      time,
    });

    cand.whatsapp_invite = { sent_at: today(), interview_type, date, time, confirmed: null };
    writeJSON(CANDIDATES_PATH, candidates);

    res.json({
      ok: true,
      message_id: result.sid || null,
      skipped: !!result.skipped,
      reason: result.reason || result.error || null,
    });
  } catch (err) {
    console.error("send-interview-invite error:", err);
    res.status(500).json({ error: "Failed to send invite." });
  }
});

/**
 * POST /api/candidates/:jobId/:candidateId/send-ocean-test  { base_url? }
 * Builds the candidate's standalone OCEAN assessment link and (if a phone is on
 * file) sends it over WhatsApp. Always returns the link so HR can copy/share it.
 */
router.post("/candidates/:jobId/:candidateId/send-ocean-test", async (req, res) => {
  try {
    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const cand = candidates[idx];
    const base = (req.body?.base_url || process.env.FRONTEND_URL || "").replace(/\/$/, "");
    const url = `${base}/assessment/${cand.candidate_id}`;

    const phone = cand.profile?.contact?.phone;
    let result = { skipped: true, reason: "no_phone" };
    if (phone) {
      result = await notify(phone, "assessment_link", { name: cand.profile?.name, role: job.role_title, url, minutes: 5 });
    }

    cand.ocean_invite = { sent_at: today() };
    writeJSON(CANDIDATES_PATH, candidates);

    res.json({
      ok: true,
      url,
      message_id: result.sid || null,
      skipped: !!result.skipped,
      reason: result.reason || result.error || null,
    });
  } catch (err) {
    console.error("send-ocean-test error:", err);
    res.status(500).json({ error: "Failed to send the assessment link." });
  }
});

/**
 * POST /api/candidates/:jobId/:candidateId/outcome  { outcome: "offer" | "rejected" }
 * Records the outcome and sends the candidate the matching WhatsApp message.
 */
router.post("/candidates/:jobId/:candidateId/outcome", async (req, res) => {
  try {
    const { outcome } = req.body;
    if (!["offer", "rejected"].includes(outcome))
      return res.status(400).json({ error: "outcome must be 'offer' or 'rejected'." });

    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const cand = candidates[idx];
    cand.outcome = outcome;
    cand.outcome_date = today();
    writeJSON(CANDIDATES_PATH, candidates);

    const template = outcome === "offer" ? "outcome_successful" : "outcome_unsuccessful";
    const result = await notify(cand.profile?.contact?.phone, template, {
      name: cand.profile?.name,
      role: job.role_title,
    });

    res.json({ candidate: cand, message_sent: !result.skipped, reason: result.reason || null });
  } catch (err) {
    console.error("outcome error:", err);
    res.status(500).json({ error: "Failed to record outcome." });
  }
});

/**
 * GET /api/candidates/:jobId/:candidateId/whatsapp-history
 * Returns the merged inbound/outbound message thread for this candidate.
 */
router.get("/candidates/:jobId/:candidateId/whatsapp-history", (req, res) => {
  try {
    const candidate = findCandidate(req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const digits = phoneDigits(candidate.profile?.contact?.phone);
    const thread = readLog()
      .filter((m) => digits && phoneDigits(m.phone) === digits)
      .map((m) => ({ direction: m.direction, body: m.content, at: m.timestamp, status: m.status }))
      .sort((a, b) => new Date(a.at) - new Date(b.at));
    res.json({ configured: whatsappConfigured, thread });
  } catch (err) {
    console.error("whatsapp-history error:", err);
    res.status(500).json({ error: "Failed to load conversation." });
  }
});

/**
 * GET /api/candidates/:jobId/:candidateId/success-fit
 * Benchmark the candidate against the role's Success Profile.
 */
router.get("/candidates/:jobId/:candidateId/success-fit", (req, res) => {
  try {
    const candidate = findCandidate(req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });
    const fit = computeSuccessFit(candidate, job);
    if (!fit) return res.json({ configured: false });
    res.json({ configured: true, ...fit });
  } catch (err) {
    console.error("success-fit error:", err);
    res.status(500).json({ error: "Failed to compute success fit." });
  }
});

/**
 * GET /api/candidates/:jobId/:candidateId — single candidate with score.
 */
router.get("/candidates/:jobId/:candidateId", (req, res) => {
  try {
    const candidate = findCandidate(req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: "Failed to load candidate." });
  }
});

/**
 * GET /api/candidates/:jobId/:candidateId/interview-prep
 * Returns interview-source criteria with 2 AI-generated probe questions each.
 */
router.get("/candidates/:jobId/:candidateId/interview-prep", async (req, res) => {
  try {
    const candidate = findCandidate(req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const interviewCriteria = (job.criteria || []).filter((c) => c.source === "interview");
    if (interviewCriteria.length === 0) return res.json({ criteria: [] });

    const system =
      "You are an expert interviewer and HR consultant. Generate targeted interview questions and scoring rubrics for each criterion. " +
      "Never ask about family, health, religion, race, gender, or marital status. Return valid JSON only.";

    const user = `Candidate: ${candidate.profile?.name || "Unknown"}
Role: ${job.role_title} (${job.industry})
Candidate experience: ${JSON.stringify(
      (candidate.profile?.work_history || []).map((w) => `${w.title} at ${w.employer}`)
    )}

For EACH criterion below, generate:
- 2 targeted interview questions specific to this candidate
- A scoring rubric with what a LOW (0-40), MID (41-70), and HIGH (71-100) score looks like for this criterion

Criteria:
${interviewCriteria.map((c, i) => `${i + 1}. id="${c.id}" name="${c.name}"${c.description ? " — " + c.description : ""}`).join("\n")}

Return:
{
  "criteria_questions": [
    {
      "criterion_id": "<id from above>",
      "questions": ["question 1", "question 2"],
      "rubric": {
        "low": "<what a 0-40 answer looks like — 1 sentence>",
        "mid": "<what a 41-70 answer looks like — 1 sentence>",
        "high": "<what a 71-100 answer looks like — 1 sentence>"
      }
    }
  ]
}`;

    const result = await chatJSON({ system, user, temperature: 0.5 });
    const qMap = Object.fromEntries(
      (result.criteria_questions || []).map((cq) => [cq.criterion_id, cq])
    );

    const criteria = interviewCriteria.map((c) => {
      const q = qMap[c.id] || {};
      return {
        ...c,
        questions: q.questions || [
          `Tell me about a time you demonstrated ${c.name.toLowerCase()}.`,
          `How would you handle a situation that requires strong ${c.name.toLowerCase()}?`,
        ],
        rubric: q.rubric || {
          low: "No clear example given; vague or irrelevant answer.",
          mid: "Basic competency shown; some relevant experience mentioned.",
          high: "Strong, specific example; clear evidence of skill.",
        },
      };
    });

    res.json({ criteria });
  } catch (err) {
    console.error("interview-prep error:", err);
    res.status(500).json({ error: "Failed to generate interview questions." });
  }
});

/**
 * POST /api/candidates/:jobId/:candidateId/interview-scores
 * Body: { ratings: [{ criterion_id, score: 0-100, notes }] }
 */
router.post("/candidates/:jobId/:candidateId/interview-scores", async (req, res) => {
  try {
    const { ratings } = req.body;
    if (!Array.isArray(ratings) || ratings.length === 0)
      return res.status(400).json({ error: "Missing ratings array." });

    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    applyInterviewScores(candidates[idx], job, ratings);
    await refreshIntelligence(candidates[idx], job); // Session 11
    writeJSON(CANDIDATES_PATH, candidates);
    res.json(candidates[idx]);
  } catch (err) {
    console.error("interview-scores error:", err);
    res.status(500).json({ error: "Failed to save interview scores." });
  }
});

/**
 * POST /api/candidates/:jobId/:candidateId/regenerate-recommendation
 * Recompute the score breakdown + Hire/Hold/Reject recommendation with latest data.
 */
router.post("/candidates/:jobId/:candidateId/regenerate-recommendation", async (req, res) => {
  try {
    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    await refreshIntelligence(candidates[idx], job);
    writeJSON(CANDIDATES_PATH, candidates);
    res.json(candidates[idx]);
  } catch (err) {
    console.error("regenerate-recommendation error:", err);
    res.status(500).json({ error: "Failed to regenerate recommendation." });
  }
});

/**
 * POST /api/candidates/:jobId/:candidateId/final-analysis
 * Requires all 3 stages scored. AI synthesises CV + OCEAN + Interview + HR notes
 * into a holistic verdict with Hire / Hold / Reject recommendation.
 */
router.post("/candidates/:jobId/:candidateId/final-analysis", async (req, res) => {
  try {
    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const candidate = candidates[idx];
    const pending = candidate.score?.pending_sources || [];
    if (pending.length > 0)
      return res.status(400).json({
        error: `Cannot generate final analysis — pending stages: ${pending.join(", ")}`,
      });

    const analysis = await generateFinalAnalysis(candidate, job);
    candidate.final_analysis = analysis;
    writeJSON(CANDIDATES_PATH, candidates);
    res.json({ candidate, final_analysis: analysis });
  } catch (err) {
    console.error("final-analysis error:", err);
    res.status(500).json({ error: "Failed to generate final analysis." });
  }
});

/**
 * POST /api/candidates/:jobId/:candidateId/hr-notes
 * Body: { notes: "free text" }
 * Saves notes + runs AI analysis → HR Assessment criterion in combined score.
 */
router.post("/candidates/:jobId/:candidateId/hr-notes", async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes?.trim()) return res.status(400).json({ error: "Missing notes." });

    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "Candidate not found." });
    const job = findJob(req.params.jobId);
    if (!job) return res.status(400).json({ error: "Unknown job." });

    const result = await applyHrNotes(candidates[idx], notes.trim());
    writeJSON(CANDIDATES_PATH, candidates);
    res.json({ candidate: candidates[idx], saved: result.saved, date: result.date });
  } catch (err) {
    console.error("hr-notes error:", err);
    res.status(500).json({ error: "Failed to save HR notes." });
  }
});

export default router;

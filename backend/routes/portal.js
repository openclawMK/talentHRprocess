/**
 * Public candidate-facing portal routes.
 *
 * Flow: candidate opens /apply/:token →
 *   GET  /api/portal/:token          → role info for the landing page
 *   POST /api/portal/:token/apply    → CV upload + contact details → creates candidate, scores CV
 *   POST /api/portal/:token/ocean    → OCEAN responses → scores ocean criteria
 *
 * These endpoints are token-gated (no HR auth) and only ever expose the single
 * role tied to the token — never the full job list or other candidates.
 */
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
import { buildScoreBreakdown } from "../services/scoreBreakdown.js";
import { generateRecommendation } from "../services/recommendationEngine.js";
import { notify } from "../services/whatsappService.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
const CANDIDATES_PATH = path.join(DATA_DIR, "candidates.json");
const SCORES_PATH = path.join(DATA_DIR, "scores.json");

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const today = () => new Date().toISOString().slice(0, 10);

const findJobByToken = (token) =>
  readJSON(JOBS_PATH).find((j) => j.portal_token === token);

// --- multer: temp storage, keep original extension ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * GET /api/portal/:token — public role info for the application landing page.
 */
router.get("/portal/:token", (req, res) => {
  const job = findJobByToken(req.params.token);
  if (!job) return res.status(404).json({ error: "This application link is invalid or has expired." });
  res.json({
    job_id: job.job_id,
    role_title: job.role_title,
    industry: job.industry,
    location: job.location,
    role_level: job.role_level || "entry",
    key_responsibilities: job.requirements?.key_responsibilities || [],
  });
});

/**
 * POST /api/portal/:token/apply  (multipart: file, name, email, phone)
 * Creates a portal candidate, parses + scores the CV. Returns candidate_id.
 */
router.post("/portal/:token/apply", upload.single("file"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    const job = findJobByToken(req.params.token);
    if (!job) return res.status(404).json({ error: "This application link is invalid or has expired." });

    const { name, email, phone } = req.body;
    if (!req.file) return res.status(400).json({ error: "Please attach your CV." });
    if (!name?.trim() || !email?.trim())
      return res.status(400).json({ error: "Name and email are required." });

    const extracted = await extractText(tempPath);
    if (extracted.unsupported) return res.status(400).json({ error: extracted.message });
    if (extracted.confidence < 50)
      return res.status(422).json({
        error: "We couldn't read this CV clearly. Please upload a cleaner PDF or DOCX.",
      });

    const profile = await parseCVWithAI(extracted.text, job.job_id);
    // Candidate-provided contact details are authoritative.
    profile.name = name.trim();
    profile.contact = { ...(profile.contact || {}), name: name.trim(), email: email.trim(), phone: (phone || "").trim() };

    const parseOverall = profile.overall_parse_confidence ?? 50;
    const candidate = {
      candidate_id: uuidv4(),
      job_id: job.job_id,
      source: "portal",
      submitted_date: today(),
      parse_confidence_overall: parseOverall,
      low_confidence_warning: parseOverall < 70,
      profile,
      score: null,
      hr_notes_list: [],
      portal_status: "pending_ocean",
      override: null,
    };

    // Score CV criteria + generate insights
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
      strengths: insights.strengths,
      weaknesses: insights.weaknesses,
      gaps: insights.gaps,
      summary: insights.summary,
    };
    candidate.score = scoreObj;

    const allScores = readJSON(SCORES_PATH);
    allScores.push(scoreObj);
    writeJSON(SCORES_PATH, allScores);

    const candidates = readJSON(CANDIDATES_PATH);
    candidates.push(candidate);
    writeJSON(CANDIDATES_PATH, candidates);

    res.status(201).json({
      candidate_id: candidate.candidate_id,
      name: profile.name,
      parsed: {
        experience_months: profile.total_experience_months,
        skills: (profile.skills || []).slice(0, 8),
        latest_role: profile.work_history?.[0]?.title || null,
      },
    });
  } catch (err) {
    console.error("portal apply error:", err);
    res.status(500).json({ error: "Something went wrong processing your application. Please try again." });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.unlink(tempPath, () => {});
  }
});

/**
 * POST /api/portal/:token/ocean  { candidate_id, responses }
 * Applies OCEAN scoring and marks the application submitted.
 */
router.post("/portal/:token/ocean", async (req, res) => {
  try {
    const job = findJobByToken(req.params.token);
    if (!job) return res.status(404).json({ error: "This application link is invalid or has expired." });

    const { candidate_id, responses } = req.body;
    if (!responses) return res.status(400).json({ error: "Missing responses." });

    const candidates = readJSON(CANDIDATES_PATH);
    const idx = candidates.findIndex(
      (c) => c.candidate_id === candidate_id && c.job_id === job.job_id
    );
    if (idx === -1) return res.status(404).json({ error: "Application not found." });

    const traits = computeTraits(responses);
    applyOceanScores(candidates[idx], job, traits);
    candidates[idx].portal_status = "submitted";
    // Session 11: refresh hiring-intelligence layer after OCEAN.
    candidates[idx].score_breakdown = buildScoreBreakdown(candidates[idx], job);
    candidates[idx].recommendation = await generateRecommendation(candidates[idx], job);
    writeJSON(CANDIDATES_PATH, candidates);

    // Fire-and-forget WhatsApp notifications — never block the response.
    const cand = candidates[idx];
    notify(cand.profile?.contact?.phone, "application_received", {
      name: cand.profile?.name,
      role: job.role_title,
    }).catch(() => {});

    const greenMark = job.thresholds?.green ?? 70;
    if (
      job.hr_whatsapp_alerts &&
      job.hr_contact_phone &&
      (cand.score?.combined_score ?? 0) >= greenMark
    ) {
      notify(job.hr_contact_phone, "hr_alert", {
        candidate: cand.profile?.name,
        score: cand.score.combined_score,
        role: job.role_title,
      }).catch(() => {});
    }

    res.json({ ok: true, role_title: job.role_title });
  } catch (err) {
    console.error("portal ocean error:", err);
    res.status(500).json({ error: "Couldn't submit your assessment. Please try again." });
  }
});

export default router;

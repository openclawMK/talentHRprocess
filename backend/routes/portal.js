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
import { OCEAN_ITEMS, computeTraits, applyOceanScores } from "../services/oceanScorer.js";
import { buildScoreBreakdown } from "../services/scoreBreakdown.js";
import { generateRecommendation } from "../services/recommendationEngine.js";
import { notify } from "../services/whatsappService.js";
import { readTable, writeTable, appendScore } from "../services/store.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

const today = () => new Date().toISOString().slice(0, 10);

const findJobByToken = async (token) =>
  (await readTable("jobs")).find((j) => j.portal_token === token);

// --- multer: temp storage, keep original extension ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/ocean-questions — public BFI-10 items (used by the candidate portal).
router.get("/ocean-questions", (req, res) => {
  res.json({ items: OCEAN_ITEMS });
});

/**
 * GET /api/assessment/:candidateId — public lookup for the standalone OCEAN
 * questionnaire that HR sends to an individual candidate who hasn't completed
 * it yet. Exposes only the candidate's first name + role title (no scores).
 */
router.get("/assessment/:candidateId", async (req, res) => {
  try {
    const candidate = (await readTable("candidates")).find((c) => c.candidate_id === req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "This assessment link is invalid or has expired." });
    const job = (await readTable("jobs")).find((j) => j.job_id === candidate.job_id);
    const done = !!candidate.ocean_traits;
    res.json({
      name: candidate.profile?.name || "there",
      role_title: job?.role_title || "the role",
      already_done: done,
    });
  } catch (err) {
    console.error("assessment lookup error:", err);
    res.status(500).json({ error: "Couldn't load this assessment. Please try again." });
  }
});

/**
 * POST /api/assessment/:candidateId/ocean  { responses }
 * Applies OCEAN scoring to an existing candidate (HR-uploaded or portal) and
 * refreshes their breakdown + recommendation. Idempotent-ish: re-submitting
 * simply rescores with the latest responses.
 */
router.post("/assessment/:candidateId/ocean", async (req, res) => {
  try {
    const { responses } = req.body;
    if (!responses) return res.status(400).json({ error: "Missing responses." });

    const candidates = (await readTable("candidates"));
    const idx = candidates.findIndex((c) => c.candidate_id === req.params.candidateId);
    if (idx === -1) return res.status(404).json({ error: "This assessment link is invalid or has expired." });

    const job = (await readTable("jobs")).find((j) => j.job_id === candidates[idx].job_id);
    if (!job) return res.status(400).json({ error: "The role for this assessment no longer exists." });

    const traits = computeTraits(responses);
    applyOceanScores(candidates[idx], job, traits);
    candidates[idx].portal_status = "submitted";
    candidates[idx].score_breakdown = buildScoreBreakdown(candidates[idx], job);
    candidates[idx].recommendation = await generateRecommendation(candidates[idx], job);
    await writeTable("candidates", candidates);

    res.json({ ok: true, role_title: job.role_title });
  } catch (err) {
    console.error("assessment ocean error:", err);
    res.status(500).json({ error: "Couldn't submit your assessment. Please try again." });
  }
});

/**
 * GET /api/interview-booking/:candidateId — public lookup for the candidate's
 * self-serve interview booking page. Exposes only open slots for their role
 * (plus whichever slot they've already booked) — never other candidates' data.
 */
router.get("/interview-booking/:candidateId", async (req, res) => {
  try {
    const candidate = (await readTable("candidates")).find((c) => c.candidate_id === req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "This booking link is invalid or has expired." });
    const job = (await readTable("jobs")).find((j) => j.job_id === candidate.job_id);
    if (!job) return res.status(404).json({ error: "This role is no longer available." });

    const now = Date.now();
    const slots = (job.interview_slots || [])
      .filter((s) => new Date(s.start).getTime() > now)
      .filter((s) => !s.candidate_id || s.candidate_id === candidate.candidate_id)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .map((s) => ({ slot_id: s.slot_id, start: s.start, duration_minutes: s.duration_minutes, booked_by_me: s.candidate_id === candidate.candidate_id }));

    res.json({
      name: candidate.profile?.name || "there",
      role_title: job.role_title,
      company_name: job.company?.name || null,
      slots,
      my_booking: slots.find((s) => s.booked_by_me) || null,
    });
  } catch (err) {
    console.error("interview-booking lookup error:", err);
    res.status(500).json({ error: "Couldn't load this booking page. Please try again." });
  }
});

/**
 * POST /api/interview-booking/:candidateId/book  { slot_id }
 * Books an open slot for the candidate, releasing any earlier slot they held
 * for this role. Fails with 409 if someone else took it in the meantime.
 */
router.post("/interview-booking/:candidateId/book", async (req, res) => {
  try {
    const { slot_id } = req.body;
    if (!slot_id) return res.status(400).json({ error: "Missing slot_id." });

    const candidates = (await readTable("candidates"));
    const candidate = candidates.find((c) => c.candidate_id === req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "This booking link is invalid or has expired." });

    const jobs = (await readTable("jobs"));
    const jobIdx = jobs.findIndex((j) => j.job_id === candidate.job_id);
    if (jobIdx === -1) return res.status(404).json({ error: "This role is no longer available." });
    const job = jobs[jobIdx];

    const slot = (job.interview_slots || []).find((s) => s.slot_id === slot_id);
    if (!slot) return res.status(404).json({ error: "That time slot no longer exists." });
    if (slot.candidate_id && slot.candidate_id !== candidate.candidate_id)
      return res.status(409).json({ error: "That time was just taken — please pick another." });
    if (new Date(slot.start).getTime() <= Date.now())
      return res.status(400).json({ error: "That time has already passed." });

    // Release any earlier slot this candidate held for this role.
    for (const s of job.interview_slots) {
      if (s.candidate_id === candidate.candidate_id && s.slot_id !== slot_id) {
        s.candidate_id = null;
        s.booked_at = null;
      }
    }
    slot.candidate_id = candidate.candidate_id;
    slot.booked_at = new Date().toISOString();
    await writeTable("jobs", jobs);

    const when = new Date(slot.start).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });
    const result = await notify(candidate.profile?.contact?.phone, "booking_confirmed", { name: candidate.profile?.name, role: job.role_title, when });

    res.json({ ok: true, slot: { slot_id: slot.slot_id, start: slot.start, duration_minutes: slot.duration_minutes }, message_sent: !result.skipped });
  } catch (err) {
    console.error("book interview slot error:", err);
    res.status(500).json({ error: "Failed to book that time." });
  }
});

/**
 * GET /api/portal/:token — public role info for the application landing page.
 */
router.get("/portal/:token", async (req, res) => {
  const job = await findJobByToken(req.params.token);
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
    const job = await findJobByToken(req.params.token);
    if (!job) return res.status(404).json({ error: "This application link is invalid or has expired." });

    const { name, email, phone, expected_salary, consent } = req.body;
    if (!req.file) return res.status(400).json({ error: "Please attach your CV." });
    if (!name?.trim() || !email?.trim())
      return res.status(400).json({ error: "Name and email are required." });
    // PDPA consent must be affirmatively given and is recorded on the candidate
    // record (not just gated client-side) so we can demonstrate it was captured.
    if (consent !== "true" && consent !== true)
      return res.status(400).json({ error: "Please provide consent to data processing before submitting." });

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
    // Expected monthly salary (RM) — optional, candidate-stated.
    const salaryNum = Number(String(expected_salary ?? "").replace(/[^\d.]/g, ""));
    if (salaryNum > 0) profile.expected_salary = Math.round(salaryNum);

    const parseOverall = profile.overall_parse_confidence ?? 50;
    const candidate = {
      candidate_id: uuidv4(),
      job_id: job.job_id,
      source: "portal",
      submitted_date: today(),
      parse_confidence_overall: parseOverall,
      low_confidence_warning: parseOverall < 70,
      pdpa_consent: { given: true, at: new Date().toISOString() },
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

    await appendScore(scoreObj);

    const candidates = (await readTable("candidates"));
    candidates.push(candidate);
    await writeTable("candidates", candidates);

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
    const job = await findJobByToken(req.params.token);
    if (!job) return res.status(404).json({ error: "This application link is invalid or has expired." });

    const { candidate_id, responses } = req.body;
    if (!responses) return res.status(400).json({ error: "Missing responses." });

    const candidates = (await readTable("candidates"));
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
    await writeTable("candidates", candidates);

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

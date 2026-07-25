/**
 * Machine-facing API — a client's own system (HRIS, careers site) pushes
 * roles and candidates here directly, instead of a human using the dashboard.
 * Mounted at /api/v1 behind authenticateApiKey (see server.js), which resolves
 * the Authorization header to req.user.company_id — the exact same field the
 * dashboard's client logins use, so this reuses every company-scoping guard
 * already built rather than needing its own.
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

import { createJobFromParams } from "../services/jobCreation.js";
import { extractText } from "../services/fileExtractor.js";
import { parseCVWithAI } from "../services/cvParser.js";
import { scoreCandidate } from "../services/scorer.js";
import { refreshEvidenceOverrides } from "../services/successFit.js";
import { generateCandidateInsights } from "../services/languageGenerator.js";
import { readTable, insertRow, appendScore } from "../services/store.js";
import { hasTokens, consumeToken } from "../services/billing.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

const today = () => new Date().toISOString().slice(0, 10);

// Same temp-file handling as the public portal: store, parse, then delete.
// We never retain the original CV file — only the parsed profile.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Resolves :roleId to a job the CALLING COMPANY owns. Returns null (and the
 * caller 404s) for a role belonging to anyone else — same "not found, not
 * forbidden" posture as the dashboard guards, so a key can't be used to probe
 * which role ids exist on other accounts.
 */
async function findOwnRole(req) {
  const job = (await readTable("jobs")).find((j) => j.job_id === req.params.roleId);
  if (!job) return null;
  if (job.company?.id !== req.user.company_id) return null;
  return job;
}

/**
 * POST /api/v1/roles — create a vacancy under the calling company.
 * Body: { title, industry?, location?, role_level?, key_responsibilities?,
 *         must_haves?, nice_to_haves?, dealbreakers? }
 * Only `title` is required — everything else the AI drafts (criteria, a
 * starter Success Profile) exactly as it does for a role created from the
 * dashboard. must_haves/nice_to_haves/dealbreakers, if supplied, are merged
 * onto that draft rather than replacing it wholesale.
 */
router.post("/roles", async (req, res) => {
  try {
    const { title, industry, location, role_level, key_responsibilities, must_haves, nice_to_haves, dealbreakers } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: "title is required." });

    const success_profile = {};
    if (Array.isArray(must_haves)) success_profile.must_haves = must_haves;
    if (Array.isArray(nice_to_haves)) success_profile.nice_to_haves = nice_to_haves;
    if (Array.isArray(dealbreakers)) success_profile.dealbreakers = dealbreakers;

    const result = await createJobFromParams(
      {
        role_title: title.trim(),
        industry: industry?.trim() || "General",
        location: location?.trim(),
        role_level,
        key_responsibilities: Array.isArray(key_responsibilities) ? key_responsibilities : [],
        success_profile: Object.keys(success_profile).length ? success_profile : undefined,
      },
      req.user.company_id
    );
    if (result.error) return res.status(result.status || 400).json({ error: result.error });

    res.status(201).json({
      role_id: result.job.job_id,
      title: result.job.role_title,
      status: "active",
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("api v1 create role error:", err);
    res.status(500).json({ error: "Failed to create the role." });
  }
});

/**
 * POST /api/v1/roles/:roleId/candidates  (multipart/form-data)
 * Pushes one candidate + their CV against a role the calling company owns.
 *
 * Fields: file (the CV, PDF/DOCX), name, email, consent_obtained,
 *         phone?, expected_salary?, cover_letter?, external_ref?
 *
 * We parse and score the CV immediately, so the candidate is usable straight
 * away — but a CV alone can't fill the personality/interview parts of the
 * model, so the record comes back `incomplete` with a `completion_link` the
 * client sends to the candidate. Score is flagged `provisional` until that's
 * done, rather than being hidden.
 */
router.post("/roles/:roleId/candidates", upload.single("file"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    const job = await findOwnRole(req);
    if (!job) return res.status(404).json({ error: "Role not found." });
    if (!(await hasTokens(req.user.company_id))) {
      return res.status(402).json({ error: "This company has used all its CV scan tokens. Contact PeopleQuest to add more." });
    }

    const { name, email, phone, expected_salary, cover_letter, consent_obtained, external_ref } = req.body || {};

    if (!req.file) return res.status(400).json({ error: "A CV file is required (field name: file)." });
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    if (!email?.trim()) return res.status(400).json({ error: "email is required." });

    // PDPA: the client is asserting they collected the candidate's consent on
    // their own side before sending us the data. Recorded on the candidate as
    // a dated, attributable statement — we can't collect it ourselves here the
    // way the public application form does, so this must be explicit.
    if (consent_obtained !== "true" && consent_obtained !== true) {
      return res.status(400).json({
        error: "consent_obtained must be true — confirm the candidate consented to their data being shared with PeopleQuest.",
      });
    }

    // Retry-safe: the same candidate pushed twice against one role returns the
    // original instead of silently creating a duplicate.
    const existing = (await readTable("candidates")).find(
      (c) => c.job_id === job.job_id && c.profile?.contact?.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (existing) {
      return res.status(409).json({
        error: "A candidate with this email already exists for this role.",
        candidate_id: existing.candidate_id,
      });
    }

    const extracted = await extractText(tempPath);
    if (extracted.unsupported) return res.status(400).json({ error: extracted.message });
    if (extracted.confidence < 50) {
      return res.status(422).json({ error: "We couldn't read this CV clearly. Send a cleaner PDF or DOCX." });
    }

    const profile = await parseCVWithAI(extracted.text, job.job_id);
    // Client-supplied contact details are authoritative over anything the AI
    // read off the CV.
    profile.name = name.trim();
    profile.contact = { ...(profile.contact || {}), name: name.trim(), email: email.trim(), phone: (phone || "").trim() };
    const salaryNum = Number(String(expected_salary ?? "").replace(/[^\d.]/g, ""));
    if (salaryNum > 0) profile.expected_salary = Math.round(salaryNum);

    const parseOverall = profile.overall_parse_confidence ?? 50;
    const candidate = {
      candidate_id: uuidv4(),
      job_id: job.job_id,
      source: "api",
      external_ref: external_ref?.trim() || null,
      submitted_date: today(),
      parse_confidence_overall: parseOverall,
      low_confidence_warning: parseOverall < 70,
      pdpa_consent: { given: true, at: new Date().toISOString(), via: "api", asserted_by_api_key: req.user.api_key_id || null },
      cover_letter: cover_letter?.trim() || null,
      profile,
      score: null,
      hr_notes_list: [],
      portal_status: "pending_ocean",
      override: null,
    };

    await refreshEvidenceOverrides(candidate, job);
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

    // insertRow (not writeTable) — safe under concurrent pushes, see store.js.
    await insertRow("candidates", candidate);
    await appendScore(scoreObj);
    await consumeToken(req.user.company_id);

    // `combined_score` is points on the eventual 0-100 scale, but only the
    // stages actually assessed can contribute — a CV-only candidate can't
    // exceed the profile-fit weight. Returning the ceiling alongside it keeps
    // "29" from reading as a failing grade when it's 29 of a possible 35.
    // `lane` is judged on quality-so-far (score relative to assessed weight),
    // which is why a low absolute value can still be green — same figure the
    // dashboard shows, so the two never disagree.
    const cs = scores.component_scores || {};
    const W = cs.weights || {};
    let assessedWeight = 0;
    if (cs.profile_fit != null) assessedWeight += W.profile || 0;
    if (cs.ocean != null) assessedWeight += W.ocean || 0;
    if (cs.interview != null) assessedWeight += W.interview || 0;

    const baseUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
    res.status(201).json({
      candidate_id: candidate.candidate_id,
      role_id: job.job_id,
      external_ref: candidate.external_ref,
      status: scores.full_score_available ? "complete" : "incomplete",
      pending: scores.pending_sources || [],
      completion_link: baseUrl ? `${baseUrl}/assessment/${candidate.candidate_id}` : null,
      score: {
        value: scores.combined_score,
        max_so_far: Math.round(assessedWeight * 100),
        max_when_complete: 100,
        lane: scores.lane,
        provisional: !scores.full_score_available,
      },
      parsed: {
        experience_months: profile.total_experience_months ?? null,
        latest_role: profile.work_history?.[0]?.title || null,
        skills: (profile.skills || []).slice(0, 8),
        parse_confidence: parseOverall,
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("api v1 create candidate error:", err);
    res.status(500).json({ error: "Failed to add the candidate." });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.unlink(tempPath, () => {});
  }
});

export default router;

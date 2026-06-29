import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { generateCriteria } from "../services/criteriaGenerator.js";
import {
  DEFAULT_PIPELINE,
  redistribute,
  sourceShares,
  pipelineStageList,
  reconcileCandidate,
} from "../services/pipeline.js";
import { notify } from "../services/whatsappService.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
const CANDIDATES_PATH = path.join(DATA_DIR, "candidates.json");
const TEMPLATES_PATH = path.join(DATA_DIR, "industry-templates.json");

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

// weights must sum to ~1.0 (allow rounding tolerance)
function weightsValid(criteria) {
  const sum = (criteria || []).reduce((a, c) => a + (Number(c.weight) || 0), 0);
  return Math.abs(sum - 1) <= 0.01;
}

function nextJobId(jobs) {
  let n = jobs.length + 1;
  let id;
  do {
    id = `job_${String(n).padStart(3, "0")}`;
    n += 1;
  } while (jobs.some((j) => j.job_id === id));
  return id;
}

// GET /api/jobs — all jobs
router.get("/jobs", (req, res) => {
  try {
    res.json(readJSON(JOBS_PATH));
  } catch {
    res.status(500).json({ error: "Failed to load jobs." });
  }
});

// GET /api/industry-templates — starter criteria per industry
router.get("/industry-templates", (req, res) => {
  try {
    res.json(readJSON(TEMPLATES_PATH));
  } catch {
    res.status(500).json({ error: "Failed to load templates." });
  }
});

// POST /api/generate-criteria — AI-generated criteria for a role
router.post("/generate-criteria", async (req, res) => {
  try {
    const { industry, role_title, key_responsibilities = [], role_level = "entry" } = req.body;
    if (!industry || !role_title)
      return res.status(400).json({ error: "industry and role_title are required." });
    const criteria = await generateCriteria({ industry, role_title, key_responsibilities, role_level });
    res.json({ criteria, role_level, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error("generate-criteria error:", err);
    res.status(500).json({ error: "Failed to generate criteria." });
  }
});

// POST /api/jobs/:jobId/send-portal-link — share the application link via WhatsApp
router.post("/jobs/:jobId/send-portal-link", async (req, res) => {
  try {
    const { candidate_name, phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });
    const job = readJSON(JOBS_PATH).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });

    const base = process.env.FRONTEND_URL || "";
    const url = `${base}/apply/${job.portal_token}`;
    const minutes = job.pipeline_stages?.ocean_assessment?.enabled === false ? 5 : 8;
    const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const expiry = expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const result = await notify(phone, "portal_link", {
      name: candidate_name,
      role: job.role_title,
      url,
      minutes,
      expiry,
    });

    res.json({
      ok: true,
      message_id: result.sid || null,
      skipped: !!result.skipped,
      reason: result.reason || result.error || null,
      portal_url: url,
    });
  } catch (err) {
    console.error("send-portal-link error:", err);
    res.status(500).json({ error: "Failed to send portal link." });
  }
});

// PATCH /api/jobs/:jobId/whatsapp-settings — { hr_whatsapp_alerts, hr_contact_phone }
router.patch("/jobs/:jobId/whatsapp-settings", (req, res) => {
  try {
    const { hr_whatsapp_alerts, hr_contact_phone } = req.body;
    const jobs = readJSON(JOBS_PATH);
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });
    if (typeof hr_whatsapp_alerts === "boolean") jobs[idx].hr_whatsapp_alerts = hr_whatsapp_alerts;
    if (typeof hr_contact_phone === "string") jobs[idx].hr_contact_phone = hr_contact_phone;
    writeJSON(JOBS_PATH, jobs);
    res.json({
      job_id: jobs[idx].job_id,
      hr_whatsapp_alerts: !!jobs[idx].hr_whatsapp_alerts,
      hr_contact_phone: jobs[idx].hr_contact_phone || "",
    });
  } catch (err) {
    console.error("whatsapp-settings error:", err);
    res.status(500).json({ error: "Failed to update settings." });
  }
});

// GET /api/jobs/:jobId/pipeline — active pipeline + redistributed weights
router.get("/jobs/:jobId/pipeline", (req, res) => {
  const job = readJSON(JOBS_PATH).find((j) => j.job_id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({
    job_id: job.job_id,
    stages: pipelineStageList(job),
    criteria: redistribute(job),
    source_shares: sourceShares(job),
  });
});

// PATCH /api/jobs/:jobId/pipeline — toggle optional stages, recompute candidate scores
router.patch("/jobs/:jobId/pipeline", (req, res) => {
  try {
    const { stages } = req.body; // { ocean_assessment: bool, interview: bool }
    const jobs = readJSON(JOBS_PATH);
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });

    const job = jobs[idx];
    const current = job.pipeline_stages || { ...DEFAULT_PIPELINE };

    // Only the unlocked stages can be toggled.
    for (const key of ["ocean_assessment", "interview"]) {
      if (typeof stages?.[key] === "boolean") {
        current[key] = { ...(current[key] || {}), enabled: stages[key], locked: false };
      }
    }
    // Ensure locked stages stay on.
    current.cv_submission = { enabled: true, locked: true };
    current.offer = { enabled: true, locked: true };
    job.pipeline_stages = current;
    jobs[idx] = job;
    writeJSON(JOBS_PATH, jobs);

    // Reconcile existing candidates for this role so dashboards stay correct.
    try {
      const candidates = readJSON(CANDIDATES_PATH);
      let changed = false;
      for (const c of candidates) {
        if (c.job_id === job.job_id) {
          reconcileCandidate(c, job);
          changed = true;
        }
      }
      if (changed) writeJSON(CANDIDATES_PATH, candidates);
    } catch (e) {
      console.error("pipeline reconcile error:", e.message);
    }

    res.json({
      job_id: job.job_id,
      stages: pipelineStageList(job),
      criteria: redistribute(job),
      source_shares: sourceShares(job),
    });
  } catch (err) {
    console.error("patch pipeline error:", err);
    res.status(500).json({ error: "Failed to update pipeline." });
  }
});

// GET /api/jobs/:jobId/criteria — criteria + metadata for a job
router.get("/jobs/:jobId/criteria", (req, res) => {
  const job = readJSON(JOBS_PATH).find((j) => j.job_id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({
    job_id: job.job_id,
    criteria: job.criteria || [],
    criteria_generated_by: job.criteria_generated_by,
    criteria_locked: job.criteria_locked,
  });
});

// PATCH /api/jobs/:jobId/criteria — replace a job's criteria
router.patch("/jobs/:jobId/criteria", (req, res) => {
  try {
    const { criteria } = req.body;
    if (!Array.isArray(criteria) || criteria.length === 0)
      return res.status(400).json({ error: "criteria array is required." });
    if (!weightsValid(criteria))
      return res.status(400).json({ error: "Criteria weights must sum to 100%" });

    const jobs = readJSON(JOBS_PATH);
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });

    jobs[idx].criteria = criteria;
    jobs[idx].criteria_generated_by = "edited";
    writeJSON(JOBS_PATH, jobs);
    res.json(jobs[idx]);
  } catch (err) {
    console.error("patch criteria error:", err);
    res.status(500).json({ error: "Failed to update criteria." });
  }
});

// POST /api/jobs — create a new role (with AI or supplied criteria)
router.post("/jobs", async (req, res) => {
  try {
    const {
      role_title,
      industry,
      location = "Kuala Lumpur",
      role_level = "entry",
      requirements = {},
      key_responsibilities = [],
      criteria: suppliedCriteria,
    } = req.body;

    if (!role_title || !industry)
      return res.status(400).json({ error: "role_title and industry are required." });

    let criteria = suppliedCriteria;
    if (!Array.isArray(criteria) || criteria.length === 0) {
      criteria = await generateCriteria({ industry, role_title, key_responsibilities, role_level });
    } else if (!weightsValid(criteria)) {
      return res.status(400).json({ error: "Criteria weights must sum to 100%" });
    }

    const jobs = readJSON(JOBS_PATH);
    const job_id = nextJobId(jobs);

    const expMin = Number(requirements.experience_years_min) || 0;
    const newJob = {
      job_id,
      role_title,
      industry,
      location,
      requirements: {
        experience_years_min: expMin,
        experience_years_preferred: requirements.experience_years_preferred || expMin + 1,
        education_level_min: requirements.education_level_min || "Any",
        required_skills: requirements.required_skills || [],
        preferred_skills: requirements.preferred_skills || [],
        key_responsibilities: key_responsibilities,
      },
      age_band: requirements.age_band || { min: 18, ideal_min: 18, ideal_max: 45, max: 60 },
      portal_token: `pq-${uuidv4().slice(0, 8)}`,
      pipeline_stages: { ...DEFAULT_PIPELINE },
      hr_whatsapp_alerts: false,
      hr_contact_phone: "",
      criteria,
      thresholds: { green: 70, red: 40 },
      benchmark: { maturity: "starter", avg_experience_years: expMin || 1, avg_team_size: 0 },
      role_level,
      criteria_generated_by: suppliedCriteria ? "edited" : "ai",
      criteria_locked: false,
    };

    jobs.push(newJob);
    writeJSON(JOBS_PATH, jobs);
    res.status(201).json(newJob);
  } catch (err) {
    console.error("create job error:", err);
    res.status(500).json({ error: "Failed to create job." });
  }
});

export default router;

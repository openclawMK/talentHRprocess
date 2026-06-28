import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateCriteria } from "../services/criteriaGenerator.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
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
    const { industry, role_title, key_responsibilities = [] } = req.body;
    if (!industry || !role_title)
      return res.status(400).json({ error: "industry and role_title are required." });
    const criteria = await generateCriteria({ industry, role_title, key_responsibilities });
    res.json({ criteria, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error("generate-criteria error:", err);
    res.status(500).json({ error: "Failed to generate criteria." });
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
      requirements = {},
      key_responsibilities = [],
      criteria: suppliedCriteria,
    } = req.body;

    if (!role_title || !industry)
      return res.status(400).json({ error: "role_title and industry are required." });

    let criteria = suppliedCriteria;
    if (!Array.isArray(criteria) || criteria.length === 0) {
      criteria = await generateCriteria({ industry, role_title, key_responsibilities });
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
      criteria,
      thresholds: { green: 70, red: 40 },
      benchmark: { maturity: "starter", avg_experience_years: expMin || 1, avg_team_size: 0 },
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

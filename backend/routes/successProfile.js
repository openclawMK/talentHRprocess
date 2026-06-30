/**
 * Role Success Profile (Session 12) — HR-defined benchmark of an ideal hire.
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chatJSON } from "../services/aiClient.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOBS_PATH = path.join(__dirname, "..", "data", "jobs.json");

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

// GET /api/jobs/:jobId/success-profile
router.get("/jobs/:jobId/success-profile", (req, res) => {
  const job = readJSON(JOBS_PATH).find((j) => j.job_id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json(job.successProfile || {});
});

// PUT /api/jobs/:jobId/success-profile
router.put("/jobs/:jobId/success-profile", (req, res) => {
  try {
    const jobs = readJSON(JOBS_PATH);
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });

    const p = req.body || {};
    const now = new Date().toISOString();
    jobs[idx].successProfile = {
      summary: p.summary || "",
      must_haves: Array.isArray(p.must_haves) ? p.must_haves : [],
      nice_to_haves: Array.isArray(p.nice_to_haves) ? p.nice_to_haves : [],
      dealbreakers: Array.isArray(p.dealbreakers) ? p.dealbreakers : [],
      ideal_ocean_profile: p.ideal_ocean_profile || {},
      benchmark_experience_years: Number(p.benchmark_experience_years) || 0,
      benchmark_team_size: Number(p.benchmark_team_size) || 0,
      benchmark_education: p.benchmark_education || "",
      created_at: jobs[idx].successProfile?.created_at || now,
      last_updated: now,
    };
    writeJSON(JOBS_PATH, jobs);
    res.json(jobs[idx].successProfile);
  } catch (err) {
    console.error("save success-profile error:", err);
    res.status(500).json({ error: "Failed to save success profile." });
  }
});

// POST /api/jobs/:jobId/success-profile/generate — AI suggestion (not saved)
router.post("/jobs/:jobId/success-profile/generate", async (req, res) => {
  try {
    const job = readJSON(JOBS_PATH).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });

    const system =
      "You are a senior HR consultant specializing in Malaysian hiring. Generate a Role Success Profile. " +
      "Return valid JSON only, matching exactly: { summary, must_haves (array of strings), nice_to_haves (array of strings), " +
      "dealbreakers (array of strings), ideal_ocean_profile: { O, C, E, A, N } where each value is one of " +
      "'low','medium-low','medium','medium-high','high', benchmark_experience_years (number), benchmark_team_size (number) }. " +
      "Be specific and realistic for the Malaysian job market.";

    const user = `Job title: ${job.role_title}. Industry: ${job.industry}. Key responsibilities: ${
      (job.requirements?.key_responsibilities || []).join("; ") || "n/a"
    }.`;

    const result = await chatJSON({ system, user, temperature: 0.4 });
    res.json({
      summary: result.summary || "",
      must_haves: result.must_haves || [],
      nice_to_haves: result.nice_to_haves || [],
      dealbreakers: result.dealbreakers || [],
      ideal_ocean_profile: result.ideal_ocean_profile || { O: "medium", C: "high", E: "medium", A: "high", N: "low" },
      benchmark_experience_years: Number(result.benchmark_experience_years) || 2,
      benchmark_team_size: Number(result.benchmark_team_size) || 0,
    });
  } catch (err) {
    console.error("generate success-profile error:", err);
    res.status(500).json({ error: "Failed to generate success profile." });
  }
});

export default router;

/**
 * PDF export route (Session 12).
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateCandidateReport } from "../services/pdfExporter.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
const CANDIDATES_PATH = path.join(DATA_DIR, "candidates.json");
const DEMO_PATH = path.join(DATA_DIR, "demo-candidates.json");

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

function findCandidate(id) {
  const live = readJSON(CANDIDATES_PATH).find((c) => c.candidate_id === id);
  if (live) return live;
  try {
    return readJSON(DEMO_PATH).find((c) => c.candidate_id === id);
  } catch {
    return undefined;
  }
}

const safe = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");

// GET /api/candidates/:jobId/:candidateId/export/pdf
router.get("/candidates/:jobId/:candidateId/export/pdf", async (req, res) => {
  try {
    const candidate = findCandidate(req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const job = readJSON(JOBS_PATH).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });

    const buffer = await generateCandidateReport(candidate, job);
    const filename = `${safe(candidate.profile?.name) || "Candidate"}_Report_${safe(job.role_title)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("pdf export error:", err);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

export default router;

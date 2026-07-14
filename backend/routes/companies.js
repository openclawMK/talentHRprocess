/**
 * Companies — first-class entities that job roles belong to. A company is
 * created up front (name, industry, brand colour); roles are then created
 * under it. Kept intentionally lightweight (no separate auth/ownership model
 * — this is a single-workspace HR tool).
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const COMPANIES_PATH = path.join(DATA_DIR, "companies.json");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");

const readJSON = (p, fallback = []) => { try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return fallback; } };
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

const ACCENTS = ["#6366F1", "#0D9488", "#DB2777", "#D97706", "#0EA5E9", "#7C3AED", "#059669", "#DC2626"];
const initialsOf = (name) => (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const accentFor = (name) => { let h = 0; for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0; return ACCENTS[h % ACCENTS.length]; };

// GET /api/companies — all companies, with a live role count.
router.get("/companies", (req, res) => {
  try {
    const companies = readJSON(COMPANIES_PATH);
    const jobs = readJSON(JOBS_PATH);
    res.json(companies.map((c) => ({ ...c, roles: jobs.filter((j) => j.company?.id === c.id).length })));
  } catch (err) {
    console.error("list companies error:", err);
    res.status(500).json({ error: "Failed to load companies." });
  }
});

// GET /api/companies/:companyId
router.get("/companies/:companyId", (req, res) => {
  const c = readJSON(COMPANIES_PATH).find((x) => x.id === req.params.companyId);
  if (!c) return res.status(404).json({ error: "Company not found." });
  res.json(c);
});

// POST /api/companies  { name, industry }
router.post("/companies", (req, res) => {
  try {
    const { name, industry } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Company name is required." });

    const companies = readJSON(COMPANIES_PATH);
    const company = {
      id: uuidv4(),
      name: name.trim(),
      industry: industry?.trim() || "",
      accent: accentFor(name.trim()),
      initials: initialsOf(name.trim()),
      created_at: new Date().toISOString(),
    };
    companies.push(company);
    writeJSON(COMPANIES_PATH, companies);
    res.status(201).json(company);
  } catch (err) {
    console.error("create company error:", err);
    res.status(500).json({ error: "Failed to create company." });
  }
});

export default router;

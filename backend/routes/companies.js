/**
 * Companies — first-class entities that job roles belong to. A company is
 * created up front (name, industry, brand colour); roles are then created
 * under it. Kept intentionally lightweight (no separate auth/ownership model
 * — this is a single-workspace HR tool).
 */
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { readTable, insertRow, deleteRow } from "../services/store.js";

const router = Router();

const ACCENTS = ["#6366F1", "#0D9488", "#DB2777", "#D97706", "#0EA5E9", "#7C3AED", "#059669", "#DC2626"];
const initialsOf = (name) => (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const accentFor = (name) => { let h = 0; for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0; return ACCENTS[h % ACCENTS.length]; };

// GET /api/companies — all companies, with a live role count.
router.get("/companies", async (req, res) => {
  try {
    const companies = await readTable("companies");
    const jobs = await readTable("jobs");
    res.json(companies.map((c) => ({ ...c, roles: jobs.filter((j) => j.company?.id === c.id).length })));
  } catch (err) {
    console.error("list companies error:", err);
    res.status(500).json({ error: "Failed to load companies." });
  }
});

// GET /api/companies/:companyId
router.get("/companies/:companyId", async (req, res) => {
  const c = (await readTable("companies")).find((x) => x.id === req.params.companyId);
  if (!c) return res.status(404).json({ error: "Company not found." });
  res.json(c);
});

// POST /api/companies  { name, industry }
router.post("/companies", async (req, res) => {
  try {
    const { name, industry } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Company name is required." });

    const company = {
      id: uuidv4(),
      name: name.trim(),
      industry: industry?.trim() || "",
      accent: accentFor(name.trim()),
      initials: initialsOf(name.trim()),
    };
    await insertRow("companies", company);
    res.status(201).json(company);
  } catch (err) {
    console.error("create company error:", err);
    res.status(500).json({ error: "Failed to create company." });
  }
});

// DELETE /api/companies/:companyId — blocked while it still has any roles.
router.delete("/companies/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = (await readTable("companies")).find((c) => c.id === companyId);
    if (!company) return res.status(404).json({ error: "Company not found." });

    const roleCount = (await readTable("jobs")).filter((j) => j.company?.id === companyId).length;
    if (roleCount > 0) {
      return res.status(409).json({
        error: `Can't delete — ${company.name} still has ${roleCount} role${roleCount === 1 ? "" : "s"}. Delete ${roleCount === 1 ? "it" : "them"} first.`,
        role_count: roleCount,
      });
    }

    await deleteRow("companies", companyId);
    res.json({ ok: true, id: companyId });
  } catch (err) {
    console.error("delete company error:", err);
    res.status(500).json({ error: "Failed to delete company." });
  }
});

export default router;

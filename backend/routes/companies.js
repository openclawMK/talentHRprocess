/**
 * Companies — first-class entities that job roles belong to. A company is
 * created up front (name, industry, brand colour); roles are then created
 * under it. Also owns each company's client logins (see the /users routes
 * below) — a client user's company_id scopes their entire dashboard to that
 * company only, enforced server-side on every read.
 */
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { readTable, insertRow, deleteRow, writeTable } from "../services/store.js";
import { createUser } from "../services/authService.js";
import { createApiKey, listApiKeys, deleteApiKey } from "../services/apiKeyService.js";
import { guardCompanyParam } from "../middleware/companyScope.js";

const router = Router();
guardCompanyParam(router);

const ACCENTS = ["#6366F1", "#0D9488", "#DB2777", "#D97706", "#0EA5E9", "#7C3AED", "#059669", "#DC2626"];
const initialsOf = (name) => (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const accentFor = (name) => { let h = 0; for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0; return ACCENTS[h % ACCENTS.length]; };

// Company management (create/delete companies, manage their logins) is a
// PeopleQuest-staff action, not something a client login can do.
function requirePlatformAdmin(req, res) {
  if (req.user?.role !== "admin" || req.user?.company_id) {
    res.status(403).json({ error: "Only PeopleQuest staff can do this." });
    return false;
  }
  return true;
}

// GET /api/companies — all companies (with a live role count) for staff; a
// client login only ever sees their own single company in this list.
router.get("/companies", async (req, res) => {
  try {
    let companies = await readTable("companies");
    if (req.user?.company_id) companies = companies.filter((c) => c.id === req.user.company_id);
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
    if (!requirePlatformAdmin(req, res)) return;
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
    if (!requirePlatformAdmin(req, res)) return;
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

// --- Client logins --------------------------------------------------------

// GET /api/companies/:companyId/users — that company's logins (never the password hash).
router.get("/companies/:companyId/users", async (req, res) => {
  try {
    if (!requirePlatformAdmin(req, res)) return;
    const users = (await readTable("users")).filter((u) => u.company_id === req.params.companyId);
    res.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at })));
  } catch (err) {
    console.error("list company users error:", err);
    res.status(500).json({ error: "Failed to load logins." });
  }
});

// POST /api/companies/:companyId/users  { name, email, password }
// Creates a login scoped to this company only — everything they see (dashboard,
// candidates, alerts, the AI assistant) is filtered to this company_id.
router.post("/companies/:companyId/users", async (req, res) => {
  try {
    if (!requirePlatformAdmin(req, res)) return;
    const company = (await readTable("companies")).find((c) => c.id === req.params.companyId);
    if (!company) return res.status(404).json({ error: "Company not found." });

    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ error: "Name, email and an 8+ character password are required." });
    }
    const user = await createUser(name.trim(), email.trim(), password, req.params.companyId);
    res.status(201).json(user);
  } catch (err) {
    if (err.message?.includes("already exists")) return res.status(409).json({ error: err.message });
    console.error("create company user error:", err);
    res.status(500).json({ error: "Failed to create the login." });
  }
});

// DELETE /api/companies/:companyId/users/:userId
router.delete("/companies/:companyId/users/:userId", async (req, res) => {
  try {
    if (!requirePlatformAdmin(req, res)) return;
    const users = await readTable("users");
    const user = users.find((u) => u.id === req.params.userId && u.company_id === req.params.companyId);
    if (!user) return res.status(404).json({ error: "Login not found." });
    await writeTable("users", users.filter((u) => u.id !== req.params.userId));
    res.json({ ok: true, id: req.params.userId });
  } catch (err) {
    console.error("delete company user error:", err);
    res.status(500).json({ error: "Failed to delete the login." });
  }
});

// --- API keys ---------------------------------------------------------
// The machine-facing equivalent of a client login — same company scoping,
// used by a client's own system instead of a person in a browser.

// GET /api/companies/:companyId/api-keys — never returns the raw key or its hash.
router.get("/companies/:companyId/api-keys", async (req, res) => {
  try {
    if (!requirePlatformAdmin(req, res)) return;
    res.json(await listApiKeys(req.params.companyId));
  } catch (err) {
    console.error("list api keys error:", err);
    res.status(500).json({ error: "Failed to load API keys." });
  }
});

// POST /api/companies/:companyId/api-keys  { name }
// Returns the raw key exactly once — only its hash is ever stored.
router.post("/companies/:companyId/api-keys", async (req, res) => {
  try {
    if (!requirePlatformAdmin(req, res)) return;
    const company = (await readTable("companies")).find((c) => c.id === req.params.companyId);
    if (!company) return res.status(404).json({ error: "Company not found." });
    const key = await createApiKey(req.params.companyId, req.body?.name);
    res.status(201).json(key);
  } catch (err) {
    console.error("create api key error:", err);
    res.status(500).json({ error: "Failed to create the API key." });
  }
});

// DELETE /api/companies/:companyId/api-keys/:keyId
router.delete("/companies/:companyId/api-keys/:keyId", async (req, res) => {
  try {
    if (!requirePlatformAdmin(req, res)) return;
    const ok = await deleteApiKey(req.params.keyId, req.params.companyId);
    if (!ok) return res.status(404).json({ error: "API key not found." });
    res.json({ ok: true, id: req.params.keyId });
  } catch (err) {
    console.error("delete api key error:", err);
    res.status(500).json({ error: "Failed to delete the API key." });
  }
});

export default router;

/**
 * Self-service team management for a company's own Level 1 user — creating/
 * removing their own Level 2 (Manager/Supervisor) logins, and configuring
 * which permissions those Level 2 users have. Separate from companies.js's
 * "Client logins" panel, which stays PeopleQuest-staff-only and is only
 * ever used to onboard a company's very first (Level 1) account — once
 * that exists, everyday team management is the client's own job.
 */
import { Router } from "express";
import { readTable, writeTable } from "../services/store.js";
import { createUser } from "../services/authService.js";
import { PERMISSION_KEYS, getCompanyPermissions } from "../services/permissions.js";
import { logAction } from "../services/auditLog.js";

const router = Router();

function requireOwnCompanyLevel1(req, res) {
  if (!req.user?.company_id || req.user?.management_level !== 1) {
    res.status(403).json({ error: "Only a Level 1 user can manage their company's team." });
    return false;
  }
  return true;
}

// GET /api/team/users — this company's users (Level 1 + Level 2), never the password hash.
router.get("/team/users", async (req, res) => {
  try {
    if (!requireOwnCompanyLevel1(req, res)) return;
    const users = (await readTable("users")).filter((u) => u.company_id === req.user.company_id);
    res.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, management_level: u.management_level, created_at: u.created_at })));
  } catch (err) {
    console.error("list team users error:", err);
    res.status(500).json({ error: "Failed to load your team." });
  }
});

// POST /api/team/users  { name, email, password } — always creates a Level 2 user.
// A second Level 1 account (e.g. a co-founder) is intentionally not self-service —
// that still goes through PeopleQuest staff, same as onboarding the first one.
router.post("/team/users", async (req, res) => {
  try {
    if (!requireOwnCompanyLevel1(req, res)) return;
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ error: "Name, email and an 8+ character password are required." });
    }
    const user = await createUser(name.trim(), email.trim(), password, req.user.company_id, 2);
    await logAction(req, { action: "user.created", target_type: "user", target_id: user.id, after: { name: user.name, email: user.email, management_level: 2 } });
    res.status(201).json(user);
  } catch (err) {
    if (err.message?.includes("already exists")) return res.status(409).json({ error: err.message });
    console.error("create team user error:", err);
    res.status(500).json({ error: "Failed to create this login." });
  }
});

// DELETE /api/team/users/:userId — a Level 1 user can only remove their own
// company's Level 2 users, never another Level 1 account (that stays a
// PeopleQuest-staff action, so a company can never accidentally lock itself out).
router.delete("/team/users/:userId", async (req, res) => {
  try {
    if (!requireOwnCompanyLevel1(req, res)) return;
    const users = await readTable("users");
    const target = users.find((u) => u.id === req.params.userId && u.company_id === req.user.company_id);
    if (!target) return res.status(404).json({ error: "User not found." });
    if (target.management_level !== 2) return res.status(403).json({ error: "Contact PeopleQuest to remove a Level 1 account." });
    await writeTable("users", users.filter((u) => u.id !== req.params.userId));
    await logAction(req, { action: "user.removed", target_type: "user", target_id: target.id, before: { name: target.name, email: target.email } });
    res.json({ ok: true, id: req.params.userId });
  } catch (err) {
    console.error("delete team user error:", err);
    res.status(500).json({ error: "Failed to remove this user." });
  }
});

// GET /api/team/permissions — the effective Level 2 permission set for this company.
router.get("/team/permissions", async (req, res) => {
  try {
    if (!requireOwnCompanyLevel1(req, res)) return;
    res.json({ permissions: await getCompanyPermissions(req.user.company_id), keys: PERMISSION_KEYS });
  } catch (err) {
    console.error("get team permissions error:", err);
    res.status(500).json({ error: "Failed to load permissions." });
  }
});

// PUT /api/team/permissions  { permissions: { create_job: true, ... } }
router.put("/team/permissions", async (req, res) => {
  try {
    if (!requireOwnCompanyLevel1(req, res)) return;
    const incoming = req.body?.permissions;
    if (!incoming || typeof incoming !== "object") return res.status(400).json({ error: "permissions object is required." });

    // Merge onto the CURRENT state, not the bare defaults — otherwise toggling
    // one permission silently resets every other one back to default.
    const before = await getCompanyPermissions(req.user.company_id);
    const next = { ...before };
    for (const key of PERMISSION_KEYS) if (key in incoming) next[key] = !!incoming[key];

    const rows = await readTable("company_permissions");
    const idx = rows.findIndex((r) => r.company_id === req.user.company_id);
    const row = { company_id: req.user.company_id, level2_permissions: next, updated_at: new Date().toISOString() };
    if (idx === -1) rows.push(row); else rows[idx] = row;
    await writeTable("company_permissions", rows);

    await logAction(req, { action: "permissions.updated", target_type: "company_permissions", target_id: req.user.company_id, before, after: next });
    res.json({ permissions: next });
  } catch (err) {
    console.error("update team permissions error:", err);
    res.status(500).json({ error: "Failed to update permissions." });
  }
});

export default router;

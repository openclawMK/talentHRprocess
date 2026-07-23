/**
 * Machine-facing API — a client's own system (HRIS, careers site) pushes
 * roles and, eventually, candidates here directly, instead of a human using
 * the dashboard. Mounted at /api/v1 behind authenticateApiKey (see server.js),
 * which resolves the Authorization header to req.user.company_id — the exact
 * same field the dashboard's client logins use, so this reuses every
 * company-scoping guard already built rather than needing its own.
 */
import { Router } from "express";
import { createJobFromParams } from "../services/jobCreation.js";

const router = Router();

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

export default router;

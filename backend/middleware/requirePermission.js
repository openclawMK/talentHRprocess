/**
 * requirePermission(key) — blocks the request unless the caller (PeopleQuest
 * staff, a Level 1 user, or a Level 2 user with this key granted) is allowed.
 * The real gate — hiding a button on the frontend is never sufficient on its
 * own. Attaches req.permissions so handlers can branch further if needed
 * (e.g. view_all_jobs vs. assigned-only).
 */
import { resolvePermissions, canEditJob, canSeeJob } from "../services/permissions.js";
import { readTable } from "../services/store.js";

export function requirePermission(key) {
  return async (req, res, next) => {
    try {
      const permissions = await resolvePermissions(req.user);
      req.permissions = permissions;
      if (!permissions[key]) {
        return res.status(403).json({ error: "You don't have permission to do this." });
      }
      next();
    } catch (err) {
      console.error("requirePermission error:", err);
      res.status(500).json({ error: "Failed to verify permissions." });
    }
  };
}

/** For routes that need req.permissions but aren't gated by any single key. */
export async function attachPermissions(req, res, next) {
  try {
    req.permissions = await resolvePermissions(req.user);
    next();
  } catch (err) {
    console.error("attachPermissions error:", err);
    res.status(500).json({ error: "Failed to verify permissions." });
  }
}

/**
 * For routes with :jobId that mutate a job's own fields (criteria, scoring
 * weights, application form, pipeline). Needs edit_job AND ownership — "jobs
 * they created" per the spec, not just the permission flag alone. Attaches
 * req.job so the handler doesn't need a second read.
 */
export function requireEditJob(req, res, next) {
  resolvePermissions(req.user)
    .then(async (permissions) => {
      const jobs = await readTable("jobs");
      const job = jobs.find((j) => j.job_id === req.params.jobId);
      if (!job) return res.status(404).json({ error: "Job not found." });
      if (!canEditJob(req.user, permissions, job)) {
        return res.status(403).json({ error: "You don't have permission to edit this role." });
      }
      req.permissions = permissions;
      req.job = job;
      req.jobs = jobs;
      next();
    })
    .catch((err) => {
      console.error("requireEditJob error:", err);
      res.status(500).json({ error: "Failed to verify permissions." });
    });
}

/**
 * For candidate routes keyed by :jobId — checks the caller can see that job
 * (assigned/created, or view_all_jobs) before touching any of its
 * candidates, optionally also requiring a specific permission (review_cv,
 * add_comment, approve_reject_cv). Attaches req.permissions.
 */
export function requireCandidateAccess(permissionKey) {
  return async (req, res, next) => {
    try {
      const permissions = await resolvePermissions(req.user);
      req.permissions = permissions;
      if (req.user?.company_id) {
        const jobs = await readTable("jobs");
        const job = jobs.find((j) => j.job_id === req.params.jobId);
        if (!job) return res.status(404).json({ error: "Job not found." });
        if (!canSeeJob(req.user, permissions, job)) {
          return res.status(404).json({ error: "Not found." });
        }
      }
      if (permissionKey && !permissions[permissionKey]) {
        return res.status(403).json({ error: "You don't have permission to do this." });
      }
      next();
    } catch (err) {
      console.error("requireCandidateAccess error:", err);
      res.status(500).json({ error: "Failed to verify permissions." });
    }
  };
}

/** Level 1 (or PeopleQuest staff) only — for user/permission management and job archive/delete. */
export function requireLevel1(req, res, next) {
  const ok = !req.user?.company_id || req.user?.management_level === 1;
  if (!ok) return res.status(403).json({ error: "Only a Level 1 user can do this." });
  next();
}

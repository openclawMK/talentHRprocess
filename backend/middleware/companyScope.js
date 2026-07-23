/**
 * Company-scoped route guards for client logins. A client user (req.user.company_id
 * set) must never be able to reach another company's job/candidate data by any
 * route — not just have it filtered out of a dashboard. Express's router.param()
 * runs for EVERY route on the router that declares the named param, so registering
 * this once per router closes the door across list/detail/create/update/delete
 * routes alike, rather than requiring an audit of each handler individually.
 * Internal PeopleQuest staff (no company_id) are unaffected.
 */
import { readTable } from "../services/store.js";

export function guardJobParam(router) {
  router.param("jobId", async (req, res, next, jobId) => {
    if (!req.user?.company_id) return next();
    try {
      const job = (await readTable("jobs")).find((j) => j.job_id === jobId);
      if (!job || job.company?.id !== req.user.company_id) return res.status(404).json({ error: "Not found." });
      next();
    } catch (err) {
      next(err);
    }
  });
}

export function guardCompanyParam(router) {
  router.param("companyId", (req, res, next, companyId) => {
    if (!req.user?.company_id) return next();
    if (companyId !== req.user.company_id) return res.status(404).json({ error: "Not found." });
    next();
  });
}

/**
 * For handlers that take jobId/candidateId from the request BODY rather than
 * the URL (router.param can't see those) — e.g. /upload-cv, /score-candidate,
 * /ocean-assessment. Call after resolving the real job a candidate belongs to
 * (never a client-supplied job_id override, which could otherwise be used to
 * pass the check while still touching another company's candidate). Returns
 * false and has already sent the 404 response if out of scope.
 */
export function assertJobInScope(req, res, job) {
  if (!job) return false;
  if (req.user?.company_id && job.company?.id !== req.user.company_id) {
    res.status(404).json({ error: "Not found." });
    return false;
  }
  return true;
}

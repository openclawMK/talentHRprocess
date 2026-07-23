/**
 * Permission model for the two management levels. Deliberately NOT hardcoded
 * per job title or role name — every check goes through PERMISSION_KEYS +
 * resolvePermissions() so a future Level 3 or a custom role is a new row of
 * config, not a new code path.
 *
 * Level 1 ("C-suite / final decision maker"): every permission, always —
 * not configurable, so a Level 1 user can never lock themselves out.
 * Level 2 ("Manager / Supervisor"): whatever their company's
 * company_permissions row grants, defaulting to DEFAULT_LEVEL2_PERMISSIONS
 * for any key that company hasn't explicitly set.
 * PeopleQuest staff (role "admin", no company_id): every permission,
 * unrestricted, same as today — this system only governs client companies.
 *
 * Two things are level-gated absolutely, never permission-configurable,
 * per the spec: archiving/permanently deleting jobs, and managing users/
 * permissions. Those are checked directly against management_level, not
 * through this permission set.
 */
import { readTable } from "./store.js";

export const PERMISSION_KEYS = [
  "create_job",
  "edit_job",
  "view_all_jobs",
  "view_all_candidates",
  "review_cv",
  "add_comment",
  "approve_reject_cv",
  "export_data",
  "view_reports",
  "view_contact_info",
];

// Matches the spec's "Default permissions include" list for Level 2.
export const DEFAULT_LEVEL2_PERMISSIONS = {
  create_job: true,
  edit_job: true,
  view_all_jobs: false,
  view_all_candidates: false,
  review_cv: true,
  add_comment: true,
  approve_reject_cv: false,
  export_data: false,
  view_reports: false,
  view_contact_info: false,
};

const ALL_TRUE = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));

export async function getCompanyPermissions(companyId) {
  const rows = await readTable("company_permissions").catch(() => []);
  const row = rows.find((r) => r.company_id === companyId);
  return { ...DEFAULT_LEVEL2_PERMISSIONS, ...(row?.level2_permissions || {}) };
}

/** Resolves the full permission set for a given req.user. */
export async function resolvePermissions(user) {
  if (!user) return { ...Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) };
  if (!user.company_id) return { ...ALL_TRUE }; // PeopleQuest staff
  if (user.management_level === 1) return { ...ALL_TRUE };
  return getCompanyPermissions(user.company_id);
}

export function isLevel1(user) {
  return !user?.company_id || user.management_level === 1;
}

// "Jobs assigned or made available to them" — a Level 2 user without
// view_all_jobs only sees jobs they created or were explicitly assigned to.
export function canSeeJob(user, permissions, job) {
  if (isLevel1(user)) return true;
  if (permissions.view_all_jobs) return true;
  return job.created_by === user.id || (job.assigned_users || []).includes(user.id);
}

// "Edit job vacancies they created, subject to permission settings" — needs
// BOTH the edit_job permission AND ownership; edit_job alone doesn't grant
// editing every job in the company.
export function canEditJob(user, permissions, job) {
  if (isLevel1(user)) return true;
  if (!permissions.edit_job) return false;
  return job.created_by === user.id || (job.assigned_users || []).includes(user.id);
}

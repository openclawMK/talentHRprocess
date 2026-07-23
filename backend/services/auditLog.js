/**
 * One call per sensitive action — user creation/removal, permission changes,
 * job create/edit/archive/delete, CV comments, candidate approve/reject,
 * final hiring decisions. Best-effort: a logging failure never blocks the
 * action itself, it just gets console.error'd.
 */
import { appendAuditLog } from "./store.js";

export async function logAction(req, { action, target_type, target_id, before, after, companyId }) {
  try {
    await appendAuditLog({
      company_id: companyId ?? req.user?.company_id ?? null,
      user_id: req.user?.id ?? null,
      user_name: req.user?.name ?? null,
      action,
      target_type,
      target_id,
      before,
      after,
    });
  } catch (err) {
    console.error("audit log write failed:", err.message);
  }
}

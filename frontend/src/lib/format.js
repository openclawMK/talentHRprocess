// Shared formatting helpers and display constants.

export const LANE_META = {
  green: { label: "Strong match", bg: "#D1FAE5", text: "#065F46" },
  amber: { label: "Needs review", bg: "#FEF3C7", text: "#92400E" },
  red: { label: "Significant gaps", bg: "#FEE2E2", text: "#991B1B" },
  in_progress: { label: "In progress", bg: "#F3F4F6", text: "#4B5563" },
};

/**
 * The lane to DISPLAY. While a candidate is only partially scored (interview
 * and/or OCEAN still pending) we don't show a final match verdict — the
 * remaining stages could swing the result significantly.
 */
export function displayLane(score) {
  if (!score) return "in_progress";
  return score.full_score_available === false ? "in_progress" : score.lane;
}

// --- Two-phase scoring: screening (CV + OCEAN) then final (incl. interview) ---

export const SCREEN_PROCEED = 50; // >= this -> recommend interview
export const SCREEN_BORDERLINE = 35; // >= this -> borderline; below -> screen out

/**
 * A candidate's scoring phase:
 *  "awaiting"   — pre-interview stages not all done yet (e.g. OCEAN pending)
 *  "screening"  — CV + OCEAN done, only the interview is pending (gate decision)
 *  "complete"   — every enabled stage scored (final hire verdict available)
 */
export function candidateStatus(score) {
  if (!score) return "awaiting";
  if (score.full_score_available) return "complete";
  const pending = score.pending_sources || [];
  if (pending.length === 1 && pending[0] === "interview") return "screening";
  return "awaiting";
}

/** Normalized CV + OCEAN score (the pre-interview "screening" score), 0–100. */
export function screeningScore(score) {
  const items = (score?.criteria_scores || []).filter(
    (c) =>
      (c.source === "cv" || c.source === "ocean") &&
      c.scored && c.score != null && !c.not_applicable
  );
  const w = items.reduce((a, c) => a + (c.weight || 0), 0);
  if (!w) return null;
  return Math.round(items.reduce((a, c) => a + c.score * c.weight, 0) / w);
}

/** Screening verdict from a 0–100 screening score. */
export function screeningVerdict(s) {
  if (s == null) return null;
  if (s >= SCREEN_PROCEED)
    return { key: "proceed", lane: "green", short: "For interview", label: "Recommended for interview" };
  if (s >= SCREEN_BORDERLINE)
    return { key: "borderline", lane: "amber", short: "Borderline", label: "Borderline — review before interviewing" };
  return { key: "screen_out", lane: "red", short: "Screen out", label: "Below screening bar — consider screening out" };
}

export const SOURCE_META = {
  cv: { label: "CV", bg: "#DBEAFE", text: "#1D4ED8" },
  interview: { label: "Interview", bg: "#EDE9FE", text: "#6D28D9" },
  ocean: { label: "OCEAN", bg: "#D1FAE5", text: "#065F46" },
  hr_notes: { label: "HR", bg: "#FFF7ED", text: "#C2410C" },
};

export const DIMENSION_LABELS = {
  experience: "Experience",
  role_match: "Role match",
  skills: "Skills",
  education: "Education",
  progression: "Progression",
  stability: "Stability",
  age: "Age fit",
};

// Bar fill colour by score value.
export function barColor(value) {
  if (value > 70) return "#059669";
  if (value >= 40) return "#D97706";
  return "#DC2626";
}

// 26 -> "2 yrs 2 mo"
export function monthsToDuration(months) {
  if (months == null) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} yr${y > 1 ? "s" : ""}`);
  if (m) parts.push(`${m} mo`);
  return parts.length ? parts.join(" ") : "0 mo";
}

// Short experience summary line, e.g. "3 yrs F&B · SPM · Cheras"
export function experienceSummary(candidate, job) {
  const p = candidate.profile || {};
  const bits = [];
  if (p.total_experience_months != null) {
    const yrs = Math.round((p.total_experience_months / 12) * 10) / 10;
    const ind = (p.work_history && p.work_history[0]?.industry) || job?.industry || "";
    bits.push(`${yrs} yrs${ind ? " " + ind.split("/")[0].trim() : ""}`);
  }
  const edu = (p.education || [])[0]?.level;
  if (edu) bits.push(edu);
  if (p.contact?.location) bits.push(p.contact.location.split(",")[0].trim());
  return bits.join(" · ") || "Profile parsed";
}

export function truncate(str, n = 80) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

export function round(n) {
  return Math.round(Number(n) || 0);
}

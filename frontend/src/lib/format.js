// Shared formatting helpers and display constants.

export const LANE_META = {
  green: { label: "Strong match", bg: "#D1FAE5", text: "#065F46" },
  amber: { label: "Needs review", bg: "#FEF3C7", text: "#92400E" },
  red: { label: "Significant gaps", bg: "#FEE2E2", text: "#991B1B" },
};

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

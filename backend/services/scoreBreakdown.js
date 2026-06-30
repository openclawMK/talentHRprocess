/**
 * Score breakdown (Session 11) — explains WHY a candidate scored what they did.
 *
 * Produces a 3-layer breakdown (CV fit / Personality fit / Interview result),
 * each with plain-English contributing factors, plus strengths / risks /
 * missing-evidence. Pure rule-based + reuse of existing insight text — no AI
 * call, so it's cheap to refresh on every score change.
 */
import { sourceShares, sourceEnabled } from "./pipeline.js";

const lc = (s) => (s || "").toLowerCase();

function labelFor(score) {
  if (score == null) return "Pending";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "Partial";
  return "Weak";
}

function eduRank(level) {
  const l = lc(level);
  if (l.includes("phd") || l.includes("doctor")) return 100;
  if (l.includes("master")) return 90;
  if (l.includes("degree") || l.includes("bachelor")) return 80;
  if (l.includes("diploma") || l.includes("dpke")) return 70;
  if (l.includes("spm")) return 60;
  if (l.includes("pt3") || l.includes("pmr")) return 40;
  return level ? 50 : 20;
}

// Average score of the scored criteria for a given source.
function sourceScore(score, src) {
  const items = (score.criteria_scores || []).filter(
    (c) => c.source === src && c.scored && c.score != null && !c.not_applicable
  );
  const w = items.reduce((a, c) => a + (c.weight || 0), 0);
  if (!w) return null;
  return Math.round(items.reduce((a, c) => a + c.score * c.weight, 0) / w);
}

// ---- CV contributing factors (computed directly from profile vs requirements) ----
function cvFactors(candidate, job) {
  const p = candidate.profile || {};
  const req = job.requirements || {};
  const factors = [];

  // Experience
  const months = p.total_experience_months;
  if (months != null) {
    const yrs = Math.round((months / 12) * 10) / 10;
    const min = req.experience_years_min ?? 0;
    const pref = req.experience_years_preferred ?? min + 1;
    let verdict, impact;
    if (yrs >= pref) { verdict = `exceeds preferred of ${pref}`; impact = "positive"; }
    else if (yrs >= min) { verdict = `meets minimum of ${min}`; impact = "partial"; }
    else { verdict = `below minimum of ${min}`; impact = "negative"; }
    factors.push({ factor: "Experience", result: `${yrs} years — ${verdict}`, impact });
  }

  // Skills
  const have = (p.skills || []).map(lc);
  const required = req.required_skills || [];
  if (required.length) {
    const matched = required.filter((r) =>
      have.some((h) => h.includes(lc(r)) || lc(r).includes(h))
    ).length;
    const impact = matched >= required.length ? "positive" : matched >= required.length / 2 ? "partial" : "negative";
    factors.push({ factor: "Required skills", result: `${matched} of ${required.length} matched`, impact });
  }

  // Education
  if (req.education_level_min) {
    const highest = (p.education || []).reduce((m, e) => Math.max(m, eduRank(e.level)), 0);
    const needed = eduRank(req.education_level_min);
    const topLevel = (p.education || [])[0]?.level || "Not stated";
    const impact = highest >= needed ? "positive" : highest >= needed - 10 ? "partial" : "negative";
    factors.push({
      factor: "Education",
      result: `${topLevel} — ${highest >= needed ? "meets" : "below"} minimum (${req.education_level_min})`,
      impact,
    });
  }

  // Team size vs benchmark (skip for non-management roles)
  const benchTeam = job.benchmark?.avg_team_size || 0;
  if (benchTeam > 0) {
    const team = Math.max(0, ...(p.work_history || []).map((w) => w.team_size_managed || 0));
    const impact = team >= benchTeam ? "positive" : team > 0 ? "partial" : "negative";
    factors.push({
      factor: "Team supervision",
      result: `Managed ${team} staff — ${team >= benchTeam ? "meets" : "below"} benchmark of ${benchTeam}`,
      impact,
    });
  }

  return factors;
}

// ---- Personality contributing factors (from OCEAN traits) ----
function personalityFactors(candidate) {
  const t = candidate.ocean_traits;
  if (!t) return [];
  const band = (v) => (v >= 60 ? "high" : v >= 40 ? "moderate" : "low");
  const out = [];
  out.push({
    factor: "Conscientiousness",
    result: `${band(t.conscientiousness) === "high" ? "High — reliable and detail-oriented" : band(t.conscientiousness) === "moderate" ? "Moderate — generally dependable" : "Low — may need closer supervision"}`,
    impact: t.conscientiousness >= 60 ? "positive" : t.conscientiousness >= 40 ? "neutral" : "negative",
  });
  out.push({
    factor: "Emotional stability",
    result: `${t.emotional_stability >= 60 ? "Handles pressure well" : t.emotional_stability >= 40 ? "Generally composed" : "May struggle under pressure"}`,
    impact: t.emotional_stability >= 60 ? "positive" : t.emotional_stability >= 40 ? "neutral" : "negative",
  });
  out.push({
    factor: "Agreeableness",
    result: `${t.agreeableness >= 60 ? "Warm and cooperative" : t.agreeableness >= 40 ? "Cooperative but assertive" : "Direct, less accommodating"}`,
    impact: t.agreeableness >= 50 ? "positive" : "neutral",
  });
  return out;
}

// ---- Interview contributing factors (from scored interview criteria) ----
function interviewFactors(score) {
  return (score.criteria_scores || [])
    .filter((c) => c.source === "interview" && c.scored && c.score != null && !c.not_applicable)
    .map((c) => ({
      factor: c.criterion_name,
      result: `${labelFor(c.score)} (${c.score}%)`,
      impact: c.score >= 70 ? "positive" : c.score >= 50 ? "partial" : "negative",
    }));
}

// ---- Missing evidence (rule-based) ----
function missingEvidence(candidate, job) {
  const out = [];
  // Role Success Profile must-haves not evidenced in the CV come first.
  for (const m of candidate.score?.missing_must_haves || []) {
    out.push(`Missing must-have: ${m}`);
  }
  const pending = candidate.score?.pending_sources || [];
  if (pending.includes("interview")) out.push("Interview not yet completed — interview criteria unscored");
  if (pending.includes("ocean")) out.push("OCEAN assessment not yet completed");
  const have = (candidate.profile?.skills || []).map(lc);
  const required = job.requirements?.required_skills || [];
  for (const r of required) {
    if (!have.some((h) => h.includes(lc(r)) || lc(r).includes(h))) {
      out.push(`No clear evidence of "${r}" in CV`);
      if (out.length >= 5) break;
    }
  }
  return out.slice(0, 5);
}

/**
 * Build the full score breakdown object for a scored candidate.
 */
export function buildScoreBreakdown(candidate, job) {
  const score = candidate.score || {};
  const shares = sourceShares(job); // { cv, ocean, interview } redistributed

  const cvScore = score.cv_partial_score ?? sourceScore(score, "cv");
  const oceanScore = sourceScore(score, "ocean");
  const interviewScore = sourceScore(score, "interview");

  const oceanActive = sourceEnabled(job, "ocean");
  const interviewActive = sourceEnabled(job, "interview");

  return {
    cv_fit: {
      score: cvScore,
      label: labelFor(cvScore),
      weight_in_total: shares.cv ?? 0,
      status: "completed",
      contributing_factors: cvFactors(candidate, job),
    },
    personality_fit: {
      score: oceanScore,
      label: oceanActive ? labelFor(oceanScore) : "Not applicable",
      weight_in_total: shares.ocean ?? 0,
      status: !oceanActive ? "disabled" : candidate.ocean_completed ? "completed" : "pending",
      contributing_factors: personalityFactors(candidate),
    },
    interview_result: {
      score: interviewScore,
      label: interviewActive ? labelFor(interviewScore) : "Not applicable",
      weight_in_total: shares.interview ?? 0,
      status: !interviewActive ? "disabled" : candidate.interview_completed ? "completed" : "pending",
      contributing_factors: interviewFactors(score),
    },
    strengths: score.strengths || [],
    risks: [
      ...(score.dealbreakers_hit || []).map((d) => `Dealbreaker: ${d}`),
      ...(score.weaknesses || []),
    ],
    missing_evidence: missingEvidence(candidate, job),
  };
}

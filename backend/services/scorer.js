/**
 * Dynamic criteria scoring engine for People Hire (Session 6).
 *
 * Scores only the `cv`-source criteria from a job's criteria[] array, producing
 * a PARTIAL score. `interview` and `ocean` criteria stay pending until that data
 * is collected. The age criterion is scored against the job's age_band.
 */

import { sourceEnabled } from "./pipeline.js";
import { composeScore } from "./composite.js";

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
const lc = (s) => (s || "").toLowerCase();

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

// Collect a lowercased blob of skills + duties for keyword checks.
function profileText(candidate) {
  const p = candidate.profile || {};
  const duties = (p.work_history || []).flatMap((w) => w.duties || []);
  const titles = (p.work_history || []).map((w) => w.title || "");
  return lc([...(p.skills || []), ...duties, ...titles].join(" | "));
}

// ---- individual sub-scores ----
function experienceScore(candidate, job) {
  const months = candidate.profile.total_experience_months;
  if (months == null) return 40;
  const pref = (job.requirements.experience_years_preferred || 1) * 12;
  const min = (job.requirements.experience_years_min || 0) * 12;
  // Meeting "preferred" lands at 85 (strong, not perfect); 100 needs ~1.5x preferred.
  if (months >= pref) {
    const stretch = pref * 1.5;
    if (months >= stretch) return 100;
    return clamp(85 + (15 * (months - pref)) / (stretch - pref));
  }
  // Between minimum and preferred: 70 -> 85.
  if (months >= min) return pref === min ? 85 : clamp(70 + (15 * (months - min)) / (pref - min));
  // Below minimum: scale up to 70.
  return min === 0 ? 70 : clamp((70 * months) / min);
}

function educationScore(candidate, job) {
  const edu = candidate.profile.education || [];
  const highest = edu.reduce((m, e) => Math.max(m, eduRank(e.level)), 0);
  const required = eduRank(job.requirements.education_level_min);
  // Meeting the requirement = 80; each ~10-pt level above adds 10 (cap 100).
  if (highest >= required) return clamp(80 + (highest - required));
  const gap = required - highest;
  if (gap <= 10) return 60;
  if (gap <= 20) return 35;
  return 20;
}

function stabilityScore(candidate) {
  const avg = candidate.profile.avg_tenure_months;
  let s = avg == null ? 55 : avg >= 18 ? 90 : avg >= 12 ? 75 : avg >= 6 ? 55 : 30;
  if ((candidate.profile.employment_gaps || []).some((g) => (g.months || 0) > 6)) s -= 10;
  return clamp(s);
}

// Age is deliberately NOT scored (anti-discrimination). A criterion counts as an
// age criterion if "age" appears as a whole word — it is then excluded, never scored.
export const isAgeCriterion = (c) =>
  /\bage\b/.test(lc((c.name || "") + " " + (c.description || "")));

function supervisionScore(candidate) {
  const wh = candidate.profile.work_history || [];
  const titleHit = wh.some((w) => /(supervisor|manager|lead|leader)/.test(lc(w.title)));
  if (titleHit) return 90;
  const dutyHit = /(supervis|coordinat|train|shift lead|manage)/.test(profileText(candidate));
  const team = Math.max(0, ...wh.map((w) => w.team_size_managed || 0));
  if (dutyHit || team > 0) return 70;
  return 30;
}

function multilingualScore(candidate) {
  const n = (candidate.profile.languages || []).length;
  // Malaysian baseline is ~2 languages; reserve 100 for 4+.
  return n >= 4 ? 100 : n === 3 ? 88 : n === 2 ? 70 : n === 1 ? 40 : 25;
}

// Criteria matching one of these word groups are scored from a real parsed
// profile field (language count, title/team-size, education level, tenure,
// months of experience) — genuine regardless of industry. Everything else
// is scored generically instead of against a hand-written, industry-flavoured
// keyword list: no more list to accidentally match the wrong industry's
// vocabulary (e.g. a software engineer's "Technical proficiency" used to
// route into a forklift/machinery list and score 48).
const STRUCTURAL_GROUPS = [
  ["multilingual", "language"],
  ["supervis", "leadership", "team "],
  ["education", "qualification", "degree", "diploma", "ece", "dpke"],
  ["reliab", "stability", "tenure", "attendance", "punctual"],
  ["experience", "hospitality", "hotel", "warehouse", "logistics", "production", "factory", "retail", "childcare", "classroom"],
];

// Does this cv criterion get its score from a real profile field (true), or
// from the generic evidence check (false)? Exported so successFit.js's AI
// evidence-review pass knows which cv criteria need reviewing.
export function isStructuralCvCriterion(criterion) {
  const t = lc((criterion.name || "") + " " + (criterion.description || ""));
  return STRUCTURAL_GROUPS.some((words) => words.some((w) => t.includes(w)));
}

// The free-text "requirement" a cv criterion is evidence-checked against —
// same shape as a Success Profile must-have, just sourced from the
// criterion's own name/description instead of a hand-typed list.
export function criterionEvidenceText(criterion) {
  return criterion.description ? `${criterion.name}: ${criterion.description}` : criterion.name;
}

// Generic evidence-based score for any non-structural cv criterion: does the
// CV genuinely show evidence of what this criterion asks for? Same method
// (and the same AI double-check pass, via `overrides`) that already drives
// the real Success-Profile-fit score — so this is trusted like a genuine
// measurement (estimated: false), not a guess.
function genericEvidenceScore(candidate, criterion, overrides) {
  const met = hasEvidence(evidenceBlob(candidate), criterionEvidenceText(criterion), overrides);
  return { score: met ? 82 : 45, estimated: false };
}

// ---- route a single criterion to a sub-score ----
function scoreCriterion(criterion, candidate, job) {
  const t = lc(criterion.name + " " + (criterion.description || ""));
  const has = (...words) => words.some((w) => t.includes(w));
  if (has(...STRUCTURAL_GROUPS[0])) return { score: multilingualScore(candidate), estimated: false };
  if (has(...STRUCTURAL_GROUPS[1])) return { score: supervisionScore(candidate), estimated: false };
  if (has(...STRUCTURAL_GROUPS[2])) return { score: educationScore(candidate, job), estimated: false };
  if (has(...STRUCTURAL_GROUPS[3])) return { score: stabilityScore(candidate), estimated: false };
  if (has(...STRUCTURAL_GROUPS[4])) return { score: experienceScore(candidate, job), estimated: false };
  return genericEvidenceScore(candidate, criterion, candidate.evidence_overrides);
}

function benchmarkScore(candidate, job) {
  const b = job.benchmark || {};
  const parts = [];
  const months = candidate.profile.total_experience_months;
  if (months != null && b.avg_experience_years != null)
    parts.push(clamp(100 - Math.abs(months / 12 - b.avg_experience_years) * 20));
  if (b.avg_team_size && b.avg_team_size > 0) {
    const team = Math.max(0, ...(candidate.profile.work_history || []).map((w) => w.team_size_managed || 0));
    parts.push(clamp((team / b.avg_team_size) * 100));
  }
  return parts.length ? Math.round(parts.reduce((a, x) => a + x, 0) / parts.length) : 60;
}

const SP_STOP = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "with", "at", "for", "least",
  "years", "year", "minimum", "min", "experience", "strong", "ability", "staff",
  "no", "any", "kind", "explanation", "month", "months", "least", "good", "able",
  "have", "has", "must", "should", "record", "level", "work", "working",
  // Near-universal in a Malaysian CV (employer names, "Bahasa Malaysia" as a
  // language, location) regardless of domain — too common to be a useful
  // signal on its own; excluded from hasEvidence matching specifically.
  "malaysian", "malaysia",
]);

// Normalize text so "F&B" survives tokenization and matching is case-insensitive.
const spNorm = (s) => lc(s || "").replace(/f\s*&\s*b/g, "food beverage");

// Richer evidence blob: skills, duties, titles, employers, industries, languages, education.
export function evidenceBlob(candidate) {
  const p = candidate.profile || {};
  const wh = p.work_history || [];
  const parts = [
    ...(p.skills || []),
    ...wh.flatMap((w) => w.duties || []),
    ...wh.map((w) => w.title || ""),
    ...wh.map((w) => w.employer || ""),
    ...wh.map((w) => w.industry || ""),
    ...(p.languages || []),
    ...(p.education || []).map((e) => `${e.level || ""} ${e.field || ""}`),
    p.career_direction || "",
  ];
  return spNorm(parts.join(" | "));
}

// Does the CV show evidence for a free-text requirement? Lenient stemming for
// longer words (stem = first 5 chars, so supervise≈supervising); short,
// collision-prone words (<=4 chars, e.g. "bar", "law") require a whole-word
// match instead of a prefix, since a substring like "bar" would otherwise
// match inside unrelated words like "barista". A SINGLE coincidental token
// match is not enough to satisfy a whole multi-word requirement (e.g. one
// generic word appearing anywhere in the CV shouldn't confirm a specific claim
// like "Membership in the Malaysian Bar") — at least 2 distinct tokens must
// match once 2+ are available; a genuinely single-token requirement still
// needs just that one.
// `overrides` is the candidate's cached AI evidence-review verdicts (see
// successFit.js's refreshEvidenceOverrides) keyed by exact requirement text —
// checked first so a requirement genuinely met but worded differently in the
// CV (e.g. "prepares P&L and balance sheets" satisfying "Financial reporting")
// isn't wrongly marked unmet by the plain keyword match below.
export function hasEvidence(blob, requirement, overrides) {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, requirement)) {
    return overrides[requirement];
  }
  const tokens = spNorm(requirement)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !SP_STOP.has(t));
  if (!tokens.length) return true; // nothing concrete to check → no penalty
  const need = Math.min(2, tokens.length);
  const matched = tokens.filter((t) =>
    t.length <= 4 ? new RegExp(`\\b${t}\\b`).test(blob) : blob.includes(t.slice(0, 5))
  ).length;
  return matched >= need;
}

/**
 * Evaluate a candidate against the job's Role Success Profile (Session 12).
 * Returns missing must-haves, triggered dealbreakers, and a CV penalty.
 */
export function evaluateSuccessProfile(candidate, job) {
  const sp = job.successProfile;
  if (!sp) return { missing_must_haves: [], dealbreakers_hit: [], penalty: 0 };

  const text = evidenceBlob(candidate);
  const missing = (sp.must_haves || []).filter((m) => !hasEvidence(text, m, candidate.evidence_overrides));
  const penalty = Math.min(20, missing.length * 8);

  const dealbreakers_hit = [];
  for (const d of sp.dealbreakers || []) {
    const dl = lc(d);
    if (dl.includes("gap")) {
      const gaps = candidate.profile?.employment_gaps || [];
      if (gaps.some((g) => (g.months || 0) > 12)) dealbreakers_hit.push(d);
    } else if (dl.includes("supervis") || dl.includes("manage")) {
      const wh = candidate.profile?.work_history || [];
      const hasSup = wh.some(
        (w) => /(supervis|manager|lead|team lead)/.test(lc(w.title)) || (w.team_size_managed || 0) > 0
      );
      if (!hasSup) dealbreakers_hit.push(d);
    }
  }
  return { missing_must_haves: missing, dealbreakers_hit, penalty };
}

/**
 * Score a candidate against a job's dynamic criteria.
 */
export function scoreCandidate(candidate, job) {
  const criteria = job.criteria || [];

  const criteria_scores = criteria.map((c) => {
    if (c.source === "cv") {
      // Fairness: age is never scored — excluded so it can't affect the result.
      if (isAgeCriterion(c)) {
        return {
          criterion_id: c.id,
          criterion_name: c.name,
          source: "cv",
          weight: c.weight,
          score: null,
          scored: false,
          not_applicable: true,
          excluded_reason: "Age is excluded from scoring (fairness / anti-discrimination).",
          estimated: false,
        };
      }
      const { score, estimated } = scoreCriterion(c, candidate, job);
      // A criterion the router could only guess at (estimated: true) is
      // reported as not genuinely scored — the UI shows it as pending rather
      // than a fabricated, possibly-wrong number, and it's excluded from the
      // cv-average below rather than diluting it with a guess.
      return {
        criterion_id: c.id,
        criterion_name: c.name,
        source: "cv",
        weight: c.weight,
        score,
        scored: !estimated,
        estimated: !!estimated,
      };
    }
    return {
      criterion_id: c.id,
      criterion_name: c.name,
      source: c.source,
      weight: c.weight,
      score: null,
      scored: false,
      not_applicable: !sourceEnabled(job, c.source),
      estimated: false,
    };
  });

  const cvItems = criteria_scores.filter((c) => c.source === "cv" && !c.not_applicable && c.scored);
  const cvWeight = cvItems.reduce((a, c) => a + c.weight, 0);
  const rawCv = cvWeight
    ? Math.round(cvItems.reduce((a, c) => a + c.score * c.weight, 0) / cvWeight)
    : 0;
  const cv_coverage = Math.round(cvWeight * 100) / 100;

  // Role Success Profile: penalise missing must-haves, flag dealbreakers.
  const sp = evaluateSuccessProfile(candidate, job);
  const cv_partial_score = clamp(rawCv - sp.penalty);

  // Only enabled stages with criteria are "pending"; disabled stages are N/A.
  const pending_sources = ["interview", "ocean"].filter(
    (src) => sourceEnabled(job, src) && criteria.some((c) => c.source === src)
  );
  const full_score_available = pending_sources.length === 0;

  // Composite weighting model (OCEAN 15% / Success-Profile-fit 35% / Interview 50%).
  const comp = composeScore(candidate, job, criteria_scores);

  return {
    cv_partial_score,
    cv_coverage,
    pending_sources,
    full_score_available,
    benchmark_score: benchmarkScore(candidate, job),
    benchmark_maturity: job.benchmark?.maturity || "starter",
    criteria_scores,
    combined_score: comp.combined_score,
    screening_score: comp.screening_score,
    screening_pass: comp.screening_pass,
    pre_interview_max: comp.pre_interview_max,
    component_scores: comp.component_scores,
    lane: comp.lane,
    must_have_penalty: sp.penalty,
    missing_must_haves: sp.missing_must_haves,
    dealbreaker_triggered: sp.dealbreakers_hit.length > 0,
    dealbreakers_hit: sp.dealbreakers_hit,
  };
}

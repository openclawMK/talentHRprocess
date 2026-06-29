/**
 * Dynamic criteria scoring engine for PeopleQuest Talent AI (Session 6).
 *
 * Scores only the `cv`-source criteria from a job's criteria[] array, producing
 * a PARTIAL score. `interview` and `ocean` criteria stay pending until that data
 * is collected. The age criterion is scored against the job's age_band.
 */

import { sourceEnabled } from "./pipeline.js";

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

function ageScore(candidate, job) {
  const age = candidate.profile.age;
  const band = job.age_band;
  if (!band) return 100;
  if (age == null) return 60;
  const { min, ideal_min, ideal_max, max } = band;
  if (age >= ideal_min && age <= ideal_max) return 100;
  if (age >= min && age < ideal_min)
    return ideal_min === min ? 100 : clamp(60 + (40 * (age - min)) / (ideal_min - min));
  if (age > ideal_max && age <= max)
    return max === ideal_max ? 100 : clamp(100 - (40 * (age - ideal_max)) / (max - ideal_max));
  if (age < min) return clamp(60 - 10 * (min - age));
  return clamp(60 - 5 * (age - max));
}

function supervisionScore(candidate) {
  const wh = candidate.profile.work_history || [];
  const titleHit = wh.some((w) => /(supervisor|manager|lead|leader)/.test(lc(w.title)));
  if (titleHit) return 90;
  const dutyHit = /(supervis|coordinat|train|shift lead|manage)/.test(profileText(candidate));
  const team = Math.max(0, ...wh.map((w) => w.team_size_managed || 0));
  if (dutyHit || team > 0) return 70;
  return 30;
}

function keywordScore(candidate, kws, hit = 82, miss = 48) {
  const text = profileText(candidate);
  return kws.some((k) => text.includes(k)) ? hit : miss;
}

function multilingualScore(candidate) {
  const n = (candidate.profile.languages || []).length;
  // Malaysian baseline is ~2 languages; reserve 100 for 4+.
  return n >= 4 ? 100 : n === 3 ? 88 : n === 2 ? 70 : n === 1 ? 40 : 25;
}

// ---- route a single criterion to a sub-score ----
function scoreCriterion(criterion, candidate, job) {
  const t = lc(criterion.name + " " + (criterion.description || ""));
  const has = (...words) => words.some((w) => t.includes(w));
  // Whole-word match — avoids "age" matching "beverage"/"management" etc.
  const hasWord = (...words) => words.some((w) => new RegExp(`\\b${w}\\b`).test(t));

  if (hasWord("age")) return { score: ageScore(candidate, job), estimated: false };
  if (has("multilingual", "language")) return { score: multilingualScore(candidate), estimated: false };
  if (has("supervis", "leadership", "team ")) return { score: supervisionScore(candidate), estimated: false };
  if (has("cash", "pos", "reconcil", "till", "payment"))
    return { score: keywordScore(candidate, ["cash", "pos", "reconcil", "till", "payment"]), estimated: false };
  if (has("pms", "opera", "property management"))
    return { score: keywordScore(candidate, ["pms", "opera", "property management", "hotel system"], 90, 40), estimated: false };
  if (has("education", "qualification", "degree", "diploma", "ece", "dpke"))
    return { score: educationScore(candidate, job), estimated: false };
  if (has("reliab", "stability", "tenure", "attendance", "punctual"))
    return { score: stabilityScore(candidate), estimated: false };
  if (has("experience", "hospitality", "hotel", "warehouse", "logistics", "production", "factory", "retail", "childcare", "classroom"))
    return { score: experienceScore(candidate, job), estimated: false };
  if (has("customer", "guest", "service", "interaction"))
    return { score: keywordScore(candidate, ["customer", "guest", "service"], 85, 45), estimated: false };
  if (has("accuracy", "attention to detail", "record", "audit"))
    return { score: keywordScore(candidate, ["accuracy", "detail", "reconcil", "record", "audit"]), estimated: false };
  if (has("safety", "haccp", "hygiene", "compliance"))
    return { score: keywordScore(candidate, ["safety", "haccp", "hygiene", "compliance"]), estimated: false };
  if (has("upsell", "revenue"))
    return { score: keywordScore(candidate, ["upsell", "revenue", "sales"]), estimated: false };
  if (has("operations", "opening", "closing", "inventory", "scheduling", "sop"))
    return { score: keywordScore(candidate, ["opening", "closing", "inventory", "scheduling", "sop", "operations"]), estimated: false };
  if (has("product knowledge")) return { score: keywordScore(candidate, ["product"]), estimated: false };
  if (has("curriculum")) return { score: keywordScore(candidate, ["curriculum", "lesson", "syllabus"]), estimated: false };
  if (has("technical", "machinery", "equipment", "forklift"))
    return { score: keywordScore(candidate, ["machine", "technical", "equipment", "forklift", "operate"]), estimated: false };
  if (has("target", "kpi")) return { score: keywordScore(candidate, ["target", "kpi", "sales"]), estimated: false };

  return { score: 60, estimated: true }; // unknown cv criterion -> neutral estimate
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

/**
 * Score a candidate against a job's dynamic criteria.
 */
export function scoreCandidate(candidate, job) {
  const criteria = job.criteria || [];

  const criteria_scores = criteria.map((c) => {
    if (c.source === "cv") {
      const { score, estimated } = scoreCriterion(c, candidate, job);
      return {
        criterion_id: c.id,
        criterion_name: c.name,
        source: "cv",
        weight: c.weight,
        score,
        scored: true,
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

  const cvItems = criteria_scores.filter((c) => c.source === "cv");
  const cvWeight = cvItems.reduce((a, c) => a + c.weight, 0);
  const cv_partial_score = cvWeight
    ? Math.round(cvItems.reduce((a, c) => a + c.score * c.weight, 0) / cvWeight)
    : 0;
  const cv_coverage = Math.round(cvWeight * 100) / 100;

  // Only enabled stages with criteria are "pending"; disabled stages are N/A.
  const pending_sources = ["interview", "ocean"].filter(
    (src) => sourceEnabled(job, src) && criteria.some((c) => c.source === src)
  );
  const full_score_available = pending_sources.length === 0;

  const combined_score = cv_partial_score;
  const { green, red } = job.thresholds;
  let lane = "amber";
  if (combined_score >= green) lane = "green";
  else if (combined_score < red) lane = "red";

  return {
    cv_partial_score,
    cv_coverage,
    pending_sources,
    full_score_available,
    benchmark_score: benchmarkScore(candidate, job),
    benchmark_maturity: job.benchmark?.maturity || "starter",
    criteria_scores,
    combined_score,
    lane,
  };
}

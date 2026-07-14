/**
 * Success Profile fit — benchmark a candidate against the role's ideal-hire
 * definition (must-haves, nice-to-haves, dealbreakers, OCEAN, benchmarks) and
 * produce a single fit score + verdict.
 */
import { evidenceBlob, hasEvidence, evaluateSuccessProfile } from "./scorer.js";
import { getSalaryBenchmark, salaryExperienceFit } from "./salaryBenchmark.js";

const LEVEL_PCT = { low: 20, "medium-low": 40, medium: 60, "medium-high": 80, high: 100 };

// Map an OCEAN trait to the candidate's 0–100 value. For Neuroticism the ideal
// profile is expressed on the N axis, so we compare against neuroticism directly.
function traitValue(traits, key) {
  return {
    O: traits.openness, C: traits.conscientiousness, E: traits.extraversion,
    A: traits.agreeableness, N: traits.neuroticism,
  }[key];
}
const traitName = { O: "Openness", C: "Conscientiousness", E: "Extraversion", A: "Agreeableness", N: "Neuroticism" };

const fmtRM = (n) => `RM${Number(n).toLocaleString("en-MY")}`;

/**
 * Budget fit — compares a candidate's expected salary against the role's budget
 * range. This is a SEPARATE affordability signal; it never feeds the fit score.
 * Statuses: within / slightly_above / over / below / no_budget / unknown.
 */
export function computeBudgetFit(candidate, job) {
  const sp = job.successProfile || {};
  const expected = Number(candidate.profile?.expected_salary) || null;
  const min = Number(sp.salary_budget_min) || 0;
  const max = Number(sp.salary_budget_max) || 0;
  const hasBudget = min > 0 || max > 0;
  const rangeLabel = hasBudget ? `${min ? fmtRM(min) : "—"}–${max ? fmtRM(max) : "—"}` : null;

  if (!expected)
    return { expected: null, min, max, has_budget: hasBudget, status: "unknown", label: "Salary not provided", lane: "neutral", range_label: rangeLabel };
  if (!hasBudget)
    return { expected, expected_label: fmtRM(expected), min, max, has_budget: false, status: "no_budget", label: `Asking ${fmtRM(expected)}`, lane: "neutral", range_label: null };

  let status, label, lane;
  if (min > 0 && expected < min) { status = "below"; label = "Below range"; lane = "blue"; }
  else if (expected <= (max || Infinity)) { status = "within"; label = "Within budget"; lane = "green"; }
  else if (max > 0 && expected <= max * 1.1) { status = "slightly_above"; label = "Slightly above"; lane = "amber"; }
  else { status = "over"; label = "Over budget"; lane = "red"; }

  return { expected, expected_label: fmtRM(expected), min, max, has_budget: true, status, label, lane, range_label: rangeLabel };
}

/**
 * Profile-fit score (0-100) for the 35% scoring component: how well the CV
 * matches the Success Profile — must-haves, nice-to-haves, experience/team
 * benchmarks and salary-vs-experience. Personality is deliberately EXCLUDED
 * (it is its own 15% OCEAN component). Returns null when there is nothing to
 * evaluate (no Success Profile), so the caller can fall back to a CV baseline.
 */
export function computeProfileFit(candidate, job) {
  const sp = job.successProfile || {};
  const blob = evidenceBlob(candidate);
  const must = (sp.must_haves || []).map((t) => hasEvidence(blob, t));
  const nice = (sp.nice_to_haves || []).map((t) => hasEvidence(blob, t));

  const candExp = candidate.profile?.total_experience_months != null ? candidate.profile.total_experience_months / 12 : null;
  const benchExp = sp.benchmark_experience_years || 0;
  const benchTeam = sp.benchmark_team_size || 0;
  const candTeam = Math.max(0, ...(candidate.profile?.work_history || []).map((w) => w.team_size_managed || 0));
  const benchParts = [];
  if (benchExp > 0) benchParts.push(candExp == null ? 0 : Math.min(1, candExp / benchExp));
  if (benchTeam > 0) benchParts.push(candTeam >= benchTeam ? 1 : candTeam > 0 ? 0.5 : 0);

  const market = getSalaryBenchmark(job.role_title, job.location);
  const salFit = salaryExperienceFit(candidate.profile?.expected_salary, candExp, market);

  const comps = [];
  if (must.length) comps.push({ w: 0.45, v: must.filter(Boolean).length / must.length });
  if (nice.length) comps.push({ w: 0.15, v: nice.filter(Boolean).length / nice.length });
  if (benchParts.length) comps.push({ w: 0.25, v: benchParts.reduce((a, b) => a + b, 0) / benchParts.length });
  if (salFit != null) comps.push({ w: 0.15, v: salFit / 100 });
  if (!comps.length) return null; // no Success Profile signals — caller falls back

  const wsum = comps.reduce((a, c) => a + c.w, 0);
  let fit = Math.round((comps.reduce((a, c) => a + c.w * c.v, 0) / wsum) * 100);
  const evalSp = evaluateSuccessProfile(candidate, job);
  if (evalSp.dealbreakers_hit.length) fit = Math.max(0, fit - 35); // softened dealbreaker
  return fit;
}

/**
 * OCEAN personality score (0-100) for the 15% component. Uses alignment to the
 * role's ideal OCEAN profile when defined, else the average of positive-direction
 * traits. Null until the candidate completes the questionnaire.
 */
export function computeOceanScore(candidate, job) {
  const t = candidate.ocean_traits;
  if (!t) return null;
  const ideal = job.successProfile?.ideal_ocean_profile || {};
  const keys = Object.keys(ideal).filter((k) => traitName[k]);
  if (keys.length) {
    const matched = keys.filter((k) => {
      const target = LEVEL_PCT[ideal[k]] ?? 60;
      const actual = traitValue(t, k);
      return actual != null && Math.abs(actual - target) <= 25;
    }).length;
    return Math.round((matched / keys.length) * 100);
  }
  const vals = [t.openness, t.conscientiousness, t.extraversion, t.agreeableness, t.emotional_stability ?? 100 - (t.neuroticism ?? 0)].filter((v) => v != null);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

export function computeSuccessFit(candidate, job) {
  const sp = job.successProfile;
  if (!sp || !Object.keys(sp).length) return null;

  const blob = evidenceBlob(candidate);
  const must = (sp.must_haves || []).map((t) => ({ text: t, met: hasEvidence(blob, t) }));
  const nice = (sp.nice_to_haves || []).map((t) => ({ text: t, met: hasEvidence(blob, t) }));
  const evalSp = evaluateSuccessProfile(candidate, job);
  const dealbreakers = (sp.dealbreakers || []).map((t) => ({ text: t, triggered: evalSp.dealbreakers_hit.includes(t) }));

  // OCEAN alignment
  const traits = candidate.ocean_traits;
  const ideal = sp.ideal_ocean_profile || {};
  let ocean = null;
  if (traits) {
    ocean = Object.keys(ideal).filter((k) => traitName[k]).map((k) => {
      const target = LEVEL_PCT[ideal[k]] ?? 60;
      const actual = traitValue(traits, k);
      return { trait: traitName[k], key: k, ideal: ideal[k], actual, match: actual != null && Math.abs(actual - target) <= 25 };
    });
  }

  // Benchmarks
  const benchExp = sp.benchmark_experience_years || 0;
  const candExp = candidate.profile?.total_experience_months != null ? Math.round((candidate.profile.total_experience_months / 12) * 10) / 10 : null;
  const benchTeam = sp.benchmark_team_size || 0;
  const candTeam = Math.max(0, ...(candidate.profile?.work_history || []).map((w) => w.team_size_managed || 0));
  const benchmarks = [];
  if (benchExp > 0) benchmarks.push({ label: "Experience", target: `${benchExp} yrs`, actual: candExp != null ? `${candExp} yrs` : "—", met: candExp != null && candExp >= benchExp });
  if (benchTeam > 0) benchmarks.push({ label: "Team size led", target: `${benchTeam}`, actual: `${candTeam}`, met: candTeam >= benchTeam });

  // ---- overall fit % (weighted over applicable components) ----
  const comps = [];
  if (must.length) comps.push({ w: 0.45, v: must.filter((m) => m.met).length / must.length });
  if (nice.length) comps.push({ w: 0.15, v: nice.filter((m) => m.met).length / nice.length });
  if (ocean && ocean.length) comps.push({ w: 0.25, v: ocean.filter((o) => o.match).length / ocean.length });
  if (benchmarks.length) comps.push({ w: 0.15, v: benchmarks.filter((b) => b.met).length / benchmarks.length });
  const wsum = comps.reduce((a, c) => a + c.w, 0) || 1;
  let fit = Math.round((comps.reduce((a, c) => a + c.w * c.v, 0) / wsum) * 100);

  // A dealbreaker is a strong negative, not an automatic zero — apply a heavy
  // penalty (so it still lands red) but keep the underlying fit visible, since a
  // lexical/parsing miss shouldn't crush an otherwise-strong candidate to nothing.
  const hasDealbreaker = dealbreakers.some((d) => d.triggered);
  if (hasDealbreaker) fit = Math.max(0, fit - 35);

  const verdict = hasDealbreaker ? "Dealbreaker — review" : fit >= 75 ? "Strong fit" : fit >= 50 ? "Partial fit" : "Weak fit";
  const lane = hasDealbreaker || fit < 50 ? "red" : fit >= 75 ? "green" : "amber";

  return {
    fit, verdict, lane,
    must_haves: must, nice_to_haves: nice, dealbreakers,
    ocean, benchmarks,
    budget: computeBudgetFit(candidate, job),
    has_ocean: !!traits,
    summary: sp.summary || "",
  };
}

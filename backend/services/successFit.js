/**
 * Success Profile fit — benchmark a candidate against the role's ideal-hire
 * definition (must-haves, nice-to-haves, dealbreakers, OCEAN, benchmarks) and
 * produce a single fit score + verdict.
 */
import { evidenceBlob, hasEvidence, evaluateSuccessProfile, isStructuralCvCriterion, criterionEvidenceText, isAgeCriterion } from "./scorer.js";
import { getSalaryBenchmark, salaryExperienceFit } from "./salaryBenchmark.js";
import { chatJSON } from "./aiClient.js";

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
  const must = (sp.must_haves || []).map((t) => hasEvidence(blob, t, candidate.evidence_overrides));
  const nice = (sp.nice_to_haves || []).map((t) => hasEvidence(blob, t, candidate.evidence_overrides));

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
  const must = (sp.must_haves || []).map((t) => ({
    text: t, met: hasEvidence(blob, t, candidate.evidence_overrides),
    self_declared: candidate.self_declared?.[t] ?? null,
  }));
  const nice = (sp.nice_to_haves || []).map((t) => ({ text: t, met: hasEvidence(blob, t, candidate.evidence_overrides) }));
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

  // Overall fit % is computeProfileFit()'s number — the SAME 35%-weighted
  // figure shown on the Score Breakdown card — not a separately-derived
  // value, so this panel and that card can never disagree the way they used
  // to. That formula deliberately excludes OCEAN (personality already has
  // its own separate 15% slice of the overall score, and its own dashboard
  // — folding it in here too would double-count it) and gives partial
  // credit on benchmarks/salary rather than the pass/fail scoring below,
  // which exists for a human reading this panel, not for the percentage.
  const fit = computeProfileFit(candidate, job) ?? 0;

  // computeProfileFit() already applies the dealbreaker penalty to `fit` —
  // this just drives the verdict/lane labels off the same trigger.
  const hasDealbreaker = dealbreakers.some((d) => d.triggered);

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

/**
 * Folds a completed voice-screen assessment into evidence_overrides — the
 * same cache computeProfileFit() reads for every must-have/nice-to-have. The
 * CV says what the candidate claims; the call is where that claim actually
 * gets tested out loud, so a clear result there should outrank a keyword
 * match against the CV text. Only confident results move the needle: a
 * requirement the candidate visibly substantiated (score >= 70) is marked
 * met, one they admitted lacking or clearly failed to substantiate (score
 * <= 30) is marked unmet, and anything in between (vague, or "not covered"
 * in this call) is left exactly as the CV-based check already had it — this
 * call only ever narrows uncertainty, never invents evidence for a topic it
 * didn't actually get to. Call this once per completed voice screen, before
 * the next score_breakdown / profile_fit computation.
 */
export function applyVoiceScreenEvidence(candidate, assessment) {
  const notes = assessment?.criteria_notes || [];
  if (!notes.length) return;
  const overrides = candidate.evidence_overrides || {};
  for (const n of notes) {
    if (!n?.criterion || n.score == null) continue;
    if (n.score >= 70) overrides[n.criterion] = true;
    else if (n.score <= 30) overrides[n.criterion] = false;
  }
  candidate.evidence_overrides = overrides;
}

/**
 * Two-directional AI correction for hasEvidence()'s keyword matching: re-checks
 * EVERY must-have/nice-to-have/cv-criterion the keyword pass hasn't already had
 * reviewed, whether the keyword pass called it met or unmet — a keyword hit
 * (e.g. two unrelated tokens both appearing in the CV) can be a false positive
 * just as easily as a genuine requirement can be missed. Also covers every
 * non-structural cv-source criterion (scorer.js's scoreCriterion() scores those
 * generically via hasEvidence() too — see isStructuralCvCriterion) so a CV
 * criterion's score gets the same AI-backed accuracy a Success Profile
 * must-have already gets, not just a raw keyword match. Result is cached on
 * candidate.evidence_overrides (keyed by exact requirement text) so it's
 * computed once per requirement and reused on every future scoring pass —
 * this keeps repeated scoring deterministic instead of re-asking the AI (and
 * risking a different answer) every time OCEAN/interview/notes refresh the
 * recommendation. Call BEFORE the scoring functions above, since they read
 * candidate.evidence_overrides synchronously.
 */
export async function refreshEvidenceOverrides(candidate, job) {
  const sp = job.successProfile || {};
  const overrides = candidate.evidence_overrides || {};
  const cvCriteriaTexts = (job.criteria || [])
    .filter((c) => c.source === "cv" && !isAgeCriterion(c) && !isStructuralCvCriterion(c))
    .map((c) => criterionEvidenceText(c));
  const allReqs = [...(sp.must_haves || []), ...(sp.nice_to_haves || []), ...cvCriteriaTexts];
  const toCheck = allReqs.filter((t) => !Object.prototype.hasOwnProperty.call(overrides, t));
  if (!toCheck.length) return;

  try {
    const result = await chatJSON({
      system:
        "You are a meticulous HR analyst reviewing whether a candidate's CV genuinely evidences each requirement, " +
        "even when worded differently from the CV (e.g. 'prepares monthly P&L and balance sheets' satisfies 'Financial " +
        "reporting'; a Bachelor's in Accounting plus ACCA satisfies 'Accounting or finance qualification'). Do not give " +
        "credit for vague, unrelated, or merely plausible-sounding evidence — only genuine matches. Return valid JSON only.",
      user: `Work history: ${JSON.stringify(candidate.profile?.work_history || [])}
Education: ${JSON.stringify(candidate.profile?.education || [])}
Certifications: ${JSON.stringify(candidate.profile?.certifications || [])}
Skills: ${JSON.stringify(candidate.profile?.skills || [])}

For EACH requirement below, decide true only if the evidence above genuinely satisfies it:
${toCheck.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Return: { "results": [{ "requirement": "<exact text as given>", "met": true|false }] }`,
      temperature: 0,
    });
    for (const r of result.results || []) {
      if (toCheck.includes(r.requirement)) overrides[r.requirement] = !!r.met;
    }
    candidate.evidence_overrides = overrides;
  } catch (e) {
    console.error("refreshEvidenceOverrides error:", e.message); // leave uncached — retried next scoring pass
  }
}

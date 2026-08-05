/**
 * Composite scoring (the configurable weighting model).
 *
 *   Combined = OCEAN·15% + Success-Profile-fit·35% + Interview·50%   (weights adjustable)
 *
 * The score ACCUMULATES: with only OCEAN + profile scored (pre-interview) the max
 * is 50/100; the interview unlocks the remaining 50. Screening pass and lane colour
 * both judge the score RELATIVE to what's been scored so far (e.g. profile+ocean
 * pre-interview), so candidates aren't penalised for being partially assessed —
 * a flawless pre-interview candidate should be able to actually pass screening.
 * Final hire bar ≥ 72/100 (that one is judged on the full absolute score).
 */
import { computeProfileFit, computeOceanScore } from "./successFit.js";

export const DEFAULT_WEIGHTS = { ocean: 0.15, profile: 0.35, interview: 0.5 };
export const SCREENING_PASS = 70; // % of whatever's been scored so far (profile+ocean pre-interview)
export const HIRE_THRESHOLD = 72;

function avgBySource(criteria, src) {
  const items = (criteria || []).filter((c) => c.source === src && c.scored && c.score != null && !c.not_applicable);
  const w = items.reduce((a, c) => a + (c.weight || 0), 0);
  if (!w) return null;
  return Math.round(items.reduce((a, c) => a + c.score * c.weight, 0) / w);
}

export function scoreWeights(job) {
  const w = { ...DEFAULT_WEIGHTS, ...(job.score_weights || {}) };
  const sum = w.ocean + w.profile + w.interview || 1;
  return { ocean: w.ocean / sum, profile: w.profile / sum, interview: w.interview / sum };
}

/**
 * @returns {{ combined_score, screening_score, pre_interview_max, component_scores,
 *   screening_pass, interview_done, ocean_done, lane }}
 */
export function composeScore(candidate, job, criteria) {
  const crit = criteria || candidate.score?.criteria_scores || [];
  const W = scoreWeights(job);

  const cvAvg = avgBySource(crit, "cv");
  let profile = computeProfileFit(candidate, job);
  if (profile == null) profile = cvAvg; // no Success Profile → fall back to CV baseline
  const ocean = computeOceanScore(candidate, job);
  const interview = avgBySource(crit, "interview");

  const oceanDone = ocean != null;
  const interviewDone = interview != null;
  const profileDone = profile != null;

  const part = (done, w, v) => (done ? w * v : 0);
  const combined = Math.round(part(profileDone, W.profile, profile) + part(oceanDone, W.ocean, ocean) + part(interviewDone, W.interview, interview));
  const screening = Math.round(part(profileDone, W.profile, profile) + part(oceanDone, W.ocean, ocean));
  const preInterviewMax = Math.round((W.profile + W.ocean) * 100);

  // Both screening pass and lane colour judge the score relative to weights
  // actually scored so far, so candidates aren't penalised for being partial.
  const availW = part(profileDone, W.profile, 1) + part(oceanDone, W.ocean, 1) + part(interviewDone, W.interview, 1);
  const relative = availW > 0 ? combined / availW : 0;
  const availPreInterviewW = part(profileDone, W.profile, 1) + part(oceanDone, W.ocean, 1);
  // Same convention as `relative` above: `screening` is already on a 0-100
  // points scale, availPreInterviewW is a weight FRACTION (e.g. 0.5) - so
  // dividing already yields the right percentage. The extra *100 that used
  // to be here inflated this 100x (e.g. 50% became "5000"), meaning
  // screening_pass was true for virtually any candidate with a nonzero
  // pre-interview score, regardless of how weak it actually was.
  const relativeScreening = availPreInterviewW > 0 ? screening / availPreInterviewW : 0;
  const green = job.thresholds?.green ?? HIRE_THRESHOLD;
  const red = job.thresholds?.red ?? 45;
  const lane = relative >= green ? "green" : relative < red ? "red" : "amber";

  return {
    combined_score: combined,
    screening_score: screening,
    pre_interview_max: preInterviewMax,
    component_scores: {
      profile_fit: profileDone ? Math.round(profile) : null,
      ocean: oceanDone ? ocean : null,
      interview: interviewDone ? interview : null,
      weights: W,
    },
    screening_pass: availPreInterviewW > 0 && relativeScreening >= SCREENING_PASS,
    interview_done: interviewDone,
    ocean_done: oceanDone,
    lane,
  };
}

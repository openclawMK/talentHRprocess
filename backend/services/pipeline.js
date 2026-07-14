/**
 * Pipeline stage configuration + weight redistribution (Session 9).
 *
 * A job's pipeline_stages controls which scoring sources are active.
 * CV and Offer are always-on (locked); OCEAN and Interview are toggleable.
 * When a stage is disabled, criteria tied to its source become "not applicable"
 * and the remaining active criteria are redistributed so their weights sum to 1.0.
 */

import { recomputeCombined } from "./oceanScorer.js";

// Map a criterion source to the pipeline stage that produces it.
const SOURCE_STAGE = { cv: "cv_submission", ocean: "ocean_assessment", interview: "interview" };

export const DEFAULT_PIPELINE = {
  cv_submission: { enabled: true, locked: true },
  ocean_assessment: { enabled: true, locked: false },
  interview: { enabled: true, locked: false },
  offer: { enabled: true, locked: true },
};

/** Is a criterion source currently active for this job? CV is always active. */
export function sourceEnabled(job, source) {
  if (source === "cv") return true;
  const stages = job.pipeline_stages || DEFAULT_PIPELINE;
  const stageKey = SOURCE_STAGE[source];
  if (!stageKey) return true;
  return stages[stageKey]?.enabled !== false;
}

/** Ordered list of stages for progress display, with enabled/locked flags. */
export function pipelineStageList(job) {
  const stages = job.pipeline_stages || DEFAULT_PIPELINE;
  return ["cv_submission", "ocean_assessment", "interview", "offer"].map((key) => ({
    key,
    enabled: stages[key]?.enabled !== false,
    locked: stages[key]?.locked === true,
  }));
}

/**
 * Return the job's criteria annotated with `active` and redistributed `weight_active`.
 * Active criteria's weight_active sums to 1.0; inactive criteria get weight_active 0.
 */
export function redistribute(job) {
  const criteria = job.criteria || [];
  const activeWeight = criteria
    .filter((c) => sourceEnabled(job, c.source))
    .reduce((a, c) => a + (c.weight || 0), 0);

  return criteria.map((c) => {
    const active = sourceEnabled(job, c.source);
    return {
      ...c,
      active,
      weight_active:
        active && activeWeight > 0 ? Math.round((c.weight / activeWeight) * 10000) / 10000 : 0,
    };
  });
}

/**
 * Re-apply not_applicable flags to a candidate's stored score and recompute
 * the combined score. Called after the pipeline is toggled so existing
 * candidates reflect the new stage configuration.
 */
export function reconcileCandidate(candidate, job) {
  const score = candidate.score;
  if (!score || !Array.isArray(score.criteria_scores)) return;
  score.criteria_scores = score.criteria_scores.map((cs) => ({
    ...cs,
    not_applicable: !sourceEnabled(job, cs.source),
  }));
  recomputeCombined(candidate, job);
}

/**
 * The pipeline stage a candidate currently sits at (for analytics / funnel).
 * Returns one of: cv_submission | ocean_assessment | interview | offer | rejected.
 */
export function candidateStageKey(candidate, job) {
  if (candidate.outcome === "rejected") return "rejected";
  if (candidate.outcome === "offer") return "offer";
  if (sourceEnabled(job, "ocean") && !candidate.ocean_completed) return "ocean_assessment";
  if (sourceEnabled(job, "interview") && !candidate.interview_completed) return "interview";
  return "offer"; // all assessment stages done, awaiting the human offer decision
}

/** Per-source share of the active score, e.g. { cv: 0.41, ocean: 0.18, interview: 0.41 }. */
export function sourceShares(job) {
  const redist = redistribute(job);
  const shares = {};
  for (const c of redist) {
    if (!c.active) continue;
    shares[c.source] = (shares[c.source] || 0) + c.weight_active;
  }
  for (const k of Object.keys(shares)) shares[k] = Math.round(shares[k] * 100) / 100;
  return shares;
}

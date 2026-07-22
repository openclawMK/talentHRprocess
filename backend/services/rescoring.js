/**
 * Re-scores every already-scored candidate for a job after its scoring
 * weights change (top-level model split, or a criterion's weight). Recombines
 * EXISTING sub-scores at the new weights — never re-parses a CV, re-runs
 * OCEAN, or re-interviews. Mirrors the same steps runScoring/refreshIntelligence
 * already do per-candidate, just applied across the whole role at once.
 */
import { readTable, writeTable } from "./store.js";
import { recomputeCombined } from "./oceanScorer.js";
import { buildScoreBreakdown } from "./scoreBreakdown.js";
import { generateRecommendation } from "./recommendationEngine.js";
import { refreshEvidenceOverrides } from "./successFit.js";

export async function rescoreJobCandidates(job) {
  const candidates = await readTable("candidates");
  let changed = 0;
  for (const c of candidates) {
    if (c.job_id !== job.job_id || !c.score) continue;
    await refreshEvidenceOverrides(c, job);
    recomputeCombined(c, job);
    c.score_breakdown = buildScoreBreakdown(c, job);
    c.recommendation = await generateRecommendation(c, job);
    changed++;
  }
  if (changed) await writeTable("candidates", candidates);
  return changed;
}

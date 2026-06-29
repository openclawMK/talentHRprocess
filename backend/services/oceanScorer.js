/**
 * OCEAN (Big Five) assessment — BFI-10 short form.
 * Scores the `ocean`-source criteria once a candidate completes the
 * questionnaire, then recomputes the combined score over all scored criteria.
 */

// BFI-10 (Rammstedt & John, 2007). Each item: "I see myself as someone who…"
export const OCEAN_ITEMS = [
  { id: "q1", text: "is reserved", trait: "E", reverse: true },
  { id: "q2", text: "is generally trusting", trait: "A", reverse: false },
  { id: "q3", text: "tends to be lazy", trait: "C", reverse: true },
  { id: "q4", text: "is relaxed and handles stress well", trait: "N", reverse: true },
  { id: "q5", text: "has few artistic interests", trait: "O", reverse: true },
  { id: "q6", text: "is outgoing and sociable", trait: "E", reverse: false },
  { id: "q7", text: "tends to find fault with others", trait: "A", reverse: true },
  { id: "q8", text: "does a thorough job", trait: "C", reverse: false },
  { id: "q9", text: "gets nervous easily", trait: "N", reverse: false },
  { id: "q10", text: "has an active imagination", trait: "O", reverse: false },
];

const TRAIT_KEYS = { O: "openness", C: "conscientiousness", E: "extraversion", A: "agreeableness", N: "neuroticism" };

/**
 * @param {Object} responses map of itemId -> 1..5
 * @returns trait scores 0-100 plus emotional_stability (inverse of neuroticism)
 */
export function computeTraits(responses) {
  const byTrait = { O: [], C: [], E: [], A: [], N: [] };
  for (const item of OCEAN_ITEMS) {
    let v = Number(responses?.[item.id]);
    if (!v || v < 1 || v > 5) v = 3; // default neutral if missing
    if (item.reverse) v = 6 - v;
    byTrait[item.trait].push(v);
  }
  const scale = (arr) =>
    arr.length ? Math.round(((arr.reduce((a, b) => a + b, 0) / arr.length - 1) / 4) * 100) : 50;

  const traits = {};
  for (const k of Object.keys(byTrait)) traits[TRAIT_KEYS[k]] = scale(byTrait[k]);
  traits.emotional_stability = 100 - traits.neuroticism;
  return traits;
}

// Map an ocean criterion to the most relevant trait score.
export function scoreOceanCriterion(criterion, traits) {
  const t = (criterion.name + " " + (criterion.description || "")).toLowerCase();
  if (/neurotic|stress|composure|emotional stabil|calm|pressure/.test(t)) return traits.emotional_stability;
  if (/conscien|reliab|diligence|initiative|punctual|thorough|attendance|detail/.test(t)) return traits.conscientiousness;
  if (/agreeable|warmth|warm|empath|friendl/.test(t)) return traits.agreeableness;
  if (/extravers|outgoing|persuasi|sociab|assert/.test(t)) return traits.extraversion;
  if (/openness|imagination|creativ|curios/.test(t)) return traits.openness;
  // fallback: average of the positively-keyed traits
  return Math.round(
    (traits.openness + traits.conscientiousness + traits.extraversion + traits.agreeableness + traits.emotional_stability) / 5
  );
}

/**
 * Apply OCEAN trait scores to a candidate's score object (mutates it) and
 * recompute the combined score / coverage / pending sources.
 */
export function applyOceanScores(candidate, job, traits) {
  const score = candidate.score;
  if (!score) return;

  const jobCriteria = job.criteria || [];
  score.criteria_scores = (score.criteria_scores || []).map((cs) => {
    if (cs.source !== "ocean") return cs;
    const def = jobCriteria.find((c) => c.id === cs.criterion_id) || cs;
    return { ...cs, score: scoreOceanCriterion(def, traits), scored: true, estimated: false };
  });

  recomputeCombined(score, job);
  candidate.ocean_traits = traits;
  candidate.ocean_completed = true;
}

// Recompute combined score over ALL currently-scored criteria (cv + ocean + interview).
export function recomputeCombined(score, job) {
  const all = score.criteria_scores || [];
  // Not-applicable criteria (disabled pipeline stages) never count.
  const scored = all.filter((c) => c.scored && c.score != null && !c.not_applicable);
  const scoredWeight = scored.reduce((a, c) => a + c.weight, 0);
  const combined = scoredWeight
    ? Math.round(scored.reduce((a, c) => a + c.score * c.weight, 0) / scoredWeight)
    : 0;

  const pending = ["interview", "ocean"].filter((s) =>
    all.some((c) => c.source === s && !c.scored && !c.not_applicable)
  );

  score.combined_score = combined;
  score.scored_coverage = Math.round(scoredWeight * 100) / 100;
  score.pending_sources = pending;
  score.full_score_available = pending.length === 0;

  const { green, red } = job.thresholds;
  score.lane = combined >= green ? "green" : combined < red ? "red" : "amber";
  return score;
}

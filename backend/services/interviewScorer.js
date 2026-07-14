/**
 * Interview scoring — applies HR-provided criterion ratings and recomputes combined score.
 * Mirrors the pattern used by oceanScorer.js.
 */
import { recomputeCombined } from "./oceanScorer.js";

/**
 * Apply HR-provided ratings for interview-source criteria and recompute combined score.
 * @param {Object} candidate - mutated in place
 * @param {Object} job
 * @param {Array}  ratings  - [{ criterion_id, score: 0-100, notes: string|null }]
 */
export function applyInterviewScores(candidate, job, ratings) {
  const score = candidate.score;
  if (!score) return;

  const ratingMap = Object.fromEntries(ratings.map((r) => [r.criterion_id, r]));

  score.criteria_scores = (score.criteria_scores || []).map((cs) => {
    if (cs.source !== "interview") return cs;
    const rating = ratingMap[cs.criterion_id];
    if (!rating) return cs;
    return {
      ...cs,
      score: Math.max(0, Math.min(100, Math.round(Number(rating.score)))),
      hr_notes: rating.notes || null,
      questions_asked: Array.isArray(rating.questions)
        ? rating.questions.filter((q) => q && q.trim())
        : [],
      question_source: rating.source === "manual" ? "manual" : "ai",
      scored: true,
      estimated: false,
    };
  });

  candidate.interview_completed = true;
  recomputeCombined(candidate, job);
  candidate.interview_mode = ratings[0]?.source === "manual" ? "manual" : "ai";
}

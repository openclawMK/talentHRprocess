/**
 * HR Notes scoring — AI analyzes free-text HR notes about a candidate and
 * produces an HR Assessment score (0-100) stored as a weighted criterion entry.
 * The entry folds into recomputeCombined so it influences the combined score.
 */
import { chatJSON } from "./aiClient.js";
import { recomputeCombined } from "./oceanScorer.js";

const HR_CRITERION_ID = "hr_notes_assessment";
const HR_WEIGHT = 0.10; // 10% weight, normalized into combined score

/**
 * @param {Object} candidate - mutated in place
 * @param {Object} job
 * @param {string} notesText - HR free-text notes
 * @returns {{ score, reasoning, flags }} assessment object
 */
export async function applyHrNotes(candidate, job, notesText) {
  const system =
    "You are an expert HR evaluator. Given interviewer notes about a job candidate, " +
    "produce a structured assessment. Return valid JSON only.";

  const user = `Job role: ${job.role_title}
Candidate: ${candidate.profile?.name || "Unknown"}

HR notes:
"${notesText}"

Score the candidate's overall HR impression (attitude, cultural fit, communication, initiative, any red flags or green flags mentioned).

Return exactly:
{
  "score": <integer 0-100>,
  "reasoning": "<one sentence explaining the score>",
  "flags": ["<up to 3 specific items mentioned in the notes>"]
}`;

  let assessment;
  try {
    assessment = await chatJSON({ system, user, temperature: 0.3 });
  } catch {
    assessment = { score: 65, reasoning: "Notes saved; AI analysis unavailable.", flags: [] };
  }

  const score = candidate.score;
  if (score) {
    const entry = {
      criterion_id: HR_CRITERION_ID,
      criterion_name: "HR Assessment",
      source: "hr_notes",
      weight: HR_WEIGHT,
      score: Math.max(0, Math.min(100, Math.round(assessment.score ?? 65))),
      scored: true,
      estimated: false,
      hr_reasoning: assessment.reasoning || "",
      hr_flags: assessment.flags || [],
    };

    const idx = (score.criteria_scores || []).findIndex(
      (cs) => cs.criterion_id === HR_CRITERION_ID
    );
    if (idx >= 0) score.criteria_scores[idx] = entry;
    else score.criteria_scores.push(entry);

    recomputeCombined(score, job);
  }

  // Persist notes on candidate record
  if (!candidate.hr_notes_list) candidate.hr_notes_list = [];
  const today = new Date().toISOString().slice(0, 10);
  candidate.hr_notes_list.push({ text: notesText, date: today });

  return assessment;
}

/**
 * Final holistic analysis — generated after CV + OCEAN + Interview are all scored.
 * Combines all three data sources plus HR notes into a single verdict with
 * a Hire / Hold / Reject recommendation.
 */
import { chatJSON } from "./aiClient.js";

const LABEL = (score) =>
  score >= 70 ? "Strong" : score >= 40 ? "Adequate" : "Needs improvement";

/**
 * @param {Object} candidate
 * @param {Object} job
 * @returns {Promise<Object>} final_analysis object
 */
export async function generateFinalAnalysis(candidate, job) {
  const score = candidate.score || {};
  const criteria = score.criteria_scores || [];

  const cvItems       = criteria.filter((c) => c.source === "cv"        && c.scored);
  const oceanItems    = criteria.filter((c) => c.source === "ocean"     && c.scored);
  const interviewItems = criteria.filter((c) => c.source === "interview" && c.scored);

  const fmt = (items) =>
    items.map((c) => `  • ${c.criterion_name}: ${LABEL(c.score)}${c.hr_notes ? ` (notes: "${c.hr_notes}")` : ""}`).join("\n");

  const traits = candidate.ocean_traits
    ? `Conscientiousness ${candidate.ocean_traits.conscientiousness}, ` +
      `Agreeableness ${candidate.ocean_traits.agreeableness}, ` +
      `Emotional Stability ${candidate.ocean_traits.emotional_stability}, ` +
      `Extraversion ${candidate.ocean_traits.extraversion}, ` +
      `Openness ${candidate.ocean_traits.openness}`
    : "Not available";

  const hrNotes = (candidate.hr_notes_list || [])
    .map((n) => `[${n.date}] ${n.text}`)
    .join("\n") || "None recorded";

  const system =
    "You are a senior HR consultant producing a final hiring recommendation. " +
    "Be direct and honest — this is a decision-support document for a hiring manager. " +
    "Never mention raw scores or percentages. " +
    "Do not reference gender, race, religion, nationality, or marital status. " +
    "Return valid JSON only.";

  const user = `Final assessment for ${candidate.profile?.name || "candidate"} — ${job.role_title} (${job.industry})

=== CV ASSESSMENT ===
${fmt(cvItems) || "  No CV criteria scored"}

=== OCEAN PERSONALITY PROFILE ===
${fmt(oceanItems) || "  No OCEAN criteria scored"}
Raw trait scores: ${traits}

=== INTERVIEW ASSESSMENT ===
${fmt(interviewItems) || "  No interview criteria scored"}

=== HR OBSERVATIONS ===
${hrNotes}

=== OUTCOME ===
Overall lane: ${score.lane || "unknown"} (${score.combined_score ?? "?"}% combined)

Produce a final holistic hiring assessment that synthesises ALL three stages plus the HR notes.

Return exactly:
{
  "summary": "<3-4 sentence holistic verdict — what kind of hire this person would be, referencing observations across all stages>",
  "strengths": ["<3 specific strengths supported by evidence across CV, OCEAN, and/or interview>"],
  "weaknesses": ["<3 honest concerns or shortfalls observed across all stages — direct, not softened>"],
  "recommendation": "Hire" | "Hold" | "Reject",
  "recommendation_reason": "<one sentence explaining the recommendation>"
}`;

  const result = await chatJSON({ system, user, temperature: 0.3 });

  const validRec = ["Hire", "Hold", "Reject"].includes(result.recommendation)
    ? result.recommendation
    : "Hold";

  return {
    summary: result.summary || "",
    strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : [],
    weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.slice(0, 3) : [],
    recommendation: validRec,
    recommendation_reason: result.recommendation_reason || "",
    generated_date: new Date().toISOString().slice(0, 10),
  };
}

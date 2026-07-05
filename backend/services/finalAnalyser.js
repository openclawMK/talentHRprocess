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

  // Pre-hire checks — post-interview due diligence. Health specifics are never
  // exposed to the model (legal/fairness); only its clear/flagged state is.
  const CK_LABEL = { background: "Background check", health: "Medical clearance", references: "Previous-employer reference" };
  const checks = candidate.pre_hire_checks || {};
  const checkLines = Object.entries(CK_LABEL).map(([k, label]) => {
    const c = checks[k];
    if (!c || c.status === "pending") return `  • ${label}: not yet completed`;
    if (c.status === "skipped") return `  • ${label}: skipped`;
    const note = k !== "health" && c.notes ? ` — "${c.notes}"` : "";
    return `  • ${label}: ${c.status === "flagged" ? "FLAGGED" : "clear"}${note}`;
  }).join("\n");

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

=== PRE-HIRE CHECKS (post-interview due diligence) ===
${checkLines}
Any check marked FLAGGED is a serious concern: weigh it heavily, name it in weaknesses, and let it move the recommendation toward Hold or Reject. Do not disclose medical details beyond clear/flagged/pending.

=== OUTCOME ===
Overall lane: ${score.lane || "unknown"} (${score.combined_score ?? "?"}% combined)

Produce a final holistic hiring assessment that synthesises ALL three stages, the HR notes, and the pre-hire checks.

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

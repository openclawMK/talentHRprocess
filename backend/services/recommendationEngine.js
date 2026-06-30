/**
 * Hire / Hold / Reject recommendation engine (Session 11).
 *
 * Rule-based decision + confidence + next action, with AI-generated reasons and
 * concerns. Works at any stage (partial scores resolve to HOLD). Falls back to a
 * sensible default if the AI call fails.
 */
import { chatJSON } from "./aiClient.js";

function hasCriticalRisk(candidate) {
  const gaps = candidate.profile?.employment_gaps || [];
  if (gaps.some((g) => (g.months || 0) > 12)) return true;
  if ((candidate.parse_confidence_overall ?? 100) < 50) return true;
  return false;
}

export async function generateRecommendation(candidate, job) {
  const score = candidate.score || {};
  const combined = score.combined_score ?? 0;
  const cvFit = score.cv_partial_score ?? 0;
  const green = job.thresholds?.green ?? 70;
  const red = job.thresholds?.red ?? 40;
  const full = score.full_score_available === true;
  const pending = score.pending_sources || [];
  const parse = candidate.parse_confidence_overall ?? 100;
  const oceanDone = !!candidate.ocean_completed;

  // STEP 1 — recommendation (rule-based)
  let recommendation;
  if (combined < red || cvFit < 35 || parse < 40) {
    recommendation = "REJECT";
  } else if (combined >= green && cvFit >= 65 && !hasCriticalRisk(candidate) && (full || oceanDone)) {
    recommendation = "HIRE";
  } else {
    recommendation = "HOLD";
  }

  // STEP 2 — confidence
  let confidence;
  if (full && (combined > 75 || combined < 35)) confidence = "High";
  else if (full || pending.length === 1) confidence = "Medium";
  else confidence = "Low";
  if (pending.length > 1 || parse < 60) confidence = "Low";

  // STEP 5 — next action (rule-based)
  let next_action;
  const pendingLabel = pending.map((p) => (p === "ocean" ? "OCEAN" : "interview")).join(" + ");
  if (recommendation === "HIRE" && full) next_action = "Proceed to offer — prepare employment letter";
  else if (recommendation === "HIRE") next_action = `Complete ${pendingLabel} before making offer`;
  else if (recommendation === "HOLD" && pending.includes("ocean")) next_action = "Send OCEAN assessment link to candidate";
  else if (recommendation === "HOLD" && pending.includes("interview")) next_action = "Schedule interview to complete assessment";
  else if (recommendation === "HOLD") next_action = "Consider a second interview to clarify concerns";
  else next_action = "Send polite rejection — candidate does not meet minimum requirements";

  // STEP 3 + 4 — reasons + concerns (AI, combined into one call)
  let reasons = [];
  let concerns = [];
  try {
    const result = await chatJSON({
      system:
        "You are a senior HR consultant justifying a hiring recommendation. " +
        "Be specific and evidence-based. Do not reference gender, race, religion, nationality, or marital status. " +
        "Return valid JSON only.",
      user: `Recommendation: ${recommendation}
Combined score: ${combined}% (green ≥ ${green}, red < ${red})
CV fit: ${cvFit}%
Personality assessed: ${oceanDone ? "yes" : "no"}
Pending stages: ${pending.join(", ") || "none"}
Strengths: ${JSON.stringify(score.strengths || [])}
Risks: ${JSON.stringify(score.weaknesses || [])}
Role: ${job.role_title} (${job.industry})

Return exactly:
{
  "reasons": [exactly 3 one-sentence justifications for this recommendation],
  "concerns": [0 to 2 specific concerns the HR manager should weigh; empty array if none]
}`,
      temperature: 0.3,
    });
    reasons = Array.isArray(result.reasons) ? result.reasons.slice(0, 3) : [];
    concerns = Array.isArray(result.concerns) ? result.concerns.slice(0, 2) : [];
  } catch {
    reasons = [`${recommendation} based on a combined score of ${combined}% against this role's thresholds.`];
    concerns = pending.length ? [`${pendingLabel} still pending — assessment is incomplete.`] : [];
  }

  return {
    recommendation,
    confidence,
    reasons,
    concerns,
    next_action,
    generated_at: new Date().toISOString(),
  };
}

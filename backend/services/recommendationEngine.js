/**
 * Hire / Hold / Reject recommendation engine (Session 11).
 *
 * Rule-based decision + confidence + next action, with AI-generated reasons and
 * concerns. Works at any stage (partial scores resolve to HOLD). Falls back to a
 * sensible default if the AI call fails.
 */
import { chatJSON } from "./aiClient.js";

function flaggedChecks(candidate) {
  const LABELS = { background: "background check", health: "medical clearance", references: "previous-employer reference" };
  const c = candidate.pre_hire_checks || {};
  return Object.keys(LABELS).filter((k) => c[k]?.status === "flagged").map((k) => LABELS[k]);
}

function hasCriticalRisk(candidate) {
  const gaps = candidate.profile?.employment_gaps || [];
  if (gaps.some((g) => (g.months || 0) > 12)) return true;
  if ((candidate.parse_confidence_overall ?? 100) < 50) return true;
  // A flagged pre-hire check or a Success Profile dealbreaker blocks an automatic
  // HIRE (pushes to HOLD) — advisory, never an auto-reject; HR still decides.
  if (flaggedChecks(candidate).length) return true;
  if (candidate.score?.dealbreaker_triggered) return true;
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

  // STEP 1 — recommendation (rule-based).
  // A dealbreaker no longer auto-REJECTs (that amplified CV-parsing mistakes) —
  // it counts as a critical risk that blocks an automatic HIRE and defaults to
  // HOLD with the flag surfaced, so HR reviews it rather than the tool killing
  // a possibly-good candidate on a lexical miss.
  // Pre-interview the score is capped (max 50), so it must NOT be judged against
  // the final green/red bars — that would reject good screening candidates.
  const interviewPending = pending.includes("interview");
  let recommendation;
  if (interviewPending) {
    recommendation = "HOLD"; // screening stage — no final hire/reject yet
  } else if (combined < red || cvFit < 35 || parse < 40) {
    recommendation = "REJECT";
  } else if (combined >= green && cvFit >= 65 && !hasCriticalRisk(candidate)) {
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

  const flagged = flaggedChecks(candidate);
  const dealbreakers = score.dealbreakers_hit || [];

  // STEP 5 — next action (rule-based)
  let next_action;
  const pendingLabel = pending.map((p) => (p === "ocean" ? "OCEAN" : "interview")).join(" + ");
  if (dealbreakers.length) next_action = `Review dealbreaker before proceeding: ${dealbreakers[0]}`;
  else if (flagged.length) next_action = `Resolve flagged ${flagged.join(" + ")} before any offer`;
  else if (interviewPending) next_action = score.screening_pass ? "Screening passed — proceed to interview" : "Below screening bar — review before interviewing";
  else if (recommendation === "HIRE" && full) next_action = "Proceed to offer — prepare employment letter";
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
Flagged pre-hire checks: ${flagged.length ? flagged.join(", ") + " (treat as a serious concern; do not disclose medical specifics)" : "none"}
Success Profile dealbreakers triggered: ${dealbreakers.length ? dealbreakers.join(", ") + " (serious concern — name it and weigh toward Hold/Reject, but note it may need manual verification)" : "none"}
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

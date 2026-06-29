// Shared pipeline-stage helpers for the HR UI.

export const STAGE_META = {
  cv_submission: { label: "CV", icon: "📋" },
  ocean_assessment: { label: "OCEAN", icon: "🧠" },
  interview: { label: "Interview", icon: "👥" },
  offer: { label: "Offer", icon: "✅" },
};

const STAGE_ORDER = ["cv_submission", "ocean_assessment", "interview", "offer"];

function stageEnabled(job, key) {
  if (key === "cv_submission" || key === "offer") return true;
  return job?.pipeline_stages?.[key]?.enabled !== false;
}

/**
 * Returns the ordered enabled stages for a candidate with a status each:
 * "done" | "current" | "upcoming" | "rejected", plus the current stage key.
 */
export function candidateStages(candidate, job) {
  const enabled = STAGE_ORDER.filter((k) => stageEnabled(job, k));

  const done = {
    cv_submission: !!candidate.score, // CV scored at creation
    ocean_assessment: !!candidate.ocean_completed,
    interview: !!candidate.interview_completed,
    offer: false,
  };

  // Only call it "rejected" once the full score is in — a low partial score
  // (interview/OCEAN still pending) is not a final verdict.
  const rejected =
    candidate.score?.lane === "red" && candidate.score?.full_score_available !== false;

  // First enabled, non-done stage is "current"; everything after is "upcoming".
  let currentKey = null;
  for (const k of enabled) {
    if (k === "offer") {
      // offer is "current" only once everything before it is done
      const priorDone = enabled.filter((s) => s !== "offer").every((s) => done[s]);
      if (priorDone) currentKey = "offer";
      break;
    }
    if (!done[k]) { currentKey = k; break; }
  }

  let passedCurrent = false;
  const stages = enabled.map((k) => {
    let status;
    if (done[k]) status = "done";
    else if (k === currentKey) { status = "current"; passedCurrent = true; }
    else status = passedCurrent ? "upcoming" : "upcoming";
    return { key: k, ...STAGE_META[k], status };
  });

  return { stages, currentKey, rejected };
}

/** Short label for the candidate's current stage, e.g. "Awaiting OCEAN" or "Assessment complete". */
export function currentStageLabel(candidate, job) {
  const { currentKey, rejected } = candidateStages(candidate, job);
  if (rejected) return "Rejected";
  if (!currentKey) return "In progress";
  // All assessment stages done — next step is the human offer/decision.
  // This is a pipeline position, NOT a hire recommendation (see the verdict badge).
  if (currentKey === "offer") return "Assessment complete";
  return `Awaiting ${STAGE_META[currentKey].label}`;
}

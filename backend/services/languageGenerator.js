import { chatJSON } from "./aiClient.js";

/**
 * Generate plain-language insights for HR from a scored candidate.
 * @returns {Promise<{ strengths: string[], gaps: string[], summary: string }>}
 */
export async function generateCandidateInsights(candidate, job, scores) {
  // lowest-scoring SCORED cv criterion = top gap
  const scored = (scores.criteria_scores || []).filter((c) => c.scored);
  const topGap = scored.slice().sort((a, b) => a.score - b.score)[0];
  const pending = scores.pending_sources || [];
  const dims = Object.fromEntries(
    (scores.criteria_scores || []).map((c) => [c.criterion_name, c.score])
  );

  const profileSummary = {
    name: candidate.profile.name,
    age: candidate.profile.age,
    total_experience_months: candidate.profile.total_experience_months,
    career_direction: candidate.profile.career_direction,
    work_history: (candidate.profile.work_history || []).map((w) => ({
      title: w.title,
      employer: w.employer,
      industry: w.industry,
      duration_months: w.duration_months,
      team_size_managed: w.team_size_managed,
    })),
    education: candidate.profile.education,
    skills: candidate.profile.skills,
  };

  const system =
    "You are an expert HR advisor. Write clear, concise, professional insights for an HR manager reviewing a candidate. " +
    "Write in third person. Never mention scores or percentages. " +
    "Do not reference gender, race, religion, nationality, or marital status. " +
    "Age may be referenced where relevant to role fit. " +
    "Focus on skills, experience, age fit, and role fit. Return valid JSON only.";

  const user = `Generate insights for this candidate applying for ${job.role_title}:

Candidate profile: ${JSON.stringify(profileSummary)}

Job requirements: ${JSON.stringify(job.requirements)}
Preferred age band for the role: ${JSON.stringify(job.age_band)}

Criteria scores (CV-based): ${JSON.stringify(dims)}
Criteria still pending (not yet scored): ${pending.join(", ") || "none"}

Top gap identified: ${topGap ? topGap.criterion_name : "n/a"} (the lowest-scoring CV criterion)

Return this JSON:
{
  "strengths": [exactly 3 strings, each one sentence, specific to this candidate],
  "gaps": [exactly 2 strings, each framed as 'probe in interview', not as disqualifiers],
  "summary": "one paragraph, 3-4 sentences, plain language for an HR manager"
}`;

  const result = await chatJSON({ system, user, temperature: 0.4 });
  return {
    strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : [],
    gaps: Array.isArray(result.gaps) ? result.gaps.slice(0, 2) : [],
    summary: result.summary || "",
  };
}

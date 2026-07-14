import { chatJSON } from "./aiClient.js";
import { DEFAULT_WEIGHTS } from "./composite.js";

// Unified weight budget (cv / ocean / interview must sum to 1.0), matching the
// composite scoring model (composite.js) exactly — the same regardless of role
// level, so the "cv" bucket here always aligns with the Success-Profile-fit 35%
// the score actually uses. role_level shapes CRITERIA CONTENT (e.g. leadership
// framing for supervisory roles), never the bucket split.
const WEIGHT_BUDGET = { cv: DEFAULT_WEIGHTS.profile, ocean: DEFAULT_WEIGHTS.ocean, interview: DEFAULT_WEIGHTS.interview };

function buildSystemPrompt(budget, interviewCount) {
  return `You are an expert HR consultant and industrial-organisational psychologist specialising in the Malaysian job market.
Your task is to design a scoring criteria framework for a specific role.

Each criterion must specify:
- id (c1, c2, c3... up to c12 max)
- name (short, clear label)
- weight (decimal — see budget rules below)
- source: one of 'cv' | 'interview' | 'ocean'
- description (one sentence explaining what this criterion measures)

STRICT WEIGHT BUDGET — weights for each source must add up to exactly:
- cv source:        ${budget.cv} total  (${Math.round(budget.cv * 100)}% of the overall score)
- ocean source:     ${budget.ocean} total  (${Math.round(budget.ocean * 100)}% of the overall score)
- interview source: ${budget.interview} total  (${Math.round(budget.interview * 100)}% of the overall score)
- All weights combined must sum to exactly 1.0

Source rules:
- cv: extractable from a resume — experience years, skills, education, tenure, age fit
- interview: requires a face-to-face or phone screening question — situational judgment, behavioural scenarios
- ocean: requires the Big Five (OCEAN) personality questionnaire — Conscientiousness, Agreeableness, Neuroticism, Extraversion, Openness

Criteria rules:
- Generate EXACTLY ${interviewCount} distinct interview-source criteria — count them before responding, no more and no less. Each must be a genuinely separate dimension (not near-duplicates), specific to this role and industry.
- At least 2 cv-source criteria and 2 ocean-source criteria
- Make criteria specific to the industry and role — not generic HR boilerplate
- Consider the Malaysian employment context: multilingual requirements, SME culture, shift work norms
- Return ONLY a JSON object: { "criteria": [ ...criteria objects... ] }`;
}

// Fallback criteria for each level
const FALLBACK = {
  entry: [
    { id: "c1", name: "Relevant experience", weight: 0.15, source: "cv", description: "Years of experience relevant to the role" },
    { id: "c2", name: "Core skills match",   weight: 0.12, source: "cv", description: "Skills that match the role requirements" },
    { id: "c3", name: "Education level",     weight: 0.08, source: "cv", description: "Meets the minimum education requirement" },
    { id: "c4", name: "Reliability",         weight: 0.08, source: "ocean", description: "High Conscientiousness — dependable and consistent" },
    { id: "c5", name: "Composure",           weight: 0.07, source: "ocean", description: "Low Neuroticism — calm under pressure" },
    { id: "c6", name: "Communication",       weight: 0.20, source: "interview", description: "Clarity and professionalism in communication" },
    { id: "c7", name: "Attitude & fit",      weight: 0.15, source: "interview", description: "Motivation and cultural fit for the role" },
    { id: "c8", name: "Work ethic",          weight: 0.15, source: "interview", description: "Commitment to reliability and responsibilities" },
  ],
  supervisory: [
    { id: "c1", name: "Relevant experience", weight: 0.18, source: "cv", description: "Years of experience relevant to the role" },
    { id: "c2", name: "Leadership track record", weight: 0.17, source: "cv", description: "History of managing teams or projects" },
    { id: "c3", name: "Core skills match",   weight: 0.10, source: "cv", description: "Skills that match the role requirements" },
    { id: "c4", name: "Conscientiousness",   weight: 0.06, source: "ocean", description: "High Conscientiousness — follows through and takes initiative" },
    { id: "c5", name: "Stress tolerance",    weight: 0.04, source: "ocean", description: "Low Neuroticism — composed under operational pressure" },
    { id: "c6", name: "Leadership style",    weight: 0.18, source: "interview", description: "How the candidate motivates and manages a team" },
    { id: "c7", name: "Problem solving",     weight: 0.15, source: "interview", description: "Situational judgment in operational challenges" },
    { id: "c8", name: "Stakeholder handling",weight: 0.12, source: "interview", description: "Managing customers, staff, and upward communication" },
  ],
};

// Generic, distinct interview dimensions used to pad out an under-generated
// set — picked only if the AI didn't already return that many named criteria.
const GENERIC_INTERVIEW_CRITERIA = [
  { name: "Problem solving", description: "Situational judgment when facing an unexpected operational issue" },
  { name: "Team collaboration", description: "How the candidate works with and supports colleagues" },
  { name: "Adaptability", description: "Comfort adjusting to changing priorities or instructions" },
  { name: "Customer focus", description: "Orientation toward serving customers or internal stakeholders well" },
  { name: "Initiative", description: "Willingness to act without being told, within their role" },
  { name: "Conflict resolution", description: "Handling disagreements or difficult interactions calmly" },
  { name: "Time management", description: "Prioritising and completing tasks within expectations" },
  { name: "Stress management", description: "Composure and judgment under pressure or during a rush" },
  { name: "Attention to detail", description: "Accuracy and thoroughness in day-to-day work" },
  { name: "Communication clarity", description: "Clear, professional communication in job-relevant scenarios" },
];

/**
 * Deterministically enforce an exact interview-criteria count — LLMs don't
 * reliably hit an exact count from prompt wording alone. Pads with generic,
 * distinct dimensions (skipping near-duplicate names) or trims the
 * lowest-weight interview criteria first, leaving cv/ocean untouched.
 */
function enforceInterviewCount(criteria, targetCount) {
  const others = criteria.filter((c) => c.source !== "interview");
  let interview = criteria.filter((c) => c.source === "interview");

  if (interview.length < targetCount) {
    // Pad with a placeholder weight equal to the existing average, so
    // normaliseBySource redistributes fairly rather than letting padded
    // items dominate or shrink to nothing.
    const avgWeight = interview.length ? interview.reduce((a, c) => a + (Number(c.weight) || 0), 0) / interview.length : 1;
    const haveNames = new Set(interview.map((c) => c.name.toLowerCase()));
    for (const g of GENERIC_INTERVIEW_CRITERIA) {
      if (interview.length >= targetCount) break;
      if (haveNames.has(g.name.toLowerCase())) continue;
      interview.push({ name: g.name, description: g.description, source: "interview", weight: avgWeight });
      haveNames.add(g.name.toLowerCase());
    }
  } else if (interview.length > targetCount) {
    interview = [...interview].sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, targetCount);
  }

  return [...others, ...interview];
}

/**
 * Enforce source weight budgets: scale each source's criteria so they sum exactly to the budget.
 */
function normaliseBySource(criteria, budget) {
  const sources = ["cv", "ocean", "interview"];
  const result = [];

  for (const src of sources) {
    const items = criteria.filter((c) => c.source === src);
    if (!items.length) continue;
    const targetTotal = budget[src] || 0;
    const currentTotal = items.reduce((a, c) => a + (Number(c.weight) || 0), 0);

    items.forEach((item) => {
      result.push({
        ...item,
        weight:
          currentTotal > 0
            ? Math.round((item.weight / currentTotal) * targetTotal * 100) / 100
            : Math.round((targetTotal / items.length) * 100) / 100,
      });
    });
  }

  // Fix rounding drift on the first item
  const drift = Math.round((1 - result.reduce((a, c) => a + c.weight, 0)) * 100) / 100;
  if (drift !== 0 && result.length > 0) {
    result[0].weight = Math.round((result[0].weight + drift) * 100) / 100;
  }

  // Re-id sequentially
  return result.map((c, i) => ({ ...c, id: `c${i + 1}` }));
}

const VALID_INTERVIEW_COUNTS = [3, 5, 6];

/**
 * Generate role-specific scoring criteria.
 * @param {{ industry, role_title, key_responsibilities, role_level, interview_criteria_count }} input
 * @returns {Promise<Array>} criteria array
 */
export async function generateCriteria({ industry, role_title, key_responsibilities = [], role_level = "entry", interview_criteria_count = 3 }) {
  const budget = WEIGHT_BUDGET;
  const interviewCount = VALID_INTERVIEW_COUNTS.includes(Number(interview_criteria_count)) ? Number(interview_criteria_count) : 3;
  const fallback = FALLBACK[role_level] || FALLBACK.entry;

  try {
    const system = buildSystemPrompt(budget, interviewCount);
    const user = `Generate scoring criteria for:
Industry: ${industry}
Role: ${role_title}
Role level: ${role_level}
Key responsibilities: ${key_responsibilities.join(", ")}

Remember: cv=${Math.round(budget.cv * 100)}%, ocean=${Math.round(budget.ocean * 100)}%, interview=${Math.round(budget.interview * 100)}% — strictly enforced.
The interview source must have EXACTLY ${interviewCount} criteria.
Return: { "criteria": [ ...criteria objects... ] }`;

    const result = await chatJSON({ system, user, temperature: 0.4 });
    const arr = Array.isArray(result) ? result : result.criteria;
    if (!Array.isArray(arr) || arr.length < 5) return normaliseBySource(enforceInterviewCount(fallback, interviewCount), budget);

    const valid = arr.filter(
      (c) => c && c.name && ["cv", "interview", "ocean"].includes(c.source)
    );
    return normaliseBySource(enforceInterviewCount(valid, interviewCount), budget);
  } catch (err) {
    console.error("generateCriteria error:", err.message);
    return normaliseBySource(enforceInterviewCount(fallback, interviewCount), budget);
  }
}

import { chatJSON } from "./aiClient.js";

const SYSTEM_PROMPT = `You are an expert HR consultant and industrial-organisational psychologist specialising in the Malaysian job market.
Your task is to design a scoring criteria framework for a specific role.
Each criterion must specify:
- id (c1, c2, c3... up to c10 max)
- name (short, clear label)
- weight (decimal, all weights must sum to exactly 1.0)
- source: one of 'cv' | 'interview' | 'ocean'
- description (one sentence explaining what this criterion measures)
Rules:
- cv: information extractable from a resume/CV (experience, skills, education, tenure)
- interview: requires a face-to-face or phone screening question (situational judgment, behaviour)
- ocean: requires the Big Five (OCEAN) personality questionnaire (traits like Conscientiousness, Agreeableness, Neuroticism)
- Weight distribution guideline: 50-60% from cv sources, 20-30% from interview, 15-25% from ocean
- Maximum 10 criteria, minimum 5
- Make criteria specific to the industry and role — not generic HR boilerplate
- Consider the Malaysian employment context: multilingual requirements, SME culture, shift work norms
- Return ONLY a JSON object of the form { "criteria": [ ...criteria objects... ] }`;

// Fallback if the AI call or parsing fails.
const FALLBACK_CRITERIA = [
  { id: "c1", name: "Relevant experience", weight: 0.25, source: "cv", description: "Years of experience relevant to the role" },
  { id: "c2", name: "Core skills match", weight: 0.2, source: "cv", description: "Skills that match the role requirements" },
  { id: "c3", name: "Education level", weight: 0.15, source: "cv", description: "Meets the minimum education requirement" },
  { id: "c4", name: "Reliability", weight: 0.15, source: "ocean", description: "High Conscientiousness — dependable and consistent" },
  { id: "c5", name: "Communication", weight: 0.15, source: "interview", description: "Clarity and professionalism in communication" },
  { id: "c6", name: "Attitude & fit", weight: 0.1, source: "interview", description: "Motivation and cultural fit for the role" },
];

// Re-id sequentially and normalise weights so they sum to exactly 1.0.
function normalise(criteria) {
  const cleaned = criteria
    .filter((c) => c && c.name && ["cv", "interview", "ocean"].includes(c.source))
    .slice(0, 10)
    .map((c, i) => ({
      id: `c${i + 1}`,
      name: String(c.name),
      weight: Number(c.weight) || 0,
      source: c.source,
      description: c.description || "",
    }));
  const sum = cleaned.reduce((a, c) => a + c.weight, 0);
  if (sum > 0) {
    cleaned.forEach((c) => {
      c.weight = Math.round((c.weight / sum) * 100) / 100;
    });
    // fix rounding drift on the largest criterion
    const drift = Math.round((1 - cleaned.reduce((a, c) => a + c.weight, 0)) * 100) / 100;
    if (drift !== 0) {
      const biggest = cleaned.reduce((m, c) => (c.weight > m.weight ? c : m), cleaned[0]);
      biggest.weight = Math.round((biggest.weight + drift) * 100) / 100;
    }
  }
  return cleaned;
}

/**
 * Generate role-specific scoring criteria.
 * @param {{industry:string, role_title:string, key_responsibilities:string[]}} input
 * @returns {Promise<Array>} criteria array
 */
export async function generateCriteria({ industry, role_title, key_responsibilities = [] }) {
  try {
    const user = `Generate scoring criteria for:
Industry: ${industry}
Role: ${role_title}
Key responsibilities: ${key_responsibilities.join(", ")}
Return a JSON object: { "criteria": [ ...criteria objects... ] }`;

    const result = await chatJSON({ system: SYSTEM_PROMPT, user, temperature: 0.4 });
    const arr = Array.isArray(result) ? result : result.criteria;
    if (!Array.isArray(arr) || arr.length < 5) return [...FALLBACK_CRITERIA];
    return normalise(arr);
  } catch (err) {
    console.error("generateCriteria error:", err.message);
    return [...FALLBACK_CRITERIA];
  }
}

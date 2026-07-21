import { chatJSON } from "./aiClient.js";
import { readTable } from "./store.js";

const SYSTEM_PROMPT = `You are an expert HR CV parser. Extract structured information from the CV text provided.
Return ONLY valid JSON matching the schema below.
Do not infer, guess, or fabricate any information not explicitly stated in the CV.
Extract age and date of birth if they are present in the CV.
Do not extract or reference: gender, race, religion, nationality, marital status, or family information.
If a field cannot be determined from the CV text, set it to null.
For confidence scores: 90-100 = clearly stated, 70-89 = reasonably inferred, 50-69 = uncertain, below 50 = flagged.`;

function buildUserPrompt(cvText) {
  return `Parse this CV and return structured JSON:

CV TEXT:
${cvText}

Return this exact JSON structure:
{
  "name": string,
  "date_of_birth": string|null,
  "age": number|null,
  "contact": { "email": string|null, "phone": string|null, "location": string|null },
  "languages": string[],
  "work_history": [
    {
      "title": string,
      "employer": string,
      "industry": string,
      "start_date": string|null,
      "end_date": string|null,
      "duration_months": number|null,
      "duties": string[],
      "team_size_managed": number|null,
      "confidence": number
    }
  ],
  "education": [
    {
      "level": string,
      "institution": string|null,
      "field": string|null,
      "year": number|null,
      "confidence": number
    }
  ],
  "skills": string[],
  "certifications": string[],
  "employment_gaps": [ { "from": string, "to": string, "months": number } ],
  "parse_notes": string
}`;
}

async function loadJob(jobId) {
  const jobs = await readTable("jobs");
  const job = jobs.find((j) => j.job_id === jobId);
  if (!job) throw new Error(`Unknown jobId: ${jobId}`);
  return job;
}

// Rough seniority ranking from a role title, used to infer career direction.
function seniorityRank(title) {
  const t = (title || "").toLowerCase();
  if (/(head|director|principal)/.test(t)) return 5;
  if (/(manager|supervisor|lead|senior)/.test(t)) return 4;
  if (/(executive|officer|specialist|coordinator)/.test(t)) return 3;
  if (/(associate|cashier|crew|server|attendant|staff)/.test(t)) return 2;
  if (/(assistant|junior|trainee|intern|apprentice)/.test(t)) return 1;
  return 2; // default mid-low
}

// Compute age from a date-of-birth string; falls back to a stated age.
function computeAge(dateOfBirth, statedAge) {
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
      if (age >= 0 && age < 120) return age;
    }
  }
  if (typeof statedAge === "number" && statedAge > 0 && statedAge < 120) {
    return statedAge;
  }
  return null;
}

function computeCareerDirection(workHistory) {
  if (!Array.isArray(workHistory) || workHistory.length < 2) return "unclear";
  // Assume the array is ordered most-recent-first or oldest-first; we treat
  // index 0 as "first listed" and the last index as "last listed". Many CVs
  // list most recent first, so compare first vs last and normalise.
  const first = seniorityRank(workHistory[0].title);
  const last = seniorityRank(workHistory[workHistory.length - 1].title);
  // workHistory[0] is typically the most recent role on a CV.
  if (first > last) return "upward";
  if (first < last) return "lateral";
  return "lateral";
}

/**
 * Parse a CV with the LLM and enrich it with derived fields.
 *
 * @param {string} cvText
 * @param {string} jobId
 * @returns {Promise<object>} enriched candidate profile
 */
export async function parseCVWithAI(cvText, jobId) {
  await loadJob(jobId); // validates jobId exists (config available for future use)

  const profile = await chatJSON({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(cvText),
    temperature: 0,
  });

  const workHistory = Array.isArray(profile.work_history)
    ? profile.work_history
    : [];
  const education = Array.isArray(profile.education) ? profile.education : [];

  // --- derived fields ---
  const durations = workHistory
    .map((w) => w.duration_months)
    .filter((d) => typeof d === "number" && !Number.isNaN(d));

  const total_experience_months = durations.reduce((a, b) => a + b, 0) || null;
  const avg_tenure_months =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  const career_direction =
    workHistory.length === 1 ? "unclear" : computeCareerDirection(workHistory);

  const confidences = [
    ...workHistory.map((w) => w.confidence),
    ...education.map((e) => e.confidence),
  ].filter((c) => typeof c === "number" && !Number.isNaN(c));

  const overall_parse_confidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 50;

  const age = computeAge(profile.date_of_birth, profile.age);

  return {
    ...profile,
    age,
    work_history: workHistory,
    education,
    total_experience_months,
    avg_tenure_months,
    career_direction,
    overall_parse_confidence,
  };
}

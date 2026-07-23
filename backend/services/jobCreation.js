/**
 * Shared "create a role" logic — used by both the dashboard's POST /jobs
 * (a logged-in HR user) and the machine-facing POST /api/v1/roles (an API
 * key). Keeping this in one place means an API-created role gets the exact
 * same AI-generated criteria and auto-drafted Success Profile a
 * dashboard-created one does, rather than a thinner, drifting copy.
 */
import { v4 as uuidv4 } from "uuid";
import { generateCriteria } from "./criteriaGenerator.js";
import { generateSuccessProfileForJob } from "../routes/successProfile.js";
import { readTable, insertRow } from "./store.js";
import { DEFAULT_PIPELINE } from "./pipeline.js";

// weights must sum to ~1.0 (allow rounding tolerance)
export function weightsValid(criteria) {
  const sum = (criteria || []).reduce((a, c) => a + (Number(c.weight) || 0), 0);
  return Math.abs(sum - 1) <= 0.01;
}

function nextJobId(jobs) {
  let n = jobs.length + 1;
  let id;
  do {
    id = `job_${String(n).padStart(3, "0")}`;
    n += 1;
  } while (jobs.some((j) => j.job_id === id));
  return id;
}

/**
 * @param {object} body - role_title, industry, location, role_level, requirements,
 *   key_responsibilities, criteria, score_weights, company_id, interview_criteria_count,
 *   success_profile (optional overrides merged onto the auto-generated profile)
 * @param {string|null} companyIdOverride - forces the role's company, ignoring
 *   body.company_id — pass req.user.company_id so a client login/API key can
 *   never create a role under a company that isn't their own.
 * @param {string|null} createdBy - the user id who created it, if any — drives
 *   a Level 2 user's default "jobs they created" visibility/edit rights.
 * @returns {Promise<{job:object}|{error:string, status:number}>}
 */
export async function createJobFromParams(body, companyIdOverride, createdBy = null) {
  const {
    role_title,
    industry,
    location = "Kuala Lumpur",
    role_level = "entry",
    requirements = {},
    key_responsibilities = [],
    criteria: suppliedCriteria,
    score_weights: suppliedWeights,
    company_id: bodyCompanyId,
    interview_criteria_count,
    success_profile: successProfileOverrides,
  } = body || {};
  const company_id = companyIdOverride || bodyCompanyId;

  if (!role_title || !industry) return { error: "role_title and industry are required.", status: 400 };

  let company;
  if (company_id) {
    company = (await readTable("companies")).find((c) => c.id === company_id);
    if (!company) return { error: "Unknown company.", status: 400 };
  }

  let criteria = suppliedCriteria;
  if (!Array.isArray(criteria) || criteria.length === 0) {
    criteria = await generateCriteria({ industry, role_title, key_responsibilities, role_level, interview_criteria_count });
  } else if (!weightsValid(criteria)) {
    return { error: "Criteria weights must sum to 100%", status: 400 };
  }

  let score_weights;
  if (suppliedWeights && typeof suppliedWeights === "object") {
    score_weights = suppliedWeights;
  } else {
    const sumBy = (src) => criteria.filter((c) => c.source === src).reduce((a, c) => a + (Number(c.weight) || 0), 0);
    score_weights = { profile: sumBy("cv"), ocean: sumBy("ocean"), interview: sumBy("interview") };
  }

  const jobs = await readTable("jobs");
  const job_id = nextJobId(jobs);

  const expMin = Number(requirements.experience_years_min) || 0;
  const newJob = {
    job_id,
    company,
    role_title,
    industry,
    location,
    requirements: {
      experience_years_min: expMin,
      experience_years_preferred: requirements.experience_years_preferred || expMin + 1,
      education_level_min: requirements.education_level_min || "Any",
      required_skills: requirements.required_skills || [],
      preferred_skills: requirements.preferred_skills || [],
      key_responsibilities,
    },
    age_band: requirements.age_band || { min: 18, ideal_min: 18, ideal_max: 45, max: 60 },
    portal_token: `pq-${uuidv4().slice(0, 8)}`,
    pipeline_stages: { ...DEFAULT_PIPELINE },
    hr_whatsapp_alerts: false,
    hr_contact_phone: "",
    criteria,
    score_weights,
    thresholds: { green: 72, red: 45 },
    benchmark: { maturity: "starter", avg_experience_years: expMin || 1, avg_team_size: 0 },
    role_level,
    criteria_generated_by: suppliedCriteria ? "edited" : "ai",
    criteria_locked: false,
    created_by: createdBy,
    assigned_users: [],
    archived: false,
  };

  // Auto-generate the Success Profile so a new role is immediately scoreable —
  // HR (or the calling system) reviews/edits rather than starting blank.
  // Never blocks role creation if the AI call fails.
  try {
    newJob.successProfile = { ...(await generateSuccessProfileForJob(newJob)), created_at: new Date().toISOString(), last_updated: new Date().toISOString() };
  } catch (spErr) {
    console.error("auto success-profile generation failed:", spErr.message);
  }
  // A caller (e.g. the vacancy API) can supply must_haves/dealbreakers/etc. up
  // front — merged onto whatever the AI drafted, never replacing it wholesale.
  if (successProfileOverrides && typeof successProfileOverrides === "object") {
    newJob.successProfile = { ...(newJob.successProfile || {}), ...successProfileOverrides };
  }

  // insertRow (not writeTable) — safe under concurrent creates, see store.js.
  await insertRow("jobs", newJob);
  return { job: newJob };
}

/**
 * Shared Supabase-backed persistence, shaped to be a drop-in replacement for
 * the old readJSON/writeJSON(file) pattern. Every route still reads a full
 * array, mutates it in memory, and writes the full array back — only the
 * backing store changed. This keeps all scoring/pipeline business logic
 * (which operates on plain JS arrays/objects) completely untouched.
 *
 * readTable(name)         -> full array, in the same shape the old *.json
 *                             files used (jobs.company nested, successProfile
 *                             camelCase, etc — see the mappers below).
 * writeTable(name, array) -> reconciles the table to match `array` exactly:
 *                             deletes rows whose key is no longer present,
 *                             upserts everything that is. Same semantics as
 *                             overwriting the whole JSON file.
 *
 * scores / whatsapp_log / whatsapp_replies are genuinely append-only logs
 * (never edited in place) — appendRow()/readAppendTable() cover those.
 */
import { supabase } from "./supabaseClient.js";

async function selectAll(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(`readTable(${table}): ${error.message}`);
  return data;
}

async function reconcile(table, keyCol, rows) {
  const keys = rows.map((r) => r[keyCol]);
  const existing = await selectAll(table);
  const toDelete = existing.map((r) => r[keyCol]).filter((k) => !keys.includes(k));
  if (toDelete.length) {
    const { error } = await supabase.from(table).delete().in(keyCol, toDelete);
    if (error) throw new Error(`writeTable(${table}) delete: ${error.message}`);
  }
  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw new Error(`writeTable(${table}) upsert: ${error.message}`);
  }
}

const companyToApi = (r) => ({ id: r.id, name: r.name, industry: r.industry, accent: r.accent, initials: r.initials });
const companyToRow = (o) => ({ id: o.id, name: o.name, industry: o.industry || "", accent: o.accent, initials: o.initials });

function jobToApi(r, companiesById) {
  return {
    job_id: r.job_id,
    company: (companiesById && companiesById[r.company]) || r.company,
    role_title: r.role_title,
    industry: r.industry,
    location: r.location,
    role_level: r.role_level,
    portal_token: r.portal_token,
    hr_whatsapp_alerts: !!r.hr_whatsapp_alerts,
    hr_contact_phone: r.hr_contact_phone,
    criteria_generated_by: r.criteria_generated_by,
    criteria_locked: !!r.criteria_locked,
    age_band: r.age_band,
    requirements: r.requirements,
    criteria: r.criteria,
    thresholds: r.thresholds,
    benchmark: r.benchmark,
    successProfile: r.success_profile,
    score_weights: r.score_weights,
    pipeline_stages: r.pipeline_stages,
    interview_slots: r.interview_slots,
    application_form: r.application_form,
  };
}
function jobToRow(o) {
  return {
    job_id: o.job_id,
    company: typeof o.company === "object" && o.company ? o.company.id : o.company || null,
    role_title: o.role_title,
    industry: o.industry,
    location: o.location,
    role_level: o.role_level,
    portal_token: o.portal_token,
    hr_whatsapp_alerts: !!o.hr_whatsapp_alerts,
    hr_contact_phone: o.hr_contact_phone || "",
    criteria_generated_by: o.criteria_generated_by,
    criteria_locked: !!o.criteria_locked,
    age_band: o.age_band ?? null,
    requirements: o.requirements ?? null,
    criteria: o.criteria ?? null,
    thresholds: o.thresholds ?? null,
    benchmark: o.benchmark ?? null,
    success_profile: o.successProfile ?? null,
    score_weights: o.score_weights ?? null,
    pipeline_stages: o.pipeline_stages ?? null,
    interview_slots: o.interview_slots ?? null,
    application_form: o.application_form ?? null,
  };
}

function candidateToApi(r) {
  return {
    candidate_id: r.candidate_id,
    job_id: r.job_id,
    source: r.source,
    submitted_date: r.submitted_date,
    parse_confidence_overall: r.parse_confidence_overall,
    low_confidence_warning: !!r.low_confidence_warning,
    portal_status: r.portal_status,
    ocean_completed: !!r.ocean_completed,
    interview_completed: !!r.interview_completed,
    interview_mode: r.interview_mode,
    profile: r.profile,
    score: r.score,
    score_breakdown: r.score_breakdown,
    recommendation: r.recommendation,
    ocean_traits: r.ocean_traits,
    hr_notes_list: r.hr_notes_list,
    override: r.override,
    ...(r.extra || {}),
  };
}
// Fields the current schema doesn't have their own column for (rare/late
// additions like pre_hire_checks, whatsapp_invite, outcome, final_analysis,
// booking_link_sent_at, ocean_invite, pdpa_consent) are kept inside `extra`
// so nothing silently gets dropped on write-back.
const CANDIDATE_KNOWN = new Set([
  "candidate_id", "job_id", "source", "submitted_date", "parse_confidence_overall",
  "low_confidence_warning", "portal_status", "ocean_completed", "interview_completed",
  "interview_mode", "profile", "score", "score_breakdown", "recommendation",
  "ocean_traits", "hr_notes_list", "override",
]);
function candidateToRow(o) {
  const extra = {};
  for (const k of Object.keys(o)) if (!CANDIDATE_KNOWN.has(k)) extra[k] = o[k];
  return {
    candidate_id: o.candidate_id,
    job_id: o.job_id,
    source: o.source,
    submitted_date: o.submitted_date,
    parse_confidence_overall: o.parse_confidence_overall ?? null,
    low_confidence_warning: !!o.low_confidence_warning,
    portal_status: o.portal_status || null,
    ocean_completed: !!o.ocean_completed,
    interview_completed: !!o.interview_completed,
    interview_mode: o.interview_mode || null,
    profile: o.profile ?? null,
    score: o.score ?? null,
    score_breakdown: o.score_breakdown ?? null,
    recommendation: o.recommendation ?? null,
    ocean_traits: o.ocean_traits ?? null,
    hr_notes_list: o.hr_notes_list ?? null,
    override: o.override ?? null,
    extra: Object.keys(extra).length ? extra : null,
  };
}
// candidateToApi reads `r.extra` back and spreads it — but `r` from Supabase
// has a real `extra` jsonb column, so this round-trips transparently.

const userToApi = (r) => ({ id: r.id, name: r.name, email: r.email, password_hash: r.password_hash, role: r.role, company_id: r.company_id ?? null, created_at: r.created_at });
const userToRow = (o) => ({ id: o.id, name: o.name, email: o.email, password_hash: o.password_hash, role: o.role, company_id: o.company_id ?? null, created_at: o.created_at });

const apiKeyToApi = (r) => ({ id: r.id, company_id: r.company_id, name: r.name, key_prefix: r.key_prefix, key_hash: r.key_hash, created_at: r.created_at });
const apiKeyToRow = (o) => ({ id: o.id, company_id: o.company_id, name: o.name, key_prefix: o.key_prefix, key_hash: o.key_hash, created_at: o.created_at });

const TABLES = {
  companies: { key: "id", toApi: companyToApi, toRow: companyToRow },
  jobs: { key: "job_id", toApi: jobToApi, toRow: jobToRow, needsCompanies: true },
  candidates: { key: "candidate_id", toApi: candidateToApi, toRow: candidateToRow },
  users: { key: "id", toApi: userToApi, toRow: userToRow },
  api_keys: { key: "id", toApi: apiKeyToApi, toRow: apiKeyToRow },
};

export async function readTable(name) {
  const def = TABLES[name];
  if (!def) throw new Error(`Unknown table: ${name}`);
  const rows = await selectAll(name);
  if (def.needsCompanies) {
    const companies = await selectAll("companies");
    const companiesById = Object.fromEntries(companies.map((c) => [c.id, companyToApi(c)]));
    return rows.map((r) => def.toApi(r, companiesById));
  }
  return rows.map((r) => def.toApi(r));
}

export async function writeTable(name, array) {
  const def = TABLES[name];
  if (!def) throw new Error(`Unknown table: ${name}`);
  await reconcile(name, def.key, array.map(def.toRow));
}

/**
 * Insert exactly one new row. Unlike writeTable(), this never reads the
 * table first and never deletes anything — so it's safe under concurrent
 * creates (e.g. two candidates applying via the public portal at the same
 * moment). writeTable's "read full array, mutate, write full array" pattern
 * is a read-modify-write race: request A can read a stale snapshot that's
 * missing B's just-inserted row, then A's reconcile-delete step wipes it.
 * Always use insertRow() for CREATE — only use writeTable() for bulk
 * edits/deletes on an array you already trust to be the full current set.
 */
export async function insertRow(name, obj) {
  const def = TABLES[name];
  if (!def) throw new Error(`Unknown table: ${name}`);
  const { error } = await supabase.from(name).insert(def.toRow(obj));
  if (error) throw new Error(`insertRow(${name}): ${error.message}`);
}

/**
 * Merge new keys into one candidate's `extra` jsonb bucket, without touching
 * any other column or row — cheap alternative to writeTable() for caching a
 * lazily-computed field (e.g. evidence_overrides) on an otherwise read path.
 * Reads the current `extra` first since a jsonb column update REPLACES it
 * wholesale rather than merging.
 */
export async function patchCandidateExtra(candidateId, extraPatch) {
  const { data, error: readErr } = await supabase
    .from("candidates").select("extra").eq("candidate_id", candidateId).single();
  if (readErr) throw new Error(`patchCandidateExtra read: ${readErr.message}`);
  const merged = { ...(data?.extra || {}), ...extraPatch };
  const { error } = await supabase
    .from("candidates").update({ extra: merged }).eq("candidate_id", candidateId);
  if (error) throw new Error(`patchCandidateExtra write: ${error.message}`);
}

/**
 * Delete exactly one row by its primary key. For `jobs`, the DB foreign keys
 * (candidates -> jobs, scores -> candidates/jobs) are ON DELETE CASCADE, so
 * this also removes that role's candidates and their scores automatically.
 * For `companies`, there is no cascade — Postgres will reject the delete with
 * an FK error if any job still references it, which callers should check for
 * up front and surface as a clear "delete its roles first" message.
 */
export async function deleteRow(name, keyValue) {
  const def = TABLES[name];
  if (!def) throw new Error(`Unknown table: ${name}`);
  const { error } = await supabase.from(name).delete().eq(def.key, keyValue);
  if (error) throw new Error(`deleteRow(${name}): ${error.message}`);
}

// --- append-only logs (scores, whatsapp_log, whatsapp_replies) ---

export async function appendRow(table, row) {
  const { error } = await supabase.from(table).insert(row);
  if (error) throw new Error(`appendRow(${table}): ${error.message}`);
}

export async function readScores() {
  const rows = await selectAll("scores");
  return rows.map((r) => r.payload);
}

export async function appendScore(scoreObj) {
  await appendRow("scores", {
    score_id: scoreObj.score_id,
    candidate_id: scoreObj.candidate_id,
    job_id: scoreObj.job_id,
    combined_score: scoreObj.combined_score,
    scored_date: scoreObj.scored_date,
    payload: scoreObj,
  });
}

export async function deleteScoresForCandidate(candidateId) {
  const { error } = await supabase.from("scores").delete().eq("candidate_id", candidateId);
  if (error) throw new Error(`deleteScoresForCandidate: ${error.message}`);
}

export async function readWhatsappLog() {
  const rows = await selectAll("whatsapp_log");
  return rows.map((r) => r.payload).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export async function appendWhatsappLog(entry) {
  await appendRow("whatsapp_log", { payload: entry, created_at: entry.timestamp || new Date().toISOString() });
}

export async function appendWhatsappReply(entry) {
  await appendRow("whatsapp_replies", { payload: entry, created_at: entry.received_at || new Date().toISOString() });
}

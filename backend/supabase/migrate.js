// One-time migration: backend/data/*.json -> Supabase tables.
// Run with: node supabase/migrate.js
// Safe to re-run — every insert uses upsert() keyed on the table's primary key.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { supabase } from "../services/supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DATA_DIR = path.join(__dirname, "..", "data");
const readJSON = (name) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf-8"));

async function upsertAll(table, rows, label) {
  if (!rows.length) {
    console.log(`- ${label}: 0 rows, skipped`);
    return;
  }
  const { error } = await supabase.from(table).upsert(rows);
  if (error) throw new Error(`${label} failed: ${error.message}`);
  console.log(`- ${label}: ${rows.length} rows migrated`);
}

async function main() {
  const companies = readJSON("companies.json");
  await upsertAll("companies", companies, "companies");

  const jobs = readJSON("jobs.json").map((j) => ({
    job_id: j.job_id,
    company: typeof j.company === "object" ? j.company?.id : j.company,
    role_title: j.role_title,
    industry: j.industry,
    location: j.location,
    role_level: j.role_level,
    portal_token: j.portal_token,
    hr_whatsapp_alerts: j.hr_whatsapp_alerts ?? false,
    hr_contact_phone: j.hr_contact_phone,
    criteria_generated_by: j.criteria_generated_by,
    criteria_locked: j.criteria_locked ?? false,
    age_band: j.age_band ?? null,
    requirements: j.requirements ?? null,
    criteria: j.criteria ?? null,
    thresholds: j.thresholds ?? null,
    benchmark: j.benchmark ?? null,
    success_profile: j.successProfile ?? null,
    score_weights: j.score_weights ?? null,
    pipeline_stages: j.pipeline_stages ?? null,
    interview_slots: j.interview_slots ?? null,
  }));
  await upsertAll("jobs", jobs, "jobs");

  const candidates = readJSON("candidates.json").map((c) => ({
    candidate_id: c.candidate_id,
    job_id: c.job_id,
    source: c.source,
    submitted_date: c.submitted_date,
    parse_confidence_overall: c.parse_confidence_overall,
    low_confidence_warning: c.low_confidence_warning ?? false,
    portal_status: c.portal_status,
    ocean_completed: c.ocean_completed ?? false,
    interview_completed: c.interview_completed ?? false,
    interview_mode: c.interview_mode,
    profile: c.profile ?? null,
    score: c.score ?? null,
    score_breakdown: c.score_breakdown ?? null,
    recommendation: c.recommendation ?? null,
    ocean_traits: c.ocean_traits ?? null,
    hr_notes_list: c.hr_notes_list ?? null,
    override: c.override ?? null,
  }));
  await upsertAll("candidates", candidates, "candidates");

  const users = readJSON("users.json");
  await upsertAll("users", users, "users");

  const scores = readJSON("scores.json").map((s) => ({
    score_id: s.score_id,
    candidate_id: s.candidate_id,
    job_id: s.job_id,
    combined_score: s.combined_score,
    scored_date: s.scored_date,
    payload: s,
  }));
  await upsertAll("scores", scores, "scores");

  const whatsappLog = readJSON("whatsapp-log.json");
  await upsertAll(
    "whatsapp_log",
    whatsappLog.map((w) => ({ payload: w })),
    "whatsapp_log"
  );

  const whatsappReplies = readJSON("whatsapp-replies.json");
  await upsertAll(
    "whatsapp_replies",
    whatsappReplies.map((w) => ({ payload: w })),
    "whatsapp_replies"
  );

  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});

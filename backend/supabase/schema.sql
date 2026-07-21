-- PeopleQuest Talent AI — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Mirrors the current backend/data/*.json shapes: scalar fields become real
-- columns (anything routes filter/sort on), nested/variable-shape fields stay jsonb.

create table if not exists companies (
  id text primary key,
  name text not null,
  industry text,
  accent text,
  initials text
);

create table if not exists jobs (
  job_id text primary key,
  company text references companies(id),
  role_title text,
  industry text,
  location text,
  role_level text,
  portal_token text unique,
  hr_whatsapp_alerts boolean default false,
  hr_contact_phone text,
  criteria_generated_by text,
  criteria_locked boolean default false,
  age_band jsonb,
  requirements jsonb,
  criteria jsonb,
  thresholds jsonb,
  benchmark jsonb,
  success_profile jsonb,
  score_weights jsonb,
  pipeline_stages jsonb,
  interview_slots jsonb
);

create table if not exists candidates (
  candidate_id text primary key,
  job_id text references jobs(job_id) on delete cascade,
  source text,
  submitted_date text,
  parse_confidence_overall numeric,
  low_confidence_warning boolean default false,
  portal_status text,
  ocean_completed boolean default false,
  interview_completed boolean default false,
  interview_mode text,
  profile jsonb,
  score jsonb,
  score_breakdown jsonb,
  recommendation jsonb,
  ocean_traits jsonb,
  hr_notes_list jsonb,
  override jsonb
);

create table if not exists users (
  id text primary key,
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text,
  created_at timestamptz default now()
);

create table if not exists scores (
  score_id text primary key,
  candidate_id text references candidates(candidate_id) on delete cascade,
  job_id text references jobs(job_id) on delete cascade,
  combined_score numeric,
  scored_date date,
  payload jsonb
);

create table if not exists whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  candidate_id text,
  direction text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists whatsapp_replies (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  candidate_id text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_candidates_job_id on candidates(job_id);
create index if not exists idx_scores_candidate_id on scores(candidate_id);
create index if not exists idx_scores_job_id on scores(job_id);
create index if not exists idx_jobs_company on jobs(company);

import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { generateCriteria } from "../services/criteriaGenerator.js";
import {
  DEFAULT_PIPELINE,
  redistribute,
  sourceShares,
  pipelineStageList,
  reconcileCandidate,
  candidateStageKey,
} from "../services/pipeline.js";
import { notify, whatsappConfigured } from "../services/whatsappService.js";
import { getSalaryBenchmark, compareToMarket, listBenchmarks, benchmarkRegions, benchmarkIndustries, suggestSalary, regionMultiplier, rm } from "../services/salaryBenchmark.js";
import { computeLiveAskingRate } from "../services/liveSalarySignal.js";
import { readTable, writeTable, insertRow, deleteRow } from "../services/store.js";
import { rescoreJobCandidates } from "../services/rescoring.js";
import { computeSuccessFit } from "../services/successFit.js";
import { guardJobParam } from "../middleware/companyScope.js";
import { createJobFromParams, weightsValid } from "../services/jobCreation.js";
import { resolvePermissions, canSeeJob, canEditJob } from "../services/permissions.js";
import { requirePermission, requireLevel1, requireEditJob } from "../middleware/requirePermission.js";
import { logAction } from "../services/auditLog.js";

const router = Router();
guardJobParam(router);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const TEMPLATES_PATH = path.join(DATA_DIR, "industry-templates.json");

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

// Adds RM-formatted labels to a live_asking_rate result, matching the
// min_label/median_label/max_label convention the published benchmark uses.
function withLabels(rate) {
  if (!rate || rate.confidence === "insufficient") return rate;
  return { ...rate, median_label: rm(rate.median), min_label: rm(rate.min), max_label: rm(rate.max) };
}

// GET /api/jobs — all jobs
router.get("/jobs", async (req, res) => {
  try {
    let jobs = await readTable("jobs");
    if (req.user?.company_id) jobs = jobs.filter((j) => j.company?.id === req.user.company_id);
    // Archived jobs are soft-removed — hide them from the normal list
    // unless explicitly asked for (?archived=true), same idea as most
    // "trash" views.
    if (req.query.archived !== "true") jobs = jobs.filter((j) => !j.archived);
    if (req.user?.company_id) {
      const permissions = await resolvePermissions(req.user);
      jobs = jobs.filter((j) => canSeeJob(req.user, permissions, j));
    }
    res.json(jobs);
  } catch (err) {
    console.error("list jobs error:", err);
    res.status(500).json({ error: "Failed to load jobs." });
  }
});

// GET /api/industry-templates — starter criteria per industry
router.get("/industry-templates", (req, res) => {
  try {
    res.json(readJSON(TEMPLATES_PATH));
  } catch {
    res.status(500).json({ error: "Failed to load templates." });
  }
});

// POST /api/generate-criteria — AI-generated criteria for a role
router.post("/generate-criteria", async (req, res) => {
  try {
    const { industry, role_title, key_responsibilities = [], role_level = "entry" } = req.body;
    if (!industry || !role_title)
      return res.status(400).json({ error: "industry and role_title are required." });
    const criteria = await generateCriteria({ industry, role_title, key_responsibilities, role_level });
    res.json({ criteria, role_level, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error("generate-criteria error:", err);
    res.status(500).json({ error: "Failed to generate criteria." });
  }
});

// GET /api/jobs/:jobId/suggest-salary?level=junior|mid|senior
// AI/market-suggested salary budget for the role at a target experience level.
router.get("/jobs/:jobId/suggest-salary", async (req, res) => {
  try {
    const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });
    const level = ["junior", "mid", "senior"].includes(req.query.level) ? req.query.level : "mid";
    const s = suggestSalary(job.role_title, job.location, level);
    if (!s) return res.json({ available: false });
    res.json({ available: true, ...s });
  } catch (err) {
    console.error("suggest-salary error:", err);
    res.status(500).json({ error: "Failed to suggest a salary." });
  }
});

// GET /api/salary-center?region= — full benchmark catalogue for the Salary Center.
router.get("/salary-center", async (req, res) => {
  try {
    const base = listBenchmarks(req.query.region || "");
    // Live asking rate per row — candidates' own expected_salary, aggregated
    // across every job matching that category (never blended into the
    // published figures; returned alongside them, see liveSalarySignal.js).
    let candidates = [];
    try { candidates = await readTable("candidates"); } catch { candidates = []; }
    const jobs = await readTable("jobs");
    const region = req.query.region ? regionMultiplier(req.query.region).region : null;
    const roles = base.roles.map((r) => ({
      ...r,
      live_asking_rate: withLabels(computeLiveAskingRate({ candidates, jobs, category: r.category, region })),
    }));
    res.json({ ...base, roles, regions: benchmarkRegions(), industries: benchmarkIndustries() });
  } catch (err) {
    console.error("salary-center error:", err);
    res.status(500).json({ error: "Failed to load salary center." });
  }
});

// GET /api/jobs/:jobId/salary-benchmark — indicative market band for the role
// (DOSM 2023) and how the role's budget compares to it, plus the live asking
// rate from your own candidates for this same role category.
router.get("/jobs/:jobId/salary-benchmark", async (req, res) => {
  try {
    const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });
    const benchmark = getSalaryBenchmark(job.role_title, job.location);
    if (!benchmark) return res.json({ available: false });
    const sp = job.successProfile || {};
    const budgetMax = Number(sp.salary_budget_max) || 0;
    const budgetMin = Number(sp.salary_budget_min) || 0;
    const budget_vs_market = budgetMax ? compareToMarket(budgetMax, benchmark) : null;

    let candidates = [];
    try { candidates = await readTable("candidates"); } catch { candidates = []; }
    const jobs = await readTable("jobs");
    const region = regionMultiplier(job.location).region;
    const live_asking_rate = withLabels(computeLiveAskingRate({ candidates, jobs, category: benchmark.category, region }));

    res.json({ available: true, benchmark, budget: { min: budgetMin, max: budgetMax }, budget_vs_market, live_asking_rate });
  } catch (err) {
    console.error("salary-benchmark error:", err);
    res.status(500).json({ error: "Failed to load salary benchmark." });
  }
});

// GET /api/whatsapp/status — is WhatsApp actually wired up on THIS server?
// Reports config state without exposing any secret (the sandbox FROM is public).
router.get("/whatsapp/status", (req, res) => {
  const from = process.env.TWILIO_WHATSAPP_FROM || "";
  res.json({
    configured: whatsappConfigured,
    from: from ? from.replace(/\d(?=\d{4})/g, "*") : null,
    sandbox: from.includes("14155238886"),
    frontend_url_set: !!process.env.FRONTEND_URL,
  });
});

// POST /api/jobs/:jobId/send-portal-link — share the application link via WhatsApp
router.post("/jobs/:jobId/send-portal-link", async (req, res) => {
  try {
    const { candidate_name, phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });
    const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });

    const base = process.env.FRONTEND_URL || "";
    const url = `${base}/apply/${job.portal_token}`;
    const minutes = job.pipeline_stages?.ocean_assessment?.enabled === false ? 5 : 8;
    const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const expiry = expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const result = await notify(phone, "portal_link", {
      name: candidate_name,
      role: job.role_title,
      url,
      minutes,
      expiry,
    });

    res.json({
      ok: true,
      message_id: result.sid || null,
      skipped: !!result.skipped,
      reason: result.reason || result.error || null,
      portal_url: url,
    });
  } catch (err) {
    console.error("send-portal-link error:", err);
    res.status(500).json({ error: "Failed to send portal link." });
  }
});

// PATCH /api/jobs/:jobId/whatsapp-settings — { hr_whatsapp_alerts, hr_contact_phone }
router.patch("/jobs/:jobId/whatsapp-settings", async (req, res) => {
  try {
    const { hr_whatsapp_alerts, hr_contact_phone } = req.body;
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });
    if (typeof hr_whatsapp_alerts === "boolean") jobs[idx].hr_whatsapp_alerts = hr_whatsapp_alerts;
    if (typeof hr_contact_phone === "string") jobs[idx].hr_contact_phone = hr_contact_phone;
    await writeTable("jobs", jobs);
    res.json({
      job_id: jobs[idx].job_id,
      hr_whatsapp_alerts: !!jobs[idx].hr_whatsapp_alerts,
      hr_contact_phone: jobs[idx].hr_contact_phone || "",
    });
  } catch (err) {
    console.error("whatsapp-settings error:", err);
    res.status(500).json({ error: "Failed to update settings." });
  }
});

// GET /api/analytics — global, cross-role analytics for the workspace dashboard
router.get("/analytics", async (req, res) => {
  try {
    const companyFilter = req.user?.company_id || req.query.company || null;
    let jobs = await readTable("jobs");
    if (companyFilter) jobs = jobs.filter((j) => j.company?.id === companyFilter);
    let candidates = [];
    try {
      candidates = await readTable("candidates");
    } catch {
      candidates = [];
    }

    const todayMs = Date.now();
    const by_stage = { cv_submission: 0, ocean_assessment: 0, interview: 0, offer: 0, rejected: 0 };
    const by_lane = { green: 0, amber: 0, red: 0 };
    const scores = [];
    const stale = [];

    // AI-layer operations: what PeopleQuest itself owns, as opposed to the
    // client ATS's hiring lifecycle. These drive the analyst dashboard.
    const ai_ops = {
      scored: 0,
      unscored: 0,
      awaiting_assessment: 0,
      awaiting_interview: 0,
      low_confidence: 0,
      dealbreakers: 0,
      missing_must_haves: 0,
    };

    const jobById = Object.fromEntries(jobs.map((j) => [j.job_id, j]));
    if (companyFilter) candidates = candidates.filter((c) => jobById[c.job_id]);
    const perRole = {};
    for (const j of jobs) {
      perRole[j.job_id] = {
        job_id: j.job_id,
        title: j.role_title,
        dept: j.industry,
        location: j.location,
        applicants: 0,
        scoreSum: 0,
        scoreN: 0,
        g: 0,
        a: 0,
        r: 0,
        stale: 0,
        names: [],
      };
    }

    for (const c of candidates) {
      const job = jobById[c.job_id];
      if (!job) continue;
      const pr = perRole[c.job_id];
      pr.applicants += 1;
      if (c.profile?.name) pr.names.push(c.profile.name);

      const stage = candidateStageKey(c, job);
      by_stage[stage] = (by_stage[stage] || 0) + 1;

      const lane = c.score?.lane;
      if (lane && by_lane[lane] != null) {
        by_lane[lane] += 1;
        pr[lane === "green" ? "g" : lane === "amber" ? "a" : "r"] += 1;
      }

      if (typeof c.score?.combined_score === "number") {
        scores.push(c.score.combined_score);
        pr.scoreSum += c.score.combined_score;
        pr.scoreN += 1;
        ai_ops.scored += 1;
      } else {
        ai_ops.unscored += 1;
      }

      // Work that belongs to the AI layer, not to the client's pipeline.
      if (!c.ocean_completed) ai_ops.awaiting_assessment += 1;
      if (!c.interview_completed) ai_ops.awaiting_interview += 1;
      if (c.low_confidence_warning) ai_ops.low_confidence += 1;
      if (c.score?.dealbreaker_triggered) ai_ops.dealbreakers += 1;
      if ((c.score?.missing_must_haves || []).length > 0) ai_ops.missing_must_haves += 1;

      const submitted = c.submitted_date ? new Date(c.submitted_date).getTime() : todayMs;
      const days = Math.max(0, Math.round((todayMs - submitted) / 86400000));
      if (stage !== "offer" && stage !== "rejected" && days >= 5) {
        pr.stale += 1;
        stale.push({ job_id: c.job_id, candidate_id: c.candidate_id, name: c.profile?.name || "Candidate", days_waiting: days, current_stage: stage, role: job.role_title });
      }
    }

    const total = candidates.length;
    const avg = (n, d) => (d ? Math.round(n / d) : 0);
    const laneTotal = by_lane.green + by_lane.amber + by_lane.red || 1;
    stale.sort((a, b) => b.days_waiting - a.days_waiting);

    // Average score + applicant count by submission month, last 4 months with data.
    const monthBuckets = {};
    for (const c of candidates) {
      if (!c.submitted_date) continue;
      const d = new Date(c.submitted_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthBuckets[key] = monthBuckets[key] || { sum: 0, n: 0, applicants: 0, label: d.toLocaleDateString("en-US", { month: "short" }) };
      monthBuckets[key].applicants += 1;
      if (typeof c.score?.combined_score === "number") {
        monthBuckets[key].sum += c.score.combined_score;
        monthBuckets[key].n += 1;
      }
    }
    const monthKeys = Object.keys(monthBuckets).sort().slice(-4);
    const score_trend = monthKeys.map((k) => ({ month: monthBuckets[k].label, avg: avg(monthBuckets[k].sum, monthBuckets[k].n), applicants: monthBuckets[k].applicants }));
    const lastTwoScores = monthKeys.slice(-2).map((k) => avg(monthBuckets[k].sum, monthBuckets[k].n));
    const score_trend_delta_pct = lastTwoScores.length === 2 && lastTwoScores[0] > 0 ? Math.round(((lastTwoScores[1] - lastTwoScores[0]) / lastTwoScores[0]) * 1000) / 10 : null;
    const lastTwoApplicants = monthKeys.slice(-2).map((k) => monthBuckets[k].applicants);
    const applicant_trend_delta_pct = lastTwoApplicants.length === 2 && lastTwoApplicants[0] > 0 ? Math.round(((lastTwoApplicants[1] - lastTwoApplicants[0]) / lastTwoApplicants[0]) * 1000) / 10 : null;

    const roles = Object.values(perRole)
      .map((p) => {
        // Is the scoring model ready for this position? Criteria generated and a
        // Success Profile defined — without both, scores aren't trustworthy.
        const j = jobById[p.job_id];
        const has_criteria = (j?.criteria || []).length > 0;
        const has_profile = !!(j?.successProfile && (j.successProfile.must_haves || []).length > 0);
        return {
          job_id: p.job_id,
          title: p.title,
          dept: p.dept,
          location: p.location,
          applicants: p.applicants,
          avg: avg(p.scoreSum, p.scoreN),
          g: p.g,
          a: p.a,
          r: p.r,
          stale: p.stale,
          has_criteria,
          has_profile,
          model_ready: has_criteria && has_profile,
          avatars: p.names.slice(0, 4).map((n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()),
          more: Math.max(0, p.names.length - 4),
        };
      })
      .sort((a, b) => b.applicants - a.applicants);

    res.json({
      total_applicants: total,
      avg_score: avg(scores.reduce((s, x) => s + x, 0), scores.length),
      green_count: by_lane.green,
      in_interview: by_stage.interview,
      offers_pending: by_stage.offer,
      open_roles: jobs.length,
      by_stage,
      lane_breakdown: {
        green: { count: by_lane.green, pct: Math.round((by_lane.green / laneTotal) * 100) },
        amber: { count: by_lane.amber, pct: Math.round((by_lane.amber / laneTotal) * 100) },
        red: { count: by_lane.red, pct: Math.round((by_lane.red / laneTotal) * 100) },
      },
      roles,
      ai_ops,
      models_pending: roles.filter((r) => !r.model_ready).length,
      stale_count: stale.length,
      stale_top: stale[0] || null,
      score_trend,
      score_trend_delta_pct,
      applicant_trend_delta_pct,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("global analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics." });
  }
});

// GET /api/candidates-recent?limit=  — top-scored candidates across every role,
// for the global dashboard's cross-role candidate table.
router.get("/candidates-recent", async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 8));
    const companyFilter = req.user?.company_id || req.query.company || null;
    let jobs = await readTable("jobs");
    if (companyFilter) jobs = jobs.filter((j) => j.company?.id === companyFilter);
    const jobById = Object.fromEntries(jobs.map((j) => [j.job_id, j]));
    let candidates = [];
    try { candidates = await readTable("candidates"); } catch { candidates = []; }

    const nowMs = Date.now();
    const results = candidates
      .map((c) => {
        const job = jobById[c.job_id];
        if (!job) return null;
        const stage = candidateStageKey(c, job);
        const submitted = c.submitted_date ? new Date(c.submitted_date).getTime() : nowMs;
        const days_waiting = Math.max(0, Math.round((nowMs - submitted) / 86400000));
        const is_stale = stage !== "offer" && stage !== "rejected" && days_waiting >= 5;
        return {
          candidate_id: c.candidate_id,
          job_id: c.job_id,
          name: c.profile?.name || "Unnamed",
          experience_years: c.profile?.total_experience_months != null ? Math.round(c.profile.total_experience_months / 12) : null,
          location: c.profile?.contact?.location?.split(",")[0] || null,
          role_title: job.role_title,
          company_name: job.company?.name || null,
          score: c.score?.combined_score ?? null,
          lane: c.score?.lane || null,
          recommendation: c.recommendation?.recommendation || null,
          stage,
          days_waiting,
          is_stale,
          // AI-layer attributes — what PeopleQuest tracks, vs the ATS's stage.
          ocean_completed: !!c.ocean_completed,
          interview_completed: !!c.interview_completed,
          low_confidence: !!c.low_confidence_warning,
          dealbreaker: !!c.score?.dealbreaker_triggered,
          missing_must_haves: (c.score?.missing_must_haves || []).length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .slice(0, limit);

    res.json({ results });
  } catch (err) {
    console.error("candidates-recent error:", err);
    res.status(500).json({ error: "Failed to load candidates." });
  }
});

// GET /api/candidates-search?q=  — global candidate search for the header search
// bar. Matches candidate name, role title, or company name; returns the
// top 8 across every company/role.
router.get("/candidates-search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    if (!q) return res.json({ results: [] });

    const jobs = await readTable("jobs");
    const jobById = Object.fromEntries(jobs.map((j) => [j.job_id, j]));
    let candidates = [];
    try { candidates = await readTable("candidates"); } catch { candidates = []; }

    const results = [];
    for (const c of candidates) {
      const job = jobById[c.job_id];
      if (!job) continue;
      const name = c.profile?.name || "";
      const hay = `${name} ${job.role_title} ${job.company?.name || ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
      results.push({
        candidate_id: c.candidate_id,
        job_id: c.job_id,
        name: name || "Unnamed",
        role_title: job.role_title,
        company_name: job.company?.name || null,
        score: c.score?.combined_score ?? null,
        lane: c.score?.lane || null,
      });
      if (results.length >= 8) break;
    }
    res.json({ results });
  } catch (err) {
    console.error("candidates-search error:", err);
    res.status(500).json({ error: "Search failed." });
  }
});

// GET /api/alerts — real notification feed: stale candidates (5+ days with no
// action) and flagged pre-hire checks awaiting HR review. Powers the header bell.
router.get("/alerts", async (req, res) => {
  try {
    const companyFilter = req.user?.company_id || req.query.company || null;
    let jobs = await readTable("jobs");
    if (companyFilter) jobs = jobs.filter((j) => j.company?.id === companyFilter);
    const jobById = Object.fromEntries(jobs.map((j) => [j.job_id, j]));
    let candidates = [];
    try { candidates = await readTable("candidates"); } catch { candidates = []; }

    const todayMs = Date.now();
    const alerts = [];

    for (const c of candidates) {
      const job = jobById[c.job_id];
      if (!job) continue;
      const stage = candidateStageKey(c, job);
      const name = c.profile?.name || "Candidate";

      if (stage !== "offer" && stage !== "rejected") {
        const submitted = c.submitted_date ? new Date(c.submitted_date).getTime() : todayMs;
        const days = Math.max(0, Math.round((todayMs - submitted) / 86400000));
        if (days >= 5) {
          alerts.push({
            type: "stale", severity: days >= 10 ? "high" : "medium",
            job_id: c.job_id, candidate_id: c.candidate_id,
            message: `${name} has been waiting ${days} days at ${stage.replace("_", " ")}`,
            role: job.role_title, at: c.submitted_date || null,
          });
        }
      }

      for (const [key, check] of Object.entries(c.pre_hire_checks || {})) {
        if (check?.status === "flagged") {
          alerts.push({
            type: "flagged_check", severity: "high",
            job_id: c.job_id, candidate_id: c.candidate_id,
            message: `${name}: ${key.replace("_", " ")} flagged — review before any offer`,
            role: job.role_title, at: check.updated || null,
          });
        }
      }
    }

    const rank = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
    res.json({ alerts: alerts.slice(0, 20), count: alerts.length });
  } catch (err) {
    console.error("alerts error:", err);
    res.status(500).json({ error: "Failed to load alerts." });
  }
});

// GET /api/jobs/:jobId/analytics — pipeline analytics for a role
router.get("/jobs/:jobId/analytics", async (req, res) => {
  try {
    const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });

    let candidates = [];
    try {
      candidates = (await readTable("candidates")).filter((c) => c.job_id === job.job_id);
    } catch {
      candidates = [];
    }

    const total = candidates.length;
    if (total === 0) {
      return res.json({ job_id: job.job_id, role_title: job.role_title, total_applicants: 0, empty: true });
    }

    const by_stage = { cv_submission: 0, ocean_assessment: 0, interview: 0, offer: 0, rejected: 0 };
    const by_lane = { green: 0, amber: 0, red: 0 };
    const recommendation_summary = { hire: 0, hold: 0, reject: 0 };
    const scores = [];
    const daysList = [];
    let oldest = null;
    const todayMs = Date.now();

    for (const c of candidates) {
      const stage = candidateStageKey(c, job);
      by_stage[stage] = (by_stage[stage] || 0) + 1;

      const lane = c.score?.lane;
      if (lane && by_lane[lane] != null) by_lane[lane] += 1;

      const rec = (c.recommendation?.recommendation || "").toLowerCase();
      if (recommendation_summary[rec] != null) recommendation_summary[rec] += 1;

      if (typeof c.score?.combined_score === "number") scores.push(c.score.combined_score);

      const submitted = c.submitted_date ? new Date(c.submitted_date).getTime() : todayMs;
      const days = Math.max(0, Math.round((todayMs - submitted) / 86400000));
      daysList.push(days);

      if (stage !== "offer" && stage !== "rejected") {
        if (!oldest || days > oldest.days_waiting) {
          oldest = { name: c.profile?.name || "Candidate", days_waiting: days, current_stage: stage };
        }
      }
    }

    const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, x) => a + x, 0) / arr.length) : 0);

    res.json({
      job_id: job.job_id,
      role_title: job.role_title,
      total_applicants: total,
      by_stage,
      by_lane,
      avg_score: avg(scores),
      highest_score: scores.length ? Math.max(...scores) : 0,
      lowest_score: scores.length ? Math.min(...scores) : 0,
      recommendation_summary,
      avg_days_to_current_stage: Math.round((daysList.reduce((a, x) => a + x, 0) / total) * 10) / 10,
      oldest_pending_candidate: oldest,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics." });
  }
});

// GET /api/jobs/:jobId/insights — "why candidates fall short" for this role:
// the most common missing must-have, most-triggered dealbreaker, most-frequent
// OCEAN mismatch, and outstanding assessments. Pure aggregation over each
// candidate's already-computed Success Profile fit — no new scoring logic,
// just rolling up per-candidate results across the whole applicant pool so HR
// can see whether the Success Profile is miscalibrated or sourcing is off.
router.get("/jobs/:jobId/insights", async (req, res) => {
  try {
    const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });

    const candidates = (await readTable("candidates")).filter((c) => c.job_id === job.job_id);
    const hasProfile = !!(job.successProfile && Object.keys(job.successProfile).length);

    const missCounts = new Map(); // must-have text -> count not met
    const dealbreakerCounts = new Map(); // dealbreaker text -> count triggered
    const oceanCounts = new Map(); // trait label -> count mismatched
    let fitScored = 0;
    let awaitingOcean = [];
    let awaitingInterview = [];

    for (const c of candidates) {
      if (!c.ocean_completed) awaitingOcean.push({ candidate_id: c.candidate_id, name: c.profile?.name || "Candidate" });
      if (!c.interview_completed) awaitingInterview.push({ candidate_id: c.candidate_id, name: c.profile?.name || "Candidate" });

      if (!hasProfile) continue;
      const fit = computeSuccessFit(c, job);
      if (!fit) continue;
      fitScored += 1;

      for (const m of fit.must_haves) if (!m.met) missCounts.set(m.text, (missCounts.get(m.text) || 0) + 1);
      for (const d of fit.dealbreakers) if (d.triggered) dealbreakerCounts.set(d.text, (dealbreakerCounts.get(d.text) || 0) + 1);
      if (fit.has_ocean) for (const o of fit.ocean || []) if (!o.match) oceanCounts.set(o.trait, (oceanCounts.get(o.trait) || 0) + 1);
    }

    const rank = (map) => [...map.entries()]
      .map(([text, count]) => ({ text, count, pct: fitScored ? Math.round((count / fitScored) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    res.json({
      job_id: job.job_id,
      role_title: job.role_title,
      total_applicants: candidates.length,
      fit_scored: fitScored,
      has_profile: hasProfile,
      missing_must_haves: rank(missCounts),
      dealbreakers: rank(dealbreakerCounts),
      ocean_mismatches: rank(oceanCounts),
      awaiting_ocean: awaitingOcean,
      awaiting_interview: awaitingInterview,
    });
  } catch (err) {
    console.error("job insights error:", err);
    res.status(500).json({ error: "Failed to load insights." });
  }
});

// GET /api/jobs/:jobId/pipeline — active pipeline + redistributed weights
router.get("/jobs/:jobId/pipeline", async (req, res) => {
  const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({
    job_id: job.job_id,
    stages: pipelineStageList(job),
    criteria: redistribute(job),
    source_shares: sourceShares(job),
  });
});

// PATCH /api/jobs/:jobId/pipeline — toggle optional stages, recompute candidate scores
router.patch("/jobs/:jobId/pipeline", requireEditJob, async (req, res) => {
  try {
    const { stages } = req.body; // { ocean_assessment: bool, interview: bool }
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });

    const job = jobs[idx];
    const current = job.pipeline_stages || { ...DEFAULT_PIPELINE };

    // Only the unlocked stages can be toggled.
    for (const key of ["ocean_assessment", "interview"]) {
      if (typeof stages?.[key] === "boolean") {
        current[key] = { ...(current[key] || {}), enabled: stages[key], locked: false };
      }
    }
    // Ensure locked stages stay on.
    current.cv_submission = { enabled: true, locked: true };
    current.offer = { enabled: true, locked: true };
    job.pipeline_stages = current;
    jobs[idx] = job;
    await writeTable("jobs", jobs);

    // Reconcile existing candidates for this role so dashboards stay correct.
    try {
      const candidates = await readTable("candidates");
      let changed = false;
      for (const c of candidates) {
        if (c.job_id === job.job_id) {
          reconcileCandidate(c, job);
          changed = true;
        }
      }
      if (changed) await writeTable("candidates", candidates);
    } catch (e) {
      console.error("pipeline reconcile error:", e.message);
    }

    res.json({
      job_id: job.job_id,
      stages: pipelineStageList(job),
      criteria: redistribute(job),
      source_shares: sourceShares(job),
    });
  } catch (err) {
    console.error("patch pipeline error:", err);
    res.status(500).json({ error: "Failed to update pipeline." });
  }
});

// GET /api/jobs/:jobId/interview-slots — all slots for this role, newest first,
// with the booked candidate's name resolved for display.
router.get("/jobs/:jobId/interview-slots", async (req, res) => {
  const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  const candidates = await readTable("candidates");
  const slots = (job.interview_slots || [])
    .slice()
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map((s) => ({
      ...s,
      candidate_name: s.candidate_id ? candidates.find((c) => c.candidate_id === s.candidate_id)?.profile?.name || "Unknown" : null,
    }));
  res.json({ slots });
});

// POST /api/jobs/:jobId/interview-slots  { slots: [{ start, duration_minutes }] }
// Bulk-creates open interview time slots that candidates can self-book.
router.post("/jobs/:jobId/interview-slots", async (req, res) => {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots) || slots.length === 0) return res.status(400).json({ error: "slots must be a non-empty array." });

    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });

    const job = jobs[idx];
    job.interview_slots = job.interview_slots || [];
    const created = [];
    for (const s of slots) {
      if (!s?.start || Number.isNaN(new Date(s.start).getTime())) continue;
      const slot = {
        slot_id: uuidv4(),
        start: new Date(s.start).toISOString(),
        duration_minutes: Number(s.duration_minutes) > 0 ? Number(s.duration_minutes) : 30,
        candidate_id: null,
        booked_at: null,
      };
      job.interview_slots.push(slot);
      created.push(slot);
    }
    if (created.length === 0) return res.status(400).json({ error: "No valid slots to add." });
    jobs[idx] = job;
    await writeTable("jobs", jobs);
    res.status(201).json({ slots: created });
  } catch (err) {
    console.error("create interview slots error:", err);
    res.status(500).json({ error: "Failed to create slots." });
  }
});

// DELETE /api/jobs/:jobId/interview-slots/:slotId — remove an open (unbooked) slot
router.delete("/jobs/:jobId/interview-slots/:slotId", async (req, res) => {
  try {
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });
    const job = jobs[idx];
    const slot = (job.interview_slots || []).find((s) => s.slot_id === req.params.slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found." });
    if (slot.candidate_id) return res.status(400).json({ error: "Can't delete a booked slot — cancel the booking first." });
    job.interview_slots = job.interview_slots.filter((s) => s.slot_id !== req.params.slotId);
    jobs[idx] = job;
    await writeTable("jobs", jobs);
    res.json({ ok: true });
  } catch (err) {
    console.error("delete interview slot error:", err);
    res.status(500).json({ error: "Failed to delete slot." });
  }
});

// POST /api/jobs/:jobId/interview-slots/:slotId/cancel — HR frees up a booked slot
// (e.g. the candidate asked to reschedule over the phone).
router.post("/jobs/:jobId/interview-slots/:slotId/cancel", async (req, res) => {
  try {
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });
    const job = jobs[idx];
    const slot = (job.interview_slots || []).find((s) => s.slot_id === req.params.slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found." });
    slot.candidate_id = null;
    slot.booked_at = null;
    jobs[idx] = job;
    await writeTable("jobs", jobs);
    res.json({ ok: true });
  } catch (err) {
    console.error("cancel interview slot error:", err);
    res.status(500).json({ error: "Failed to cancel slot." });
  }
});

// GET /api/jobs/:jobId/criteria — criteria + metadata for a job
router.get("/jobs/:jobId/criteria", async (req, res) => {
  const job = (await readTable("jobs")).find((j) => j.job_id === req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({
    job_id: job.job_id,
    criteria: job.criteria || [],
    criteria_generated_by: job.criteria_generated_by,
    criteria_locked: job.criteria_locked,
  });
});

// PATCH /api/jobs/:jobId/criteria — replace a job's criteria
router.patch("/jobs/:jobId/criteria", requireEditJob, async (req, res) => {
  try {
    const { criteria } = req.body;
    if (!Array.isArray(criteria) || criteria.length === 0)
      return res.status(400).json({ error: "criteria array is required." });
    if (!weightsValid(criteria))
      return res.status(400).json({ error: "Criteria weights must sum to 100%" });

    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });

    jobs[idx].criteria = criteria;
    jobs[idx].criteria_generated_by = "edited";
    await writeTable("jobs", jobs);
    res.json(jobs[idx]);
  } catch (err) {
    console.error("patch criteria error:", err);
    res.status(500).json({ error: "Failed to update criteria." });
  }
});

// PATCH /api/jobs/:jobId/scoring-weights
// Body: { score_weights?: { profile, ocean, interview }, motivation?: { enabled, weight },
//          interview_weights?: { [criterion_id]: weight } }
//   score_weights      — the top-level model split (Success-Profile-fit / OCEAN / Interview).
//   motivation         — toggles a "Motivation & fit" interview criterion on/off. `weight` is
//                         its share of the WHOLE criteria set (e.g. 0.08 = 8%), carved out of
//                         the interview criteria proportionally so the total stays 100%.
//   interview_weights  — direct per-criterion overrides for every interview-source criterion
//                         (including "i_motivation" if enabled), each a share of the WHOLE
//                         criteria set. Applied AFTER motivation, so HR can enable Motivation
//                         and immediately set exact shares in one save. Their sum must land
//                         within 1% of score_weights.interview (existing value if not also
//                         being changed in this same request) — same tolerance the general
//                         criteria editor already uses, so this role's "interview" share
//                         and its criteria never quietly drift apart.
// Re-scores every already-scored candidate for this role afterward — recombining their
// EXISTING sub-scores at the new weights, never re-interviewing anyone.
router.patch("/jobs/:jobId/scoring-weights", requireEditJob, async (req, res) => {
  try {
    const { score_weights, motivation, interview_weights } = req.body || {};
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });
    const job = jobs[idx];

    if (score_weights) {
      const { profile, ocean, interview } = score_weights;
      if (![profile, ocean, interview].every((n) => typeof n === "number" && n > 0)) {
        return res.status(400).json({ error: "profile, ocean and interview must all be positive numbers." });
      }
      const sum = profile + ocean + interview;
      job.score_weights = {
        profile: Math.round((profile / sum) * 1000) / 1000,
        ocean: Math.round((ocean / sum) * 1000) / 1000,
        interview: Math.round((interview / sum) * 1000) / 1000,
      };
    }

    if (motivation) {
      const criteria = job.criteria || [];
      const existing = criteria.find((c) => c.id === "i_motivation");
      const otherInterview = criteria.filter((c) => c.source === "interview" && c.id !== "i_motivation");
      const nonInterview = criteria.filter((c) => c.source !== "interview");
      const S = otherInterview.reduce((a, c) => a + (c.weight || 0), 0);

      if (motivation.enabled) {
        const M = Number(motivation.weight) || 0.08;
        if (S <= 0) return res.status(400).json({ error: "This role has no interview criteria yet — generate criteria first." });
        if (M <= 0 || M >= S) return res.status(400).json({ error: "Motivation's weight must leave room for the existing interview criteria." });
        const factor = (S - M) / S;
        const rescaled = otherInterview.map((c) => ({ ...c, weight: Math.round(c.weight * factor * 1000) / 1000 }));
        const motivationCriterion = {
          id: "i_motivation",
          name: "Motivation & fit",
          source: "interview",
          weight: Math.round(M * 1000) / 1000,
          description: "Genuine interest in this specific role and commitment to it — scored on evidence of researched, specific reasons, not on affinity or \"culture fit\".",
        };
        job.criteria = [...nonInterview, ...rescaled, motivationCriterion];
      } else if (existing) {
        const M = existing.weight || 0;
        const factor = S > 0 ? (S + M) / S : 1;
        const rescaled = otherInterview.map((c) => ({ ...c, weight: Math.round(c.weight * factor * 1000) / 1000 }));
        job.criteria = [...nonInterview, ...rescaled];
      }
    }

    if (interview_weights) {
      const entries = Object.entries(interview_weights);
      if (!entries.every(([, w]) => typeof w === "number" && w > 0)) {
        return res.status(400).json({ error: "Every interview criterion weight must be a positive number." });
      }
      const interviewIds = new Set((job.criteria || []).filter((c) => c.source === "interview").map((c) => c.id));
      if (!entries.every(([id]) => interviewIds.has(id))) {
        return res.status(400).json({ error: "Unknown interview criterion in interview_weights." });
      }
      const targetInterview = job.score_weights?.interview ?? 0.5;
      const sum = entries.reduce((a, [, w]) => a + w, 0);
      if (Math.abs(sum - targetInterview) > 0.01) {
        return res.status(400).json({ error: `Interview criteria must sum to ${Math.round(targetInterview * 100)}% (the Interview share above) — currently ${Math.round(sum * 100)}%.` });
      }
      const weightById = Object.fromEntries(entries);
      job.criteria = (job.criteria || []).map((c) =>
        c.source === "interview" && weightById[c.id] != null ? { ...c, weight: Math.round(weightById[c.id] * 1000) / 1000 } : c
      );
    }

    jobs[idx] = job;
    await writeTable("jobs", jobs);

    const rescored = await rescoreJobCandidates(job);
    res.json({ job, rescored_candidates: rescored });
  } catch (err) {
    console.error("scoring-weights error:", err);
    res.status(500).json({ error: "Failed to update scoring weights." });
  }
});

// PATCH /api/jobs/:jobId/application-form
// Body: { phone?, expected_salary?, cover_letter? } — each "mandatory" | "optional" | "off".
// Controls the public apply form (CandidatePortal) for this role. Name, email, CV and PDPA
// consent are never configurable — they're structurally required to create a candidate at all.
const APPLICATION_FORM_FIELDS = ["phone", "expected_salary", "cover_letter"];
const APPLICATION_FORM_MODES = ["mandatory", "optional", "off"];
router.patch("/jobs/:jobId/application-form", requireEditJob, async (req, res) => {
  try {
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });

    const updates = {};
    for (const field of APPLICATION_FORM_FIELDS) {
      const mode = req.body?.[field];
      if (mode == null) continue;
      if (!APPLICATION_FORM_MODES.includes(mode)) {
        return res.status(400).json({ error: `${field} must be one of: ${APPLICATION_FORM_MODES.join(", ")}` });
      }
      updates[field] = mode;
    }

    jobs[idx].application_form = { ...(jobs[idx].application_form || {}), ...updates };
    await writeTable("jobs", jobs);
    res.json({ application_form: jobs[idx].application_form });
  } catch (err) {
    console.error("application-form error:", err);
    res.status(500).json({ error: "Failed to update the application form." });
  }
});

// POST /api/jobs — create a new role (with AI or supplied criteria)
router.post("/jobs", requirePermission("create_job"), async (req, res) => {
  try {
    // A client login can only ever create roles under their own company —
    // scoped from the verified JWT, never the request body.
    const createdBy = req.user?.company_id ? req.user.id : null;
    const result = await createJobFromParams(req.body, req.user?.company_id, createdBy);
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    await logAction(req, { action: "job.created", target_type: "job", target_id: result.job.job_id, after: { role_title: result.job.role_title } });
    res.status(201).json(result.job);
  } catch (err) {
    console.error("create job error:", err);
    res.status(500).json({ error: "Failed to create job." });
  }
});

// POST /api/jobs/:jobId/archive — soft-removes the role. Level 1 (or staff)
// only; Level 2 can never archive, per spec. Candidates/interviews/comments
// stay fully intact — it just drops out of the normal role list.
router.post("/jobs/:jobId/archive", requireLevel1, async (req, res) => {
  try {
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });
    jobs[idx] = { ...jobs[idx], archived: true, archived_at: new Date().toISOString() };
    await writeTable("jobs", jobs);
    await logAction(req, { action: "job.archived", target_type: "job", target_id: req.params.jobId });
    res.json({ ok: true, job_id: req.params.jobId });
  } catch (err) {
    console.error("archive job error:", err);
    res.status(500).json({ error: "Failed to archive the role." });
  }
});

// POST /api/jobs/:jobId/unarchive — reverses an archive.
router.post("/jobs/:jobId/unarchive", requireLevel1, async (req, res) => {
  try {
    const jobs = await readTable("jobs");
    const idx = jobs.findIndex((j) => j.job_id === req.params.jobId);
    if (idx === -1) return res.status(404).json({ error: "Job not found." });
    jobs[idx] = { ...jobs[idx], archived: false, archived_at: null };
    await writeTable("jobs", jobs);
    await logAction(req, { action: "job.unarchived", target_type: "job", target_id: req.params.jobId });
    res.json({ ok: true, job_id: req.params.jobId });
  } catch (err) {
    console.error("unarchive job error:", err);
    res.status(500).json({ error: "Failed to restore the role." });
  }
});

// DELETE /api/jobs/:jobId — PERMANENT removal. The DB cascades this to its
// candidates and their scores automatically (foreign keys ON DELETE CASCADE).
// Level 1 (or staff) only — Level 2 can never permanently delete, per spec.
// Archiving is the reversible default; this is a one-way door.
router.delete("/jobs/:jobId", requireLevel1, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = (await readTable("jobs")).find((j) => j.job_id === jobId);
    if (!job) return res.status(404).json({ error: "Job not found." });

    await deleteRow("jobs", jobId);
    await logAction(req, { action: "job.deleted", target_type: "job", target_id: jobId, before: { role_title: job.role_title } });
    res.json({ ok: true, job_id: jobId });
  } catch (err) {
    console.error("delete job error:", err);
    res.status(500).json({ error: "Failed to delete role." });
  }
});

export default router;

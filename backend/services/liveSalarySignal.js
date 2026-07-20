/**
 * Live asking-rate signal — the median expected_salary your own candidates
 * have actually typed into an application, aggregated across every job that
 * matches a benchmark category (not just one vacancy, so the sample is big
 * enough to mean something).
 *
 * Kept separate from salaryBenchmark.js on purpose: that file owns the
 * static, externally-sourced DOSM/JobStreet/Hays data; this one owns a
 * live signal built from candidates' own data. They're shown side by side,
 * never blended into one number — see routes/jobs.js.
 */
import { matchRole, regionMultiplier } from "./salaryBenchmark.js";

const DAY_MS = 86400000;

/**
 * @param {object} opts
 * @param {array}  opts.candidates   full candidates.json
 * @param {array}  opts.jobs         full jobs.json
 * @param {string} opts.category     benchmark row category to aggregate for
 * @param {string|null} opts.region  restrict to one region (from regionMultiplier), or null for national
 * @param {number} opts.days         rolling window, default 90
 * @param {number} opts.minSample    below this, count is returned but no figures are — see note below
 * @returns {{count:number, confidence:'insufficient'|'early'|'confident', window_days:number, min?:number, median?:number, max?:number}}
 *
 * Privacy floor: minSample defaults to 5. Below that, an "aggregate" is really
 * just 1–4 identifiable applicants — showing a median at n=2 lets anyone who
 * knows one candidate's actual ask back out the other's. Never lower this to
 * make a demo look more populated; seed more candidates instead.
 */
export function computeLiveAskingRate({ candidates, jobs, category, region = null, days = 90, minSample = 5 }) {
  const jobById = Object.fromEntries(jobs.map((j) => [j.job_id, j]));
  const cutoff = Date.now() - days * DAY_MS;

  const values = [];
  for (const c of candidates) {
    const salary = c.profile?.expected_salary;
    if (!salary) continue;

    const job = jobById[c.job_id];
    if (!job) continue;

    const rule = matchRole(job.role_title);
    if (!rule || rule.category !== category) continue;

    if (region) {
      const jobRegion = regionMultiplier(job.location).region;
      if (jobRegion !== region) continue;
    }

    const submittedAt = c.submitted_date ? new Date(c.submitted_date).getTime() : null;
    if (submittedAt == null || submittedAt < cutoff) continue;

    values.push(salary);
  }

  const count = values.length;
  if (count < minSample) {
    return { count, confidence: "insufficient", window_days: days };
  }

  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 === 0 ? Math.round((values[mid - 1] + values[mid]) / 2) : values[mid];

  return {
    count,
    min: values[0],
    median,
    max: values[values.length - 1],
    confidence: count >= 30 ? "confident" : "early",
    window_days: days,
  };
}

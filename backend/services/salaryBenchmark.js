/**
 * Salary benchmark — maps a role + location to an indicative Malaysian market
 * band built from real per-role figures cross-validated across DOSM (official)
 * and JobStreet (role-level), with recruitment-market ranges for manager tiers.
 * Regional multipliers (from DOSM state medians) are damped to avoid
 * double-counting the location mix already baked into platform data.
 *
 * Data + methodology: backend/data/salaryBenchmarks.json (see meta.note).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "salaryBenchmarks.json"), "utf-8"));
const SRC = Object.fromEntries((DATA.meta.sources || []).map((s) => [s.id, s]));

const norm = (s) => (s || "").toLowerCase().trim();
const rm = (n) => `RM${Math.round(n).toLocaleString("en-MY")}`;

// Longest keyword match wins, so "outlet supervisor" beats a bare "manager".
function matchRole(roleTitle) {
  const t = norm(roleTitle);
  let best = null, bestLen = 0;
  for (const rule of DATA.roles) {
    for (const kw of rule.match) {
      if (t.includes(kw) && kw.length > bestLen) { best = rule; bestLen = kw.length; }
    }
  }
  return best;
}

function regionMultiplier(location) {
  const loc = norm(location);
  if (!loc) return { mult: 1, region: null };
  for (const [state, mult] of Object.entries(DATA.regional_multipliers)) {
    if (state !== "default" && loc.includes(state)) return { mult, region: state };
  }
  return { mult: DATA.regional_multipliers.default, region: null };
}

/**
 * Indicative market band for a role at a location.
 * @returns null when no role rule matches.
 */
export function getSalaryBenchmark(roleTitle, location) {
  const rule = matchRole(roleTitle);
  if (!rule) return null;
  const floor = DATA.meta.minimum_wage;
  const { mult, region } = regionMultiplier(location);
  // Damp the regional multiplier — platform ranges already blend locations.
  const eff = 1 + (mult - 1) * (DATA.meta.regional_damping ?? 0.6);
  const adj = (n) => Math.max(floor, Math.round((n * eff) / 10) * 10);

  const median = adj(rule.median);
  const min = Math.min(median, adj(rule.min));
  const max = Math.max(median, adj(rule.max));
  const sources = (rule.sources || []).map((id) => SRC[id]?.name || id);

  return {
    median, min, max,
    range_label: `${rm(min)}–${rm(max)}`,
    median_label: rm(median),
    category: rule.category,
    basis: rule.basis || "role-level",
    region: region ? region.replace(/\b\w/g, (c) => c.toUpperCase()) : "Malaysia (national)",
    sources,
    source_short: (rule.sources || []).map((id) => (id === "DOSM2023" ? "DOSM 2023" : id === "JobStreet2026" ? "JobStreet 2026" : "Market")).join(" + "),
    indicative: true,
  };
}

/**
 * Compare an amount (expected salary or budget max) against a benchmark band.
 * @returns { status, label, lane, pct_diff } — pct vs the median.
 */
export function compareToMarket(amount, benchmark) {
  if (!benchmark || !amount) return null;
  const pct = Math.round(((amount - benchmark.median) / benchmark.median) * 100);
  let status, label, lane;
  if (amount < benchmark.min) { status = "below"; label = "Below market"; lane = "blue"; }
  else if (amount > benchmark.max) { status = "above"; label = "Above market"; lane = "amber"; }
  else { status = "within"; label = "At market"; lane = "green"; }
  return { status, label, lane, pct_diff: pct, median: benchmark.median };
}

/**
 * Salary benchmark — maps a role + location to an indicative Malaysian market
 * band, anchored on official DOSM 2023 occupation-group medians, adjusted by a
 * role/seniority factor and a state regional multiplier. Also compares a given
 * expected salary or budget against that band.
 *
 * Data: backend/data/salaryBenchmarks.json (see meta.note for the methodology).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "salaryBenchmarks.json"), "utf-8"));

const norm = (s) => (s || "").toLowerCase().trim();
const rm = (n) => `RM${Math.round(n).toLocaleString("en-MY")}`;

// Pick the best role rule: longest keyword match wins (so "outlet supervisor"
// beats a bare "manager" substring, and "supervisor" beats "crew").
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
  if (!loc) return { mult: DATA.regional_multipliers.default, region: null };
  for (const [state, mult] of Object.entries(DATA.regional_multipliers)) {
    if (state !== "default" && loc.includes(state)) return { mult, region: state };
  }
  return { mult: DATA.regional_multipliers.default, region: null };
}

/**
 * Indicative market band for a role at a location.
 * @returns null when no role rule matches, else { median, min, max, ... }.
 */
export function getSalaryBenchmark(roleTitle, location) {
  const rule = matchRole(roleTitle);
  if (!rule) return null;
  const grp = DATA.occupation_groups[rule.group];
  const { mult, region } = regionMultiplier(location);
  const floor = DATA.meta.minimum_wage;

  const median = Math.max(floor, Math.round(grp.median * rule.seniority_factor * mult));
  // Band: median down to ~-16%, up toward the group mean (skew) — floored at min wage.
  const min = Math.max(floor, Math.round(median * 0.84));
  const max = Math.max(median + 100, Math.round(grp.mean * rule.seniority_factor * mult));

  return {
    median, min, max,
    range_label: `${rm(min)}–${rm(max)}`,
    median_label: rm(median),
    category: rule.category,
    occupation_group: grp.label,
    region: region ? region.replace(/\b\w/g, (c) => c.toUpperCase()) : "Malaysia (national)",
    source: DATA.meta.source,
    data_year: DATA.meta.data_year,
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

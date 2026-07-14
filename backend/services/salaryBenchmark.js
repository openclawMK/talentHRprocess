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
const shortSource = (id) => (id === "DOSM2023" ? "DOSM 2023" : id === "JobStreet2026" ? "JobStreet 2026" : id === "Jobstore2023" ? "Jobstore 2023" : "Market");
// Industry label for a role (explicit tag, or a sector-based fallback for the
// original F&B/professional roles that predate industry tagging).
const industryOf = (rule) => rule.industry || (rule.sector === "frontline" ? "F&B / Retail / Hospitality" : "Professional / Office");

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
    sector: rule.sector || null,
    industry: industryOf(rule),
    basis: rule.basis || "role-level",
    estimated: (rule.basis || "role-level") === "estimate",
    region: region ? region.replace(/\b\w/g, (c) => c.toUpperCase()) : "Malaysia (national)",
    sources,
    source_short: (rule.sources || []).map(shortSource).join(" + "),
    indicative: true,
  };
}

// Experience tier from years: junior (0-2) / mid (3-5) / senior (6+).
export function experienceTier(years) {
  if (years == null) return "mid";
  if (years <= 2) return "junior";
  if (years <= 5) return "mid";
  return "senior";
}

/**
 * Expected pay band for a role at an experience tier, RELATIVE to the role's
 * market benchmark (not fixed RM) — so it works for crew and professionals alike.
 *   junior → market min..median · mid → median..~90% max · senior → ~85% max..max+
 */
export function experienceBand(benchmark, tier) {
  if (!benchmark) return null;
  const { min, median, max } = benchmark;
  if (tier === "junior") return { min, max: median };
  if (tier === "senior") return { min: Math.round(median + (max - median) * 0.6), max };
  return { min: median, max: Math.round(max * 0.95) }; // mid
}

/**
 * Suggest a Success-Profile salary budget from the market, for a target
 * experience tier. Returns { min, max, median, tier, ... } or null.
 */
export function suggestSalary(roleTitle, location, tier = "mid") {
  const b = getSalaryBenchmark(roleTitle, location);
  if (!b) return null;
  const band = experienceBand(b, tier) || { min: b.min, max: b.max };
  return {
    min: band.min, max: band.max, median: b.median,
    min_label: rm(band.min), max_label: rm(band.max),
    tier, category: b.category, region: b.region,
    source_short: b.source_short, estimated: b.estimated,
  };
}

/**
 * Salary-vs-experience fit (0-100): does the candidate's expected pay match what
 * their experience warrants for this role? Within band = well-priced; below =
 * value/cheaper; well above = overpriced for experience. null when unknowable.
 */
export function salaryExperienceFit(expected, years, benchmark) {
  if (!expected || !benchmark) return null;
  const band = experienceBand(benchmark, experienceTier(years));
  if (!band) return null;
  if (expected >= band.min && expected <= band.max) return 100;   // appropriately priced
  if (expected < band.min) return 88;                             // cheaper than expected — fine
  if (expected <= band.max * 1.15) return 65;                     // a bit high for experience
  return 40;                                                       // well over what experience warrants
}

/** Distinct industries covered (for the Salary Center filter). */
export function benchmarkIndustries() {
  return [...new Set(DATA.roles.map(industryOf))].sort();
}

/** Regions offered in the Salary Center dropdown (label + key). */
export function benchmarkRegions() {
  const pretty = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  return [{ key: "", label: "Malaysia (national)" }].concat(
    Object.keys(DATA.regional_multipliers)
      .filter((k) => k !== "default")
      .map((k) => ({ key: k, label: pretty(k) }))
  );
}

/**
 * Full benchmark catalogue for the Salary Center screen, adjusted to an optional
 * location. Returns every role band with its sector, sources and estimate flag.
 */
export function listBenchmarks(location) {
  const floor = DATA.meta.minimum_wage;
  const { mult, region } = location ? regionMultiplier(location) : { mult: 1, region: null };
  const eff = 1 + (mult - 1) * (DATA.meta.regional_damping ?? 0.6);
  const adj = (n) => Math.max(floor, Math.round((n * eff) / 10) * 10);

  const roles = DATA.roles.map((r) => {
    const median = adj(r.median);
    return {
      category: r.category,
      sector: r.sector || "other",
      industry: industryOf(r),
      min: Math.min(median, adj(r.min)),
      median,
      max: Math.max(median, adj(r.max)),
      min_label: rm(Math.min(median, adj(r.min))),
      median_label: rm(median),
      max_label: rm(Math.max(median, adj(r.max))),
      sources: (r.sources || []).map(shortSource),
      basis: r.basis || "role-level",
      estimated: (r.basis || "role-level") === "estimate",
    };
  });
  return {
    meta: {
      sources: DATA.meta.sources,
      minimum_wage: floor,
      currency: DATA.meta.currency,
      note: DATA.meta.note,
    },
    region: region ? region.replace(/\b\w/g, (c) => c.toUpperCase()) : "Malaysia (national)",
    roles,
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

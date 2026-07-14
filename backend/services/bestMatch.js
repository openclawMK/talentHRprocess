/**
 * Role-level best-match comparison — lines up every scored candidate for a role
 * against the Success Profile + budget and produces a deterministic ranking.
 * The AI layer (route-side) adds a narrative suggestion on top of these rows.
 */
import { computeSuccessFit, computeBudgetFit } from "./successFit.js";
import { getSalaryBenchmark, compareToMarket } from "./salaryBenchmark.js";

// Small budget nudge so an affordable candidate edges out an equally good
// expensive one — never enough to outweigh real quality differences.
const BUDGET_NUDGE = { within: 5, below: 2, slightly_above: 0, no_budget: 0, unknown: 0, over: -5 };
// Market-pay nudge (4th lens): a candidate priced above market is a costlier
// hire; below/at market is a value buy. Deliberately gentle.
const MARKET_NUDGE = { within: 2, below: 3, above: -3, unknown: 0 };

export function buildRoleComparison(job, candidates) {
  const market = getSalaryBenchmark(job.role_title, job.location);
  const rows = candidates
    .filter((c) => c.score)
    .map((c) => {
      const fit = computeSuccessFit(c, job);
      const budget = computeBudgetFit(c, job);
      const marketVs = market ? compareToMarket(c.profile?.expected_salary, market) : null;
      const months = c.profile?.total_experience_months;
      return {
        candidate_id: c.candidate_id,
        name: c.profile?.name || "Unnamed",
        score: c.score?.combined_score ?? 0,
        lane: c.score?.lane || null,
        pending: c.score?.pending_sources || [],
        fit: fit?.fit ?? null,
        fit_verdict: fit?.verdict || null,
        dealbreaker: !!fit?.dealbreakers?.some((d) => d.triggered),
        expected_salary: c.profile?.expected_salary ?? null,
        budget_status: budget?.status || "unknown",
        budget_label: budget?.label || null,
        budget_lane: budget?.lane || "neutral",
        market_status: marketVs?.status || "unknown",
        market_label: marketVs?.label || null,
        market_pct: marketVs?.pct_diff ?? null,
        experience_years: months != null ? Math.round((months / 12) * 10) / 10 : null,
        recommendation: c.recommendation?.recommendation || null,
      };
    });

  // Composite: overall score 55%, Success Profile fit 35% (falls back to score
  // when no profile is set), budget nudge ±5. Dealbreakers cap at 25.
  for (const r of rows) {
    const fitPart = r.fit ?? r.score;
    r.composite = Math.round(0.55 * r.score + 0.35 * fitPart + (BUDGET_NUDGE[r.budget_status] ?? 0) + (MARKET_NUDGE[r.market_status] ?? 0));
    if (r.dealbreaker) r.composite = Math.min(r.composite, 25);
  }
  // Tie-break on raw score then fit, so capped (dealbreaker) rows still order sensibly.
  rows.sort((a, b) => b.composite - a.composite || b.score - a.score || (b.fit ?? 0) - (a.fit ?? 0));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

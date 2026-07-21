/**
 * "Ask PeopleQuest" — a grounded hiring assistant. Builds a compact snapshot of
 * the live hiring data (companies, roles, candidates, scores, salary) and asks
 * GPT-4o to answer the HR manager's question or draft a message from it.
 *
 * Read + draft only: it never takes actions (no sending, no score changes).
 */
import { chatText } from "./aiClient.js";
import { computeBudgetFit } from "./successFit.js";
import { getSalaryBenchmark, compareToMarket } from "./salaryBenchmark.js";
import { readTable } from "./store.js";

const years = (m) => (m != null ? Math.round((m / 12) * 10) / 10 : null);

// Compact, token-efficient view of everything the assistant can reason over.
async function buildSnapshot() {
  const jobs = await readTable("jobs");
  const cands = await readTable("candidates");

  const roles = jobs.map((j) => {
    const b = getSalaryBenchmark(j.role_title, j.location);
    const sp = j.successProfile || {};
    return {
      company: j.company?.name || "—",
      role: j.role_title,
      location: j.location,
      budget: sp.salary_budget_min ? `RM${sp.salary_budget_min}-${sp.salary_budget_max}` : "not set",
      market: b ? `${b.range_label} (median ${b.median_label})` : "n/a",
      must_haves: sp.must_haves || [],
      dealbreakers: sp.dealbreakers || [],
      applicants: cands.filter((c) => c.job_id === j.job_id).length,
    };
  });

  const candidates = cands.map((c) => {
    const j = jobs.find((x) => x.job_id === c.job_id);
    const bud = j ? computeBudgetFit(c, j) : null;
    const bm = j ? getSalaryBenchmark(j.role_title, j.location) : null;
    const mkt = bm ? compareToMarket(c.profile?.expected_salary, bm) : null;
    const cs = c.score?.component_scores || {};
    return {
      name: c.profile?.name,
      company: j?.company?.name,
      role: j?.role_title,
      stage: c.interview_completed ? "interview done" : c.ocean_completed ? "screening (awaiting interview)" : "CV only",
      score: c.score?.combined_score,
      screening: c.score?.screening_score != null ? `${c.score.screening_score}/${c.score.pre_interview_max ?? 50}${c.score.screening_pass ? " pass" : " review"}` : null,
      components: { profile_fit: cs.profile_fit, personality: cs.ocean, interview: cs.interview },
      recommendation: c.recommendation?.recommendation,
      next_action: c.recommendation?.next_action,
      experience_years: years(c.profile?.total_experience_months),
      expected_salary: c.profile?.expected_salary ? `RM${c.profile.expected_salary}` : "not stated",
      budget_fit: bud?.label,
      market_fit: mkt ? `${mkt.label} (${mkt.pct_diff >= 0 ? "+" : ""}${mkt.pct_diff}%)` : null,
      dealbreakers: c.score?.dealbreakers_hit || [],
      flagged_checks: Object.entries(c.pre_hire_checks || {}).filter(([, v]) => v.status === "flagged").map(([k]) => k),
      strengths: (c.score?.strengths || []).slice(0, 2),
      risks: (c.score?.weaknesses || []).slice(0, 2),
    };
  });

  return { roles, candidates };
}

const SYSTEM =
  "You are PeopleQuest's hiring assistant for a Malaysian HR manager (F&B, retail, hospitality and professional roles). " +
  "Answer ONLY from the DATA snapshot provided — never invent candidates, roles, scores or salary figures that are not in it. " +
  "Be concise and specific: use candidate names, scores, and RM figures. Reference the scoring model when explaining a score " +
  "(Profile-fit 35% / Personality 15% / Interview 50%; pre-interview is capped at 50, hire bar is 72). " +
  "When asked to draft a WhatsApp or message, write it ready to send in a friendly Malaysian-professional tone. " +
  "You can advise and draft, but you cannot take actions (you never send messages or change data) — if asked, explain the HR manager does that. " +
  "Never consider or mention age, race, religion, gender, nationality or marital status. " +
  "If the answer is not in the data, say so plainly.";

/**
 * @param {{question:string, history?:Array<{role:string,content:string}>, jobId?:string, candidateId?:string}} p
 * @returns {Promise<string>} answer text
 */
export async function askPeopleQuest({ question, history = [], jobId, candidateId }) {
  const snapshot = await buildSnapshot();

  let focus = "";
  if (candidateId) {
    const cands = await readTable("candidates");
    const c = cands.find((x) => x.candidate_id === candidateId);
    if (c) focus = `The HR manager is currently viewing candidate: ${c.profile?.name}.`;
  } else if (jobId) {
    const j = (await readTable("jobs")).find((x) => x.job_id === jobId);
    if (j) focus = `The HR manager is currently viewing the role: ${j.company?.name || ""} · ${j.role_title}.`;
  }

  const priorTurns = history.slice(-4).map((m) => `${m.role === "user" ? "HR" : "Assistant"}: ${m.content}`).join("\n");

  const user =
    `DATA (live hiring snapshot):\n${JSON.stringify(snapshot)}\n\n` +
    (focus ? `CONTEXT: ${focus}\n\n` : "") +
    (priorTurns ? `EARLIER IN THIS CHAT:\n${priorTurns}\n\n` : "") +
    `QUESTION: ${question}`;

  return chatText({ system: SYSTEM, user, temperature: 0.3 });
}

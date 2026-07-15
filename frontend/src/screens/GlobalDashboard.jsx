import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const card = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };

const QUICK = [
  { icon: "↥", title: "Upload & score CV", sub: "Parse a PDF or DOCX CV and auto-score it", ibg: "#EEF2FF", ic: "#4F46E5", to: "/upload" },
  { icon: "＋", title: "Create job role", sub: "Draft scoring criteria automatically with AI", ibg: "#F5F3FF", ic: "#7C3AED", to: "/jobs/new" },
  { icon: "💼", title: "Companies", sub: "Manage the businesses you're hiring for", ibg: "#ECFDF5", ic: "#059669", to: "/companies" },
  { icon: "💰", title: "Salary Center", sub: "Benchmark pay against the Malaysian market", ibg: "#FFF7ED", ic: "#C2410C", to: "/salary-center" },
];

// Dark redesign palette — extracted from the client-supplied mockup.
const D = {
  page: "#0B0B0D",
  cardBg: "#141417",
  border: "rgba(244,245,247,0.08)",
  text: "#F4F5F7",
  textMuted: "#9C9DA6",
  textDim: "#6E6F78",
  green: "#3FB984", greenBg: "rgba(63,185,132,0.14)", greenBorder: "rgba(63,185,132,0.28)",
  amber: "#E0A33A", amberBg: "rgba(224,163,58,0.14)", amberBorder: "rgba(224,163,58,0.28)",
  red: "#E5654C", redBg: "rgba(229,101,76,0.14)", redBorder: "rgba(229,101,76,0.28)",
  gold: "#E8B23A", goldText: "#3A2A06",
  font: "'Hanken Grotesk', sans-serif",
};
const LANE = {
  green: { label: "Strong", c: D.green, bg: D.greenBg, border: D.greenBorder },
  amber: { label: "Review", c: D.amber, bg: D.amberBg, border: D.amberBorder },
  red: { label: "Likely no", c: D.red, bg: D.redBg, border: D.redBorder },
};
const STAGE_LABEL = { cv_submission: "CV review", ocean_assessment: "OCEAN", interview: "Interview", offer: "Offer", rejected: "Rejected" };

const INSIGHT_PROMPTS = [
  "In one short, specific sentence, what's the single most useful thing I should look at in my hiring pipeline right now?",
  "In one short sentence, which candidate or role most needs my attention today and why?",
  "In one short sentence, is there a bottleneck in my pipeline I should know about?",
];

export default function GlobalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [a, setA] = useState(null);
  const [recent, setRecent] = useState(null);
  const [promoDismissed, setPromoDismissed] = useState(() => localStorage.getItem("pq_hide_promo") === "1");
  const [insightIdx, setInsightIdx] = useState(0);
  const [insight, setInsight] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);

  useEffect(() => {
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(false));
    axios.get("/api/candidates-recent?limit=8").then((r) => setRecent(r.data?.results || [])).catch(() => setRecent([]));
  }, []);

  const fetchInsight = useCallback((idx) => {
    setInsightBusy(true);
    axios.post("/api/assistant/ask", { question: INSIGHT_PROMPTS[idx], history: [] })
      .then((r) => setInsight(r.data.answer || "No insight available right now."))
      .catch(() => setInsight("Couldn't reach the assistant just now."))
      .finally(() => setInsightBusy(false));
  }, []);
  useEffect(() => { fetchInsight(insightIdx); }, [insightIdx, fetchInsight]);

  const firstName = (user?.name || "there").split(" ")[0];
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  if (a === null) return <div style={{ ...card, height: 320 }} className="animate-pulse" />;

  const lanes = a?.lane_breakdown || { green: { count: 0, pct: 0 }, amber: { count: 0, pct: 0 }, red: { count: 0, pct: 0 } };
  const trend = a?.score_trend || [];
  const trendMax = Math.max(1, ...trend.map((t) => t.avg));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 24 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 5px" }}>{greeting}, {firstName} 👋</h1>
          <p style={{ fontSize: 15, color: "#6B7280", margin: 0 }}>Here's what's happening across your {a?.open_roles ?? 0} open role{a?.open_roles === 1 ? "" : "s"} today.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/upload")} style={{ padding: "11px 16px", background: "#fff", color: "#374151", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>↥ Upload CV</button>
          <button onClick={() => navigate("/jobs/new")} style={{ padding: "11px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>＋ Create job</button>
        </div>
      </div>

      {/* Quick tools */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#9AA0AE", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 12 }}>Quick tools</div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 22 }}>
        {QUICK.map((q) => (
          <div key={q.title} onClick={() => navigate(q.to)} style={{ ...card, borderColor: "#ECEDF2", borderRadius: 14, padding: 18, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
            <div style={{ width: 40, height: 40, borderRadius: 11, background: q.ibg, color: q.ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 12 }}>{q.icon}</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>{q.title}</div>
            <div style={{ fontSize: 12.5, color: "#9AA0AE", lineHeight: 1.45 }}>{q.sub}</div>
          </div>
        ))}
      </div>

      {/* Stale alert */}
      {a?.stale_top && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14, marginBottom: 22 }} className="flex-wrap">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>⚠️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <span style={{ fontWeight: 700, color: "#92400E" }}>{a.stale_top.name}</span>
            <span style={{ color: "#B45309" }}> has been waiting in {a.stale_top.current_stage.replace("_", " ")} for {a.stale_top.days_waiting} days.</span>
            {a.stale_count > 1 && <span style={{ color: "#B45309" }}> {a.stale_count} candidates across your roles are going stale.</span>}
          </div>
          <button onClick={() => navigate("/jobs")} style={{ padding: "8px 14px", background: "#D97706", color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Review now</button>
        </div>
      )}

      {/* ---- New redesign panel: My Pipelines ---- */}
      <div style={{ background: D.page, borderRadius: 22, padding: 24, marginBottom: 28, fontFamily: D.font, color: D.text }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }} className="flex-wrap">
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.3px" }}>My Pipelines</div>
            <div style={{ fontSize: 13, color: D.textMuted, marginTop: 3 }}>{a?.open_roles ?? 0} roles · {a?.total_applicants ?? 0} candidates in flight</div>
          </div>
          <span onClick={() => navigate("/jobs")} style={{ fontSize: 13, fontWeight: 600, color: D.text, cursor: "pointer" }}>All roles →</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]" style={{ marginBottom: 20 }}>
          {/* Score trend */}
          <div style={{ background: "transparent", border: `0.5px solid ${D.border}`, borderRadius: 20, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }} className="flex-wrap">
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>Score trend</div>
                <div style={{ fontSize: 12, color: D.textMuted, marginTop: 3 }}>Avg score this month</div>
              </div>
              {a.score_trend_delta_pct != null && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: a.score_trend_delta_pct >= 0 ? D.green : D.red, background: a.score_trend_delta_pct >= 0 ? D.greenBg : D.redBg, border: `1px solid ${a.score_trend_delta_pct >= 0 ? D.greenBorder : D.redBorder}`, padding: "4px 10px", borderRadius: 999 }}>
                  {a.score_trend_delta_pct >= 0 ? "+" : ""}{a.score_trend_delta_pct}%
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "14px 0 18px" }}>
              <span style={{ fontSize: 11.5, color: D.textMuted, fontWeight: 600 }}>Comparative rate</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px" }}>{a?.avg_score ?? 0} / 100</span>
            </div>

            {trend.length === 0 ? (
              <div style={{ fontSize: 12.5, color: D.textDim, padding: "20px 0" }}>Not enough scored, dated applications yet to chart a trend.</div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 90 }}>
                {trend.map((t) => (
                  <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ width: "100%", maxWidth: 30, height: Math.max(4, (t.avg / trendMax) * 66), borderRadius: 6, background: D.text, opacity: 0.9 }} />
                    <span style={{ fontSize: 11, color: D.textMuted, fontWeight: 600 }}>{t.month}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 11, color: D.textDim, marginTop: 14 }}>Last updated {new Date(a.generated_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
          </div>

          {/* Top roles */}
          <div style={{ background: "transparent", border: `0.5px solid ${D.border}`, borderRadius: 20, padding: 20 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 14 }}>Top roles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(a.roles || []).slice(0, 3).map((r) => (
                <div key={r.job_id} onClick={() => navigate(`/jobs/${r.job_id}/dashboard`)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, color: D.textMuted }}>{r.applicants} applicants · avg {r.avg}{r.stale > 0 ? ` · ${r.stale} stale` : ""}</div>
                  </div>
                  <div style={{ display: "flex" }}>
                    {r.avatars.map((av, i) => (
                      <span key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: "#26272E", border: `2px solid ${D.page}`, marginLeft: i === 0 ? 0 : -8, fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{av}</span>
                    ))}
                    {r.more > 0 && <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#26272E", border: `2px solid ${D.page}`, marginLeft: -8, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+{r.more}</span>}
                  </div>
                </div>
              ))}
              {(a.roles || []).length === 0 && <div style={{ fontSize: 12.5, color: D.textDim }}>No roles yet.</div>}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3" style={{ marginBottom: 20 }}>
          <DarkStat label="Total applicants" value={a?.total_applicants ?? 0} sub="Across every open pipeline" deltaPct={a.applicant_trend_delta_pct} />
          <DarkStat label="Average score" value={`${a?.avg_score ?? 0}/100`} sub="Across all open roles" />
          <div style={{ border: `0.5px solid ${D.border}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: D.gold, color: D.goldText, fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "2px 7px" }}>AI</span>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>Assistant</span>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: D.textDim, fontWeight: 600 }}>Co-pilot</span>
            </div>
            <div style={{ fontSize: 12.5, color: D.textMuted, lineHeight: 1.55, minHeight: 44 }}>{insightBusy ? "Thinking…" : insight}</div>
            <span onClick={() => setInsightIdx((i) => (i + 1) % INSIGHT_PROMPTS.length)} style={{ fontSize: 12, fontWeight: 700, color: D.text, cursor: "pointer" }}>Next →</span>
          </div>
        </div>

        {/* Promo banner */}
        {!promoDismissed && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, border: `0.5px solid ${D.border}`, borderRadius: 18, padding: "16px 20px", marginBottom: 20 }} className="flex-wrap">
            <span style={{ fontSize: 20 }}>✦</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Score 200 CVs while you make coffee</div>
              <div style={{ fontSize: 12, color: D.textMuted, marginTop: 3 }}>Transparent 3-layer scoring — profile fit, OCEAN, and interview — with no black box. Decide Hire / Hold / Reject with evidence.</div>
            </div>
            <span onClick={() => navigate("/upload")} style={{ fontSize: 12.5, fontWeight: 700, color: D.text, cursor: "pointer", whiteSpace: "nowrap" }}>Learn more →</span>
            <span onClick={() => { localStorage.setItem("pq_hide_promo", "1"); setPromoDismissed(true); }} style={{ fontSize: 11.5, color: D.textDim, cursor: "pointer", whiteSpace: "nowrap" }}>Don't show again</span>
          </div>
        )}

        {/* Candidates table */}
        <div style={{ border: `0.5px solid ${D.border}`, borderRadius: 20, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Candidates</div>
            <div style={{ fontSize: 11.5, color: D.textDim }}>Sorted by score</div>
          </div>
          {recent === null ? (
            <div style={{ fontSize: 12.5, color: D.textDim, padding: "14px 0" }}>Loading…</div>
          ) : recent.length === 0 ? (
            <div style={{ fontSize: 12.5, color: D.textDim, padding: "14px 0" }}>No candidates yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="hidden md:grid" style={{ gridTemplateColumns: "1.6fr 70px 110px 1fr 100px 90px", gap: 12, padding: "0 4px 10px", fontSize: 10.5, fontWeight: 700, color: D.textDim, textTransform: "uppercase", letterSpacing: ".4px" }}>
                <div>Candidate</div><div>Score</div><div>Stage</div><div>Role</div><div>Lane</div><div></div>
              </div>
              {recent.map((c) => {
                const lane = LANE[c.lane] || null;
                return (
                  <div key={c.candidate_id} className="grid items-center md:!grid-cols-[1.6fr_70px_110px_1fr_100px_90px]" style={{ gridTemplateColumns: "1fr auto", gap: 12, padding: "12px 4px", borderTop: `0.5px solid ${D.border}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: D.textMuted }}>{c.experience_years != null ? `${c.experience_years} yrs` : "—"}{c.location ? ` · ${c.location}` : ""}</div>
                    </div>
                    <div className="hidden md:block" style={{ fontSize: 14, fontWeight: 800 }}>{c.score ?? "—"}</div>
                    <div className="hidden md:block" style={{ fontSize: 12.5, color: D.textMuted }}>{STAGE_LABEL[c.stage] || c.stage}</div>
                    <div className="hidden md:block" style={{ fontSize: 12.5, color: D.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.role_title}</div>
                    <div className="hidden md:block">
                      {lane && <span style={{ fontSize: 10.5, fontWeight: 700, color: lane.c, background: lane.bg, border: `1px solid ${lane.border}`, padding: "3px 9px", borderRadius: 999 }}>{lane.label}</span>}
                    </div>
                    <button onClick={() => navigate(`/jobs/${c.job_id}/candidate/${c.candidate_id}`)} style={{ fontSize: 11.5, fontWeight: 700, background: D.text, color: D.page, border: "none", borderRadius: 999, padding: "7px 13px", cursor: "pointer", justifySelf: "start" }}>Review</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Funnel + Lane breakdown */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]" style={{ marginBottom: 26 }}>
        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Pipeline funnel</div>
          <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 20 }}>Candidates by current stage</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { key: "cv_submission", label: "CV review" },
              { key: "ocean_assessment", label: "OCEAN" },
              { key: "interview", label: "Interview" },
              { key: "offer", label: "Offer" },
            ].map((f) => {
              const n = a?.by_stage?.[f.key] ?? 0;
              const funMax = Math.max(1, a?.by_stage?.cv_submission ?? 0, a?.by_stage?.ocean_assessment ?? 0, a?.by_stage?.interview ?? 0, a?.by_stage?.offer ?? 0);
              return (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 78, fontSize: 13, fontWeight: 600, color: "#4B5563" }}>{f.label}</div>
                  <div style={{ flex: 1, height: 26, background: "#F3F4F8", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(n / funMax) * 100}%`, background: "linear-gradient(90deg,#818CF8,#7C3AED)", borderRadius: 8 }} />
                  </div>
                  <div style={{ width: 30, textAlign: "right", fontSize: 14, fontWeight: 700 }}>{n}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Lane breakdown</div>
          <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 20 }}>AI fit across all candidates</div>
          <div style={{ display: "flex", height: 14, borderRadius: 8, overflow: "hidden", marginBottom: 22, background: "#F3F4F8" }}>
            <div style={{ width: `${lanes.green.pct}%`, background: "#059669" }} />
            <div style={{ width: `${lanes.amber.pct}%`, background: "#D97706" }} />
            <div style={{ width: `${lanes.red.pct}%`, background: "#DC2626" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { c: "#059669", label: "Green · strong fit", d: lanes.green },
              { c: "#D97706", label: "Amber · review", d: lanes.amber },
              { c: "#DC2626", label: "Red · likely no", d: lanes.red },
            ].map((l) => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.c }} />
                <span style={{ fontSize: 14, color: "#374151", flex: 1 }}>{l.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{l.d.count}</span>
                <span style={{ fontSize: 13, color: "#9AA0AE", width: 38, textAlign: "right" }}>{l.d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active job roles */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Active job roles</h2>
        <span onClick={() => navigate("/jobs")} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer" }}>View all →</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(a?.roles || []).map((j) => {
          const tot = Math.max(1, j.g + j.a + j.r);
          return (
            <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ ...card, padding: 22, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 6 }}>{j.title}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>{j.dept}</span>
                    <span style={{ fontSize: 13, color: "#9AA0AE" }}>{j.location}</span>
                  </div>
                </div>
                {j.stale > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>⚠ {j.stale} stale</span>}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                <div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>{j.applicants}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 3 }}>applicants</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#4F46E5", lineHeight: 1 }}>{j.avg}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 3 }}>avg score</div></div>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "#F3F4F8" }}>
                <div style={{ width: `${(j.g / tot) * 100}%`, background: "#059669" }} />
                <div style={{ width: `${(j.a / tot) * 100}%`, background: "#D97706" }} />
                <div style={{ width: `${(j.r / tot) * 100}%`, background: "#DC2626" }} />
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#6B7280" }}>
                <span>🟢 {j.g} green</span><span>🟡 {j.a} amber</span><span>🔴 {j.r} red</span>
              </div>
            </div>
          );
        })}
        {(a?.roles || []).length === 0 && <div style={{ ...card, padding: 24 }} className="col-span-full text-center text-sm text-gray-400">No roles yet.</div>}
      </div>
    </div>
  );
}

function DarkStat({ label, value, sub, deltaPct }) {
  return (
    <div style={{ border: "0.5px solid rgba(244,245,247,0.08)", borderRadius: 20, padding: 18 }}>
      <div style={{ fontSize: 12, color: "#9C9DA6", fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px" }}>{value}</span>
        {deltaPct != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: deltaPct >= 0 ? "#3FB984" : "#E5654C" }}>{deltaPct >= 0 ? "+" : ""}{deltaPct}%</span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "#6E6F78", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

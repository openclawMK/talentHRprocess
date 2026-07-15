import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";
import { usePalette } from "../context/ThemeContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";

const QUICK = [
  { icon: "↥", title: "Upload & score CV", sub: "Parse a PDF or DOCX CV and auto-score it", ibg: "#EEF2FF", ic: "#4F46E5", to: "/upload" },
  { icon: "＋", title: "Create job role", sub: "Draft scoring criteria automatically with AI", ibg: "#F5F3FF", ic: "#7C3AED", to: "/jobs/new" },
  { icon: "💼", title: "Companies", sub: "Manage the businesses you're hiring for", ibg: "#ECFDF5", ic: "#059669", to: "/companies" },
  { icon: "💰", title: "Salary Center", sub: "Benchmark pay against the Malaysian market", ibg: "#FFF7ED", ic: "#C2410C", to: "/salary-center" },
];

const STAGE_LABEL = { cv_submission: "CV review", ocean_assessment: "OCEAN", interview: "Interview", offer: "Offer", rejected: "Rejected" };

const INSIGHT_PROMPTS = [
  "In one short, specific sentence, what's the single most useful thing I should look at in my hiring pipeline right now?",
  "In one short sentence, which candidate or role most needs my attention today and why?",
  "In one short sentence, is there a bottleneck in my pipeline I should know about?",
];

export default function GlobalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const D = usePalette();
  const card = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16 };
  const LANE = {
    green: { label: "Strong", c: D.green, bg: D.greenBg, border: D.greenBorder },
    amber: { label: "Review", c: D.amber, bg: D.amberBg, border: D.amberBorder },
    red: { label: "Likely no", c: D.red, bg: D.redBg, border: D.redBorder },
  };
  const avatarBg = (i) => [D.avatarBlue, D.avatarPurple][i % 2];
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
          <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 5px", color: D.text }}>{greeting}, {firstName} 👋</h1>
          <p style={{ fontSize: 15, color: D.text3, margin: 0 }}>Here's what's happening across your {a?.open_roles ?? 0} open role{a?.open_roles === 1 ? "" : "s"} today.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/upload")} style={{ padding: "11px 16px", background: D.cardBg, color: D.text2, border: `0.5px solid ${D.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>↥ Upload CV</button>
          <button onClick={() => navigate("/jobs/new")} style={{ padding: "11px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>＋ Create job</button>
        </div>
      </div>

      {/* Quick tools */}
      <div style={{ fontSize: 13, fontWeight: 700, color: D.text4, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 12 }}>Quick tools</div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 22 }}>
        {QUICK.map((q) => (
          <div key={q.title} onClick={() => navigate(q.to)} style={{ ...card, borderRadius: 14, padding: 18, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
            <div style={{ width: 40, height: 40, borderRadius: 11, background: q.ibg, color: q.ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 12 }}>{q.icon}</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3, color: D.text }}>{q.title}</div>
            <div style={{ fontSize: 12.5, color: D.text4, lineHeight: 1.45 }}>{q.sub}</div>
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

      {/* ---- New redesign panel: My Pipelines (matches the client mockup 1:1) ---- */}
      <div style={{ background: D.page, borderRadius: 22, padding: 24, marginBottom: 28, fontFamily: D.font, color: D.text }}>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1.15fr 1.32fr 0.93fr", marginBottom: 16 }}>

          {/* ===== Column 1: My Pipelines + Score trend + Top roles ===== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>My Pipelines</div>
                <div style={{ fontSize: 12.5, color: D.text4, marginTop: 3 }}>{a?.open_roles ?? 0} roles · {a?.total_applicants ?? 0} candidates in flight</div>
              </div>
              <span onClick={() => navigate("/jobs")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: D.text2, background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 10, padding: "8px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>All roles ›</span>
            </div>

            <div style={{ border: `0.5px solid ${D.border}`, borderRadius: 20, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Score trend</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: D.text3, marginTop: 12 }}>
                <span>Avg score this month</span>
                {a.score_trend_delta_pct != null && <span style={{ fontWeight: 600, color: a.score_trend_delta_pct >= 0 ? D.green : D.red }}>{a.score_trend_delta_pct >= 0 ? "+" : ""}{a.score_trend_delta_pct}%</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: D.text3, marginTop: 8 }}>
                <span>Comparative rate</span>
                <span style={{ color: D.text2 }}>{a?.avg_score ?? 0} / 100</span>
              </div>

              <div style={{ display: "flex", background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: 4, marginTop: 16 }}>
                {["Week", "Month", "Quarter"].map((p) => (
                  <div key={p} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: p === "Month" ? 600 : 400, color: p === "Month" ? D.text : D.text4, background: p === "Month" ? D.pillBg : "transparent", borderRadius: 9, padding: 7 }}>{p}</div>
                ))}
              </div>

              {trend.length === 0 ? (
                <div style={{ fontSize: 12, color: D.text4, padding: "24px 0" }}>Not enough scored, dated applications yet to chart a trend.</div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 90, marginTop: 20 }}>
                  {trend.map((t) => (
                    <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <div style={{ width: "100%", maxWidth: 26, height: Math.max(4, (t.avg / trendMax) * 66), borderRadius: 6, background: D.blue, opacity: 0.85 }} />
                      <span style={{ fontSize: 10.5, color: D.text5, fontWeight: 400 }}>{t.month}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `0.5px solid ${D.border}`, marginTop: 16, paddingTop: 16 }}>
                {a.score_trend_delta_pct != null ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: D.blue }}>{a.score_trend_delta_pct >= 0 ? "+" : ""}{Math.round(a.score_trend_delta_pct)}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: D.text3 }}>% avg</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: D.blue }}>{trend[trend.length - 1]?.avg ?? a.avg_score ?? 0}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: D.text3 }}>avg score</span>
                  </div>
                )}
                <span style={{ fontSize: 11, color: D.text4 }}>Last updated {new Date(a.generated_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Top roles</span>
              <span style={{ fontSize: 11.5, color: D.text4 }}>{Math.min(2, (a.roles || []).length)} of {a.roles?.length ?? 0}</span>
            </div>
            <div className="grid grid-cols-2 gap-3" style={{ marginTop: -8 }}>
              {(a.roles || []).slice(0, 2).map((r) => {
                const laneKey = r.g >= r.a && r.g >= r.r ? "green" : r.a >= r.r ? "amber" : "red";
                const dot = LANE[laneKey].c;
                return (
                  <div key={r.job_id} onClick={() => navigate(`/jobs/${r.job_id}/dashboard`)} style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16, padding: 14, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />
                      {r.title}
                    </div>
                    <div style={{ fontSize: 12, color: D.text3, marginTop: 8 }}>{r.applicants} applicant{r.applicants === 1 ? "" : "s"}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: r.stale > 0 ? D.amber : D.green, marginTop: 2 }}>avg {r.avg}{r.stale > 0 ? " · stale" : ""}</div>
                    <div style={{ display: "flex", marginTop: 12 }}>
                      {r.avatars.slice(0, 2).map((av, i) => (
                        <span key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: avatarBg(i), border: `2px solid ${D.cardBg}`, marginLeft: i === 0 ? 0 : -8, fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{av}</span>
                      ))}
                      {(r.avatars.length - 2 + r.more) > 0 && <span style={{ width: 26, height: 26, borderRadius: "50%", background: D.avatarGrey, border: `2px solid ${D.cardBg}`, marginLeft: -8, fontSize: 9, fontWeight: 600, color: D.text2, display: "flex", alignItems: "center", justifyContent: "center" }}>+{r.avatars.length - 2 + r.more}</span>}
                    </div>
                  </div>
                );
              })}
              {(a.roles || []).length === 0 && <div style={{ fontSize: 12.5, color: D.text4, gridColumn: "1 / -1" }}>No roles yet.</div>}
            </div>
          </div>

          {/* ===== Column 2: Total Applicants + Average score + AI Assistant teaser ===== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>Total Applicants</div>
                <div style={{ fontSize: 12.5, color: D.text4, marginTop: 3 }}>Across every open pipeline</div>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: D.text2, background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 10, padding: "8px 11px", whiteSpace: "nowrap" }}>This quarter ›</span>
            </div>

            <div style={{ border: `0.5px solid ${D.border}`, borderRadius: 20, padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: D.blue }}>#</span>
                  <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-1px" }}>{a?.total_applicants ?? 0}</span>
                </div>
                {a.applicant_trend_delta_pct != null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: D.text3 }}>Compared to last month</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: a.applicant_trend_delta_pct >= 0 ? D.green : D.red }}>{a.applicant_trend_delta_pct >= 0 ? "+" : ""}{a.applicant_trend_delta_pct}%</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: D.text3 }}>
                <span>Average score</span>
                <b style={{ color: D.text2 }}>{a?.avg_score ?? 0}/100</b>
                <span style={{ color: D.green }}>▴</span>
                <span style={{ marginLeft: "auto", color: D.text4 }}>How scoring works?</span>
              </div>

              {/* AI Assistant teaser */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 220, borderRadius: 16, border: `0.5px solid ${D.border}`, padding: 16, background: D.copilotGrad }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>AI Assistant</div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(10,12,18,0.6)", borderRadius: 14, padding: "10px 14px", fontSize: 12, color: D.text2, lineHeight: 1.5, marginTop: 16 }}>
                  <span style={{ width: 11, height: 11, marginTop: 2, borderRadius: "50%", border: `2px solid ${D.blue}`, borderTopColor: "transparent", flexShrink: 0 }} />
                  <span style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{insightBusy ? "Thinking…" : insight}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== Column 3: Co-pilot / promo ===== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: D.text3 }}>Co-pilot</span>
              <span onClick={() => setInsightIdx((i) => (i + 1) % INSIGHT_PROMPTS.length)} style={{ fontSize: 12, color: D.text3, cursor: "pointer" }}>Next →</span>
            </div>
            <div style={{ border: `0.5px solid ${D.border}`, borderRadius: 20, padding: 20, display: "flex", flexDirection: "column" }}>
              <span style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, color: D.text2, background: D.pillBg, border: `0.5px solid ${D.pillBorder}`, borderRadius: 12, padding: 11 }}>✦ Just for today!</span>

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Score 200 CVs while you make coffee</div>
                <span style={{ background: D.gold, color: D.goldText, fontWeight: 800, fontSize: 12, borderRadius: 7, padding: "2px 8px", flexShrink: 0 }}>AI</span>
              </div>

              <div style={{ fontSize: 12.5, color: D.text3, lineHeight: 1.55, marginTop: 14 }}>Transparent 3-layer scoring — profile fit, OCEAN, and interview — with no black box. Decide Hire / Hold / Reject with evidence.</div>

              <span onClick={() => navigate("/upload")} style={{ fontSize: 13, fontWeight: 600, color: D.text, cursor: "pointer", marginTop: 18 }}>Learn more →</span>

              {!promoDismissed ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `0.5px solid ${D.border}`, marginTop: 20, paddingTop: 16 }}>
                  <span onClick={() => { localStorage.setItem("pq_hide_promo", "1"); setPromoDismissed(true); }} style={{ fontSize: 11.5, color: D.text4, cursor: "pointer" }}>Don't show again</span>
                  <button onClick={() => navigate("/jobs")} style={{ fontSize: 12.5, fontWeight: 700, background: D.text, color: D.page, border: "none", borderRadius: 999, padding: "9px 16px", cursor: "pointer" }}>Send OCEAN link</button>
                </div>
              ) : (
                <div style={{ borderTop: `0.5px solid ${D.border}`, marginTop: 20, paddingTop: 16 }}>
                  <button onClick={() => navigate("/jobs")} style={{ fontSize: 12.5, fontWeight: 700, background: D.text, color: D.page, border: "none", borderRadius: 999, padding: "9px 16px", cursor: "pointer" }}>Send OCEAN link</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Candidates table */}
        <div style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 20, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Candidates</div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 12, color: D.text2, background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 10, padding: "7px 11px" }}>⇄ Compare</span>
              <span style={{ fontSize: 12, color: D.text2, background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 10, padding: "7px 11px" }}>Sorted by score ›</span>
            </div>
          </div>
          {recent === null ? (
            <div style={{ fontSize: 12.5, color: D.text4, padding: "14px 0" }}>Loading…</div>
          ) : recent.length === 0 ? (
            <div style={{ fontSize: 12.5, color: D.text4, padding: "14px 0" }}>No candidates yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="hidden md:grid" style={{ gridTemplateColumns: "1.6fr 70px 110px 1fr 100px 90px", gap: 12, padding: "0 4px 10px", fontSize: 10.5, fontWeight: 600, color: D.text5 }}>
                <div>Candidate</div><div>Score</div><div>Stage</div><div>Role</div><div>Lane</div><div>Action</div>
              </div>
              {recent.map((c, i) => {
                const lane = LANE[c.lane] || null;
                const scoreColor = i === 0 ? D.blue : (lane ? lane.c : D.text2);
                return (
                  <div key={c.candidate_id} className="grid items-center md:!grid-cols-[1.6fr_70px_110px_1fr_100px_90px]" style={{ gridTemplateColumns: "1fr auto", gap: 12, padding: "12px 4px", borderTop: `0.5px solid ${D.hair}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ width: 30, height: 30, borderRadius: "50%", background: avatarBg(i), color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: D.text4 }}>{c.experience_years != null ? `${c.experience_years} yrs` : "—"}{c.location ? ` · ${c.location}` : ""}</div>
                      </div>
                    </div>
                    <div className="hidden md:block" style={{ fontSize: 14, fontWeight: 700, color: scoreColor }}>{c.score ?? "—"}</div>
                    <div className="hidden md:block" style={{ fontSize: 12.5, color: D.text2 }}>{STAGE_LABEL[c.stage] || c.stage}</div>
                    <div className="hidden md:block" style={{ fontSize: 12.5, color: D.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.role_title}</div>
                    <div className="hidden md:block">
                      {lane && <span style={{ fontSize: 11, fontWeight: 600, color: lane.c, background: lane.bg, border: `0.5px solid ${lane.border}`, padding: "4px 10px", borderRadius: 999 }}>{lane.label}</span>}
                    </div>
                    <button onClick={() => navigate(`/jobs/${c.job_id}/candidate/${c.candidate_id}`)} style={{ fontSize: 12, fontWeight: 700, background: D.text, color: D.page, border: "none", borderRadius: 999, padding: "7px 15px", cursor: "pointer", justifySelf: "start" }}>Review</button>
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
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: D.text }}>Pipeline funnel</div>
          <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>Candidates by current stage</div>
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
                  <div style={{ width: 78, fontSize: 13, fontWeight: 600, color: D.text3 }}>{f.label}</div>
                  <div style={{ flex: 1, height: 26, background: D.inset, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(n / funMax) * 100}%`, background: "linear-gradient(90deg,#818CF8,#7C3AED)", borderRadius: 8 }} />
                  </div>
                  <div style={{ width: 30, textAlign: "right", fontSize: 14, fontWeight: 700, color: D.text }}>{n}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: D.text }}>Lane breakdown</div>
          <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>AI fit across all candidates</div>
          <div style={{ display: "flex", height: 14, borderRadius: 8, overflow: "hidden", marginBottom: 22, background: D.inset }}>
            <div style={{ width: `${lanes.green.pct}%`, background: D.green }} />
            <div style={{ width: `${lanes.amber.pct}%`, background: D.amber }} />
            <div style={{ width: `${lanes.red.pct}%`, background: D.red }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { c: D.green, label: "Green · strong fit", d: lanes.green },
              { c: D.amber, label: "Amber · review", d: lanes.amber },
              { c: D.red, label: "Red · likely no", d: lanes.red },
            ].map((l) => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.c }} />
                <span style={{ fontSize: 14, color: D.text2, flex: 1 }}>{l.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{l.d.count}</span>
                <span style={{ fontSize: 13, color: D.text4, width: 38, textAlign: "right" }}>{l.d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active job roles */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, margin: 0, color: D.text }}>Active job roles</h2>
        <span onClick={() => navigate("/jobs")} style={{ fontSize: 14, color: D.blue, fontWeight: 600, cursor: "pointer" }}>View all →</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(a?.roles || []).map((j) => {
          const tot = Math.max(1, j.g + j.a + j.r);
          return (
            <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ ...card, padding: 22, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 6, color: D.text }}>{j.title}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>{j.dept}</span>
                    <span style={{ fontSize: 13, color: D.text4 }}>{j.location}</span>
                  </div>
                </div>
                {j.stale > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>⚠ {j.stale} stale</span>}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                <div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: D.text }}>{j.applicants}</div><div style={{ fontSize: 12, color: D.text4, marginTop: 3 }}>applicants</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 700, color: D.blue, lineHeight: 1 }}>{j.avg}</div><div style={{ fontSize: 12, color: D.text4, marginTop: 3 }}>avg score</div></div>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: D.inset }}>
                <div style={{ width: `${(j.g / tot) * 100}%`, background: D.green }} />
                <div style={{ width: `${(j.a / tot) * 100}%`, background: D.amber }} />
                <div style={{ width: `${(j.r / tot) * 100}%`, background: D.red }} />
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: D.text3 }}>
                <span>🟢 {j.g} green</span><span>🟡 {j.a} amber</span><span>🔴 {j.r} red</span>
              </div>
            </div>
          );
        })}
        {(a?.roles || []).length === 0 && <div style={{ ...card, padding: 24, textAlign: "center", fontSize: 14, color: D.text4 }} className="col-span-full">No roles yet.</div>}
      </div>
    </div>
  );
}

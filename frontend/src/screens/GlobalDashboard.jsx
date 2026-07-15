import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { usePalette } from "../context/ThemeContext.jsx";

const STAGES = [
  { key: "cv_submission", label: "CV review" },
  { key: "ocean_assessment", label: "OCEAN" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
];

const INSIGHT_PROMPT = "In one short, specific sentence, what's the single most useful thing I should look at in my hiring pipeline right now?";

function domLane(r) {
  return r.g >= r.a && r.g >= r.r ? "green" : r.a >= r.r ? "amber" : "red";
}

export default function GlobalDashboard() {
  const navigate = useNavigate();
  const D = usePalette();
  const card = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16 };
  const LANE = {
    green: { label: "Strong", c: D.green, bg: D.greenBg, border: D.greenBorder },
    amber: { label: "Review", c: D.amber, bg: D.amberBg, border: D.amberBorder },
    red: { label: "Likely no", c: D.red, bg: D.redBg, border: D.redBorder },
  };
  const avatarBg = (i) => [D.avatarBlue, D.avatarPurple][i % 2];
  const [a, setA] = useState(null);
  const [insight, setInsight] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);

  useEffect(() => {
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(false));
  }, []);

  const fetchInsight = useCallback(() => {
    setInsightBusy(true);
    axios.post("/api/assistant/ask", { question: INSIGHT_PROMPT, history: [] })
      .then((r) => setInsight(r.data.answer || "No insight available right now."))
      .catch(() => setInsight("Couldn't reach the assistant just now."))
      .finally(() => setInsightBusy(false));
  }, []);
  useEffect(() => { fetchInsight(); }, [fetchInsight]);

  if (a === null) return <div style={{ ...card, height: 320 }} className="animate-pulse" />;

  const lanes = a?.lane_breakdown || { green: { count: 0, pct: 0 }, amber: { count: 0, pct: 0 }, red: { count: 0, pct: 0 } };
  const trend = a?.score_trend || [];
  const trendMax = Math.max(1, ...trend.map((t) => t.avg));
  const stageMax = Math.max(1, ...STAGES.map((f) => a?.by_stage?.[f.key] ?? 0));

  return (
    <div>
      {/* ---- My Pipelines (matches the client mockup 1:1) ---- */}
      <div style={{ background: D.page, borderRadius: 22, padding: 24, marginBottom: 28, fontFamily: D.font, color: D.text }}>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1.15fr 1.32fr 0.93fr", marginBottom: 16 }}>

          {/* ===== Column 1: My Pipelines + stage breakdown + Score trend + Top roles ===== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>My Pipelines</div>
                <div style={{ fontSize: 12.5, color: D.text4, marginTop: 3 }}>{a?.open_roles ?? 0} roles · {a?.total_applicants ?? 0} candidates in flight</div>
              </div>
              <span onClick={() => navigate("/jobs")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: D.text2, background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 10, padding: "8px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>All roles ›</span>
            </div>

            {/* Pipeline funnel, integrated as compact per-stage tiles */}
            <div className="grid grid-cols-4 gap-2">
              {STAGES.map((f) => {
                const n = a?.by_stage?.[f.key] ?? 0;
                return (
                  <div key={f.key} style={{ background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "10px 8px" }}>
                    <div style={{ fontSize: 10.5, color: D.text4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: D.text, marginTop: 3 }}>{n}</div>
                    <div style={{ height: 4, borderRadius: 3, background: D.border, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(n / stageMax) * 100}%`, background: "linear-gradient(90deg,#818CF8,#7C3AED)", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
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
                const dot = LANE[domLane(r)].c;
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
                  <span style={{ width: 11, height: 11, marginTop: 2, borderRadius: "50%", borderStyle: "solid", borderWidth: 2, borderColor: D.blue, borderTopColor: "transparent", flexShrink: 0 }} />
                  <span style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{insightBusy ? "Thinking…" : insight}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== Column 3: Lane breakdown (replaces Co-pilot) ===== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Lane breakdown</div>
              <div style={{ fontSize: 12.5, color: D.text4, marginTop: 3 }}>AI fit across all candidates</div>
            </div>
            <div style={{ border: `0.5px solid ${D.border}`, borderRadius: 20, padding: 20, display: "flex", flexDirection: "column" }}>
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
                    <span style={{ fontSize: 13.5, color: D.text2, flex: 1 }}>{l.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{l.d.count}</span>
                    <span style={{ fontSize: 13, color: D.text4, width: 38, textAlign: "right" }}>{l.d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Active job roles table (replaces the Candidates table) */}
        <div style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 20, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Active job roles</div>
            <span onClick={() => navigate("/jobs")} style={{ fontSize: 12, color: D.text2, background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 10, padding: "7px 11px", cursor: "pointer" }}>View all ›</span>
          </div>
          {(a?.roles || []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: D.text4, padding: "14px 0" }}>No roles yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="hidden md:grid" style={{ gridTemplateColumns: "1.6fr 90px 100px 1fr 100px 110px", gap: 12, padding: "0 4px 10px", fontSize: 10.5, fontWeight: 600, color: D.text5 }}>
                <div>Role</div><div>Applicants</div><div>Avg score</div><div>Location</div><div>Lane</div><div>Action</div>
              </div>
              {(a.roles || []).map((r) => {
                const lane = LANE[domLane(r)];
                return (
                  <div key={r.job_id} className="grid items-center md:!grid-cols-[1.6fr_90px_100px_1fr_100px_110px]" style={{ gridTemplateColumns: "1fr auto", gap: 12, padding: "12px 4px", borderTop: `0.5px solid ${D.hair}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}{r.stale > 0 && <span style={{ color: D.amber }}> ⚠</span>}</div>
                    </div>
                    <div className="hidden md:block" style={{ fontSize: 14, fontWeight: 700, color: D.text2 }}>{r.applicants}</div>
                    <div className="hidden md:block" style={{ fontSize: 14, fontWeight: 700, color: D.blue }}>{r.avg}</div>
                    <div className="hidden md:block" style={{ fontSize: 12.5, color: D.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.location || "—"}</div>
                    <div className="hidden md:block">
                      <span style={{ fontSize: 11, fontWeight: 600, color: lane.c, background: lane.bg, border: `0.5px solid ${lane.border}`, padding: "4px 10px", borderRadius: 999 }}>{lane.label}</span>
                    </div>
                    <button onClick={() => navigate(`/jobs/${r.job_id}/dashboard`)} style={{ fontSize: 12, fontWeight: 700, background: D.text, color: D.page, border: "none", borderRadius: 999, padding: "7px 15px", cursor: "pointer", justifySelf: "start" }}>View pipeline</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

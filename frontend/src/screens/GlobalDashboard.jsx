import { useEffect, useState, useCallback, useRef } from "react";
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
  const [insightIdx, setInsightIdx] = useState(0);
  const [insight, setInsight] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);
  const [queueFilter, setQueueFilter] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(false));
    axios.get("/api/candidates-recent?limit=20").then((r) => setRecent(r.data?.results || [])).catch(() => setRecent([]));
  }, []);

  const fetchInsight = useCallback((idx) => {
    setInsightBusy(true);
    axios.post("/api/assistant/ask", { question: INSIGHT_PROMPTS[idx], history: [] })
      .then((r) => setInsight(r.data.answer || "No insight available right now."))
      .catch(() => setInsight("Couldn't reach the assistant just now."))
      .finally(() => setInsightBusy(false));
  }, []);
  useEffect(() => { fetchInsight(insightIdx); }, [insightIdx, fetchInsight]);

  function toggleFilter(key) {
    setQueueFilter((cur) => {
      const next = cur === key ? null : key;
      if (next && tableRef.current) setTimeout(() => tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
      return next;
    });
  }

  const firstName = (user?.name || "there").split(" ")[0];
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  // Small colored section heading so each block is visually distinct.
  const Section = ({ color, title, right }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 4, height: 18, borderRadius: 3, background: color }} />
        <h2 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: D.text }}>{title}</h2>
      </div>
      {right}
    </div>
  );

  if (a === null) return <div style={{ ...card, height: 320 }} className="animate-pulse" />;

  const lanes = a?.lane_breakdown || { green: { count: 0, pct: 0 }, amber: { count: 0, pct: 0 }, red: { count: 0, pct: 0 } };

  // Action queue — the "what needs me right now" buckets, each a distinct colour.
  const QUEUE = [
    { key: "cv_submission", label: "Needs review", sub: "CVs to screen", n: a?.by_stage?.cv_submission ?? 0, color: D.blue, tint: "rgba(76,125,251,0.13)", ring: "rgba(76,125,251,0.5)" },
    { key: "ocean_assessment", label: "Awaiting OCEAN", sub: "with candidate", n: a?.by_stage?.ocean_assessment ?? 0, color: "#8B5CF6", tint: "rgba(139,92,246,0.13)", ring: "rgba(139,92,246,0.5)" },
    { key: "interview", label: "To interview", sub: "passed screening", n: a?.by_stage?.interview ?? 0, color: D.amber, tint: D.amberBg, ring: D.amberBorder },
    { key: "offer", label: "Ready to offer", sub: "decide now", n: a?.by_stage?.offer ?? 0, color: D.green, tint: D.greenBg, ring: D.greenBorder },
    { key: "stale", label: "Going stale", sub: "5+ days idle", n: a?.stale_count ?? 0, color: D.red, tint: D.redBg, ring: D.redBorder },
  ];

  const filtered = (recent || []).filter((c) => {
    if (!queueFilter) return true;
    if (queueFilter === "stale") return c.is_stale;
    return c.stage === queueFilter;
  });
  const activeQueue = QUEUE.find((q) => q.key === queueFilter);

  const funMax = Math.max(1, a?.by_stage?.cv_submission ?? 0, a?.by_stage?.ocean_assessment ?? 0, a?.by_stage?.interview ?? 0, a?.by_stage?.offer ?? 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 24 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 5px", color: D.text }}>{greeting}, {firstName} 👋</h1>
          <p style={{ fontSize: 15, color: D.text3, margin: 0 }}>Here's what needs you across your {a?.open_roles ?? 0} open role{a?.open_roles === 1 ? "" : "s"} today.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/upload")} style={{ padding: "11px 16px", background: D.cardBg, color: D.text2, border: `0.5px solid ${D.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>↥ Upload CV</button>
          <button onClick={() => navigate("/jobs/new")} style={{ padding: "11px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>＋ Create job</button>
        </div>
      </div>

      {/* Quick tools */}
      <div style={{ fontSize: 13, fontWeight: 700, color: D.text4, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 12 }}>Quick tools</div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 30 }}>
        {QUICK.map((q) => (
          <div key={q.title} onClick={() => navigate(q.to)} style={{ ...card, borderRadius: 14, padding: 18, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
            <div style={{ width: 40, height: 40, borderRadius: 11, background: q.ibg, color: q.ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 12 }}>{q.icon}</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3, color: D.text }}>{q.title}</div>
            <div style={{ fontSize: 12.5, color: D.text4, lineHeight: 1.45 }}>{q.sub}</div>
          </div>
        ))}
      </div>

      {/* ===== Your queue today (indigo) ===== */}
      <Section color="#6366F1" title="Your queue today"
        right={<span style={{ fontSize: 12.5, color: D.text4 }}>{a?.total_applicants ?? 0} candidates in flight</span>} />

      {/* AI insight line */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "11px 15px", marginBottom: 14 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>💡</span>
        <span style={{ fontSize: 13, color: D.text2, lineHeight: 1.5, flex: 1, minWidth: 0 }}>{insightBusy ? "Reading your pipeline…" : insight}</span>
        <span onClick={() => setInsightIdx((i) => (i + 1) % INSIGHT_PROMPTS.length)} style={{ fontSize: 12, color: D.text4, cursor: "pointer", whiteSpace: "nowrap" }}>Next →</span>
      </div>

      {/* Queue tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" style={{ marginBottom: 30 }}>
        {QUEUE.map((q) => {
          const active = queueFilter === q.key;
          return (
            <div key={q.key} onClick={() => toggleFilter(q.key)}
              style={{ background: active ? q.tint : D.cardBg, border: `1.5px solid ${active ? q.ring : D.border}`, borderRadius: 14, padding: "16px 16px 14px", cursor: "pointer", position: "relative", transition: "all .15s" }}
              className="hover:-translate-y-0.5">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: q.tint, color: q.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: q.color }} />
                </span>
                <span style={{ fontSize: 26, fontWeight: 800, color: q.color, letterSpacing: "-1px", lineHeight: 1 }}>{q.n}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: D.text }}>{q.label}</div>
              <div style={{ fontSize: 11.5, color: D.text4, marginTop: 2 }}>{q.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ===== Candidates needing attention (amber) ===== */}
      <div ref={tableRef} style={{ scrollMarginTop: 20 }}>
        <Section color={D.amber} title={activeQueue ? `${activeQueue.label} · ${filtered.length}` : "Candidates needing attention"}
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {queueFilter && <span onClick={() => setQueueFilter(null)} style={{ fontSize: 12, color: D.blue, fontWeight: 600, cursor: "pointer" }}>Clear filter ✕</span>}
              <span onClick={() => navigate("/jobs")} style={{ fontSize: 12.5, color: D.text3, cursor: "pointer" }}>All roles ›</span>
            </div>
          } />
        <div style={{ ...card, borderRadius: 18, padding: "8px 18px 14px" }}>
          {recent === null ? (
            <div style={{ fontSize: 12.5, color: D.text4, padding: "18px 0" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: D.text4, padding: "26px 4px", textAlign: "center" }}>{queueFilter ? "No candidates in this bucket right now." : "No candidates yet."}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="hidden md:grid" style={{ gridTemplateColumns: "1.6fr 70px 110px 1fr 110px 90px", gap: 12, padding: "10px 4px", fontSize: 10.5, fontWeight: 600, color: D.text5 }}>
                <div>Candidate</div><div>Score</div><div>Stage</div><div>Role</div><div>Lane</div><div>Action</div>
              </div>
              {filtered.map((c, i) => {
                const lane = LANE[c.lane] || null;
                const scoreColor = lane ? lane.c : D.text2;
                return (
                  <div key={c.candidate_id} className="grid items-center md:!grid-cols-[1.6fr_70px_110px_1fr_110px_90px]" style={{ gridTemplateColumns: "1fr auto", gap: 12, padding: "12px 4px", borderTop: `0.5px solid ${D.hair}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ width: 30, height: 30, borderRadius: "50%", background: avatarBg(i), color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: D.text }}>{c.name}{c.is_stale && <span style={{ fontSize: 10.5, fontWeight: 700, color: D.red, background: D.redBg, border: `0.5px solid ${D.redBorder}`, padding: "1px 6px", borderRadius: 20, marginLeft: 8 }}>{c.days_waiting}d</span>}</div>
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

      {/* ===== Active job roles (blue) — the centrepiece ===== */}
      <div style={{ marginTop: 30 }}>
        <Section color={D.blue} title="Active job roles"
          right={<span onClick={() => navigate("/jobs")} style={{ fontSize: 13, color: D.blue, fontWeight: 600, cursor: "pointer" }}>View all →</span>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(a?.roles || []).map((j) => {
            const tot = Math.max(1, j.g + j.a + j.r);
            return (
              <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ ...card, padding: 20, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 6, color: D.text }}>{j.title}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>{j.dept}</span>
                      <span style={{ fontSize: 13, color: D.text4 }}>{j.location}</span>
                    </div>
                  </div>
                  {j.stale > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: D.red, background: D.redBg, border: `0.5px solid ${D.redBorder}`, padding: "4px 8px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>⚠ {j.stale} stale</span>}
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                  <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: D.text }}>{j.applicants}</div><div style={{ fontSize: 12, color: D.text4, marginTop: 3 }}>applicants</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 700, color: D.blue, lineHeight: 1 }}>{j.avg}</div><div style={{ fontSize: 12, color: D.text4, marginTop: 3 }}>avg score</div></div>
                </div>
                <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: D.inset }}>
                  <div style={{ width: `${(j.g / tot) * 100}%`, background: D.green }} />
                  <div style={{ width: `${(j.a / tot) * 100}%`, background: D.amber }} />
                  <div style={{ width: `${(j.r / tot) * 100}%`, background: D.red }} />
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: D.text3 }}>
                  <span>🟢 {j.g}</span><span>🟡 {j.a}</span><span>🔴 {j.r}</span>
                </div>
              </div>
            );
          })}
          {(a?.roles || []).length === 0 && <div style={{ ...card, padding: 24, textAlign: "center", fontSize: 14, color: D.text4 }} className="col-span-full">No roles yet.</div>}
        </div>
      </div>

      {/* ===== Pipeline health (green) — funnel + lane breakdown ===== */}
      <div style={{ marginTop: 30 }}>
        <Section color={D.green} title="Pipeline health" />
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]" style={{ marginBottom: 8 }}>
          {/* Funnel */}
          <div style={{ ...card, padding: "22px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: D.text }}>Pipeline funnel</div>
            <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>Where candidates sit — spot the bottleneck</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "cv_submission", label: "CV review", c: D.blue },
                { key: "ocean_assessment", label: "OCEAN", c: "#8B5CF6" },
                { key: "interview", label: "Interview", c: D.amber },
                { key: "offer", label: "Offer", c: D.green },
              ].map((f) => {
                const n = a?.by_stage?.[f.key] ?? 0;
                return (
                  <div key={f.key} onClick={() => toggleFilter(f.key)} style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                    <div style={{ width: 78, fontSize: 13, fontWeight: 600, color: D.text3 }}>{f.label}</div>
                    <div style={{ flex: 1, height: 26, background: D.inset, borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(n / funMax) * 100}%`, background: f.c, borderRadius: 8, opacity: 0.9, minWidth: n > 0 ? 6 : 0 }} />
                    </div>
                    <div style={{ width: 30, textAlign: "right", fontSize: 14, fontWeight: 700, color: D.text }}>{n}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lane breakdown */}
          <div style={{ ...card, padding: "22px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: D.text }}>AI fit breakdown</div>
            <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>Quality of candidates across the board</div>
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
      </div>
    </div>
  );
}

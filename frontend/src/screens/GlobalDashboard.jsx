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
  const card = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 18 };
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [popout, setPopout] = useState(null); // null | 'candidates' | 'roles'
  const [queueFilter, setQueueFilter] = useState(null);

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

  useEffect(() => {
    document.body.style.overflow = popout ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [popout]);

  const firstName = (user?.name || "there").split(" ")[0];
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  function openCandidates(filter) { setQueueFilter(filter || null); setPopout("candidates"); }

  if (a === null) return <div style={{ ...card, height: 320 }} className="animate-pulse" />;

  const lanes = a?.lane_breakdown || { green: { count: 0, pct: 0 }, amber: { count: 0, pct: 0 }, red: { count: 0, pct: 0 } };

  // "In progress" stages (routine) vs "needs your action" (urgent) — each a distinct colour.
  const INPROGRESS = [
    { key: "cv_submission", label: "Needs review", n: a?.by_stage?.cv_submission ?? 0, color: D.blue },
    { key: "ocean_assessment", label: "Awaiting OCEAN", n: a?.by_stage?.ocean_assessment ?? 0, color: "#8B5CF6" },
    { key: "interview", label: "In interview", n: a?.by_stage?.interview ?? 0, color: D.amber },
  ];
  const ACTIONS = [
    { key: "offer", label: "Ready to offer", sub: "decide now", n: a?.by_stage?.offer ?? 0, color: D.green, tint: D.greenBg, border: D.greenBorder },
    { key: "stale", label: "Going stale", sub: "5+ days idle", n: a?.stale_count ?? 0, color: D.red, tint: D.redBg, border: D.redBorder },
  ];

  const filtered = (recent || []).filter((c) => {
    if (!queueFilter) return true;
    if (queueFilter === "stale") return c.is_stale;
    return c.stage === queueFilter;
  });
  const needAction = (a?.by_stage?.offer ?? 0) + (a?.stale_count ?? 0);
  const roles = a?.roles || [];
  const funMax = Math.max(1, a?.by_stage?.cv_submission ?? 0, a?.by_stage?.ocean_assessment ?? 0, a?.by_stage?.interview ?? 0, a?.by_stage?.offer ?? 0);

  // ---- shared bits ----
  const Section = ({ color, title, sub, right }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 4, height: 18, borderRadius: 3, background: color }} />
        <div>
          <h2 className="font-display" style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: D.text }}>{title}</h2>
          {sub && <div style={{ fontSize: 12, color: D.text4, marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );

  const laneTotal = Math.max(1, lanes.green.count + lanes.amber.count + lanes.red.count);
  const gPct = (lanes.green.count / laneTotal) * 100;
  const aPct = (lanes.amber.count / laneTotal) * 100;

  const CandidateRows = ({ list }) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="hidden md:grid" style={{ gridTemplateColumns: "1.6fr 70px 110px 1fr 110px 90px", gap: 12, padding: "10px 4px", fontSize: 10.5, fontWeight: 600, color: D.text5 }}>
        <div>Candidate</div><div>Score</div><div>Stage</div><div>Role</div><div>Lane</div><div>Action</div>
      </div>
      {list.map((c, i) => {
        const lane = LANE[c.lane] || null;
        return (
          <div key={c.candidate_id} className="grid items-center md:!grid-cols-[1.6fr_70px_110px_1fr_110px_90px]" style={{ gridTemplateColumns: "1fr auto", gap: 12, padding: "12px 4px", borderTop: `0.5px solid ${D.hair}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: avatarBg(i), color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: D.text }}>{c.name}{c.is_stale && <span style={{ fontSize: 10.5, fontWeight: 700, color: D.red, background: D.redBg, border: `0.5px solid ${D.redBorder}`, padding: "1px 6px", borderRadius: 20, marginLeft: 8 }}>{c.days_waiting}d</span>}</div>
                <div style={{ fontSize: 11, color: D.text4 }}>{c.experience_years != null ? `${c.experience_years} yrs` : "—"}{c.location ? ` · ${c.location}` : ""}</div>
              </div>
            </div>
            <div className="hidden md:block" style={{ fontSize: 14, fontWeight: 700, color: lane ? lane.c : D.text2 }}>{c.score ?? "—"}</div>
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
  );

  const RoleCards = ({ list }) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((j) => {
        const tot = Math.max(1, j.g + j.a + j.r);
        return (
          <div key={j.job_id} onClick={() => { setPopout(null); navigate(`/jobs/${j.job_id}/dashboard`); }} style={{ ...card, padding: 20, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 6, color: D.text }}>{j.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>{j.dept}</span>
                  <span style={{ fontSize: 13, color: D.text4 }}>{j.location}</span>
                </div>
              </div>
              {j.stale > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: D.red, background: D.redBg, border: `0.5px solid ${D.redBorder}`, padding: "4px 8px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>⚠ {j.stale}</span>}
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
    </div>
  );

  const Popout = ({ title, sub, accent, children }) => (
    <div onClick={() => setPopout(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 940, background: D.page, border: `0.5px solid ${D.border}`, borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,.5)", fontFamily: D.font, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: `0.5px solid ${D.border}`, background: D.cardBg }}>
          <span style={{ width: 4, height: 22, borderRadius: 3, background: accent }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.3px", color: D.text }}>{title}</div>
            {sub && <div style={{ fontSize: 12.5, color: D.text4, marginTop: 1 }}>{sub}</div>}
          </div>
          <button onClick={() => setPopout(null)} style={{ fontSize: 22, color: D.text4, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 5px", color: D.text }}>{greeting}, {firstName} 👋</h1>
          <p style={{ fontSize: 15, color: D.text3, margin: 0 }}>Here's what needs you across your {a?.open_roles ?? 0} open role{a?.open_roles === 1 ? "" : "s"} today.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/upload")} style={{ padding: "11px 16px", background: D.cardBg, color: D.text2, border: `0.5px solid ${D.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>↥ Upload CV</button>
          <button onClick={() => navigate("/jobs/new")} style={{ padding: "11px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>＋ Create job</button>
        </div>
      </div>

      {/* Quick tools — collapsible bar */}
      <div style={{ ...card, marginBottom: 24, overflow: "hidden" }}>
        <div onClick={() => setToolsOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", cursor: "pointer" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: D.text }}>Quick tools</div>
            <div style={{ fontSize: 12, color: D.text4 }}>Upload a CV, create a role, manage companies & salaries</div>
          </div>
          <span style={{ fontSize: 13, color: D.text4, transition: "transform .2s", transform: toolsOpen ? "rotate(180deg)" : "none" }}>▾</span>
        </div>
        {toolsOpen && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ padding: "0 16px 16px" }}>
            {QUICK.map((q) => (
              <div key={q.title} onClick={() => navigate(q.to)} style={{ background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: 16, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
                <div style={{ width: 38, height: 38, borderRadius: 11, background: q.ibg, color: q.ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{q.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: D.text }}>{q.title}</div>
                <div style={{ fontSize: 12, color: D.text4, lineHeight: 1.4 }}>{q.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Your queue today (indigo) ===== */}
      <Section color="#6366F1" title="Your queue today" sub={`${a?.total_applicants ?? 0} candidates in flight`} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, ...card, padding: "11px 15px", marginBottom: 14 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>💡</span>
        <span style={{ fontSize: 13, color: D.text2, lineHeight: 1.5, flex: 1, minWidth: 0 }}>{insightBusy ? "Reading your pipeline…" : insight}</span>
        <span onClick={() => setInsightIdx((i) => (i + 1) % INSIGHT_PROMPTS.length)} style={{ fontSize: 12, color: D.text4, cursor: "pointer", whiteSpace: "nowrap" }}>Next →</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]" style={{ marginBottom: 30 }}>
        {/* In-progress column */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: D.text4, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>In progress</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {INPROGRESS.map((s) => (
              <div key={s.key} onClick={() => openCandidates(s.key)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 8px", borderRadius: 10, cursor: "pointer" }} className="hover:bg-black/5">
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: D.text2, flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: D.text, letterSpacing: "-.5px" }}>{s.n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action tiles */}
        {ACTIONS.map((s) => (
          <div key={s.key} onClick={() => openCandidates(s.key)} style={{ background: s.tint, border: `1px solid ${s.border}`, borderRadius: 18, padding: 20, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between" }} className="transition-transform hover:-translate-y-0.5">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</span>
              <span style={{ fontSize: 34, fontWeight: 800, color: s.color, letterSpacing: "-1.5px", lineHeight: 1 }}>{s.n}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <span style={{ fontSize: 12, color: D.text3 }}>{s.sub}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: s.color }}>View →</span>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Two pop-out summary cards ===== */}
      <div className="grid gap-4 lg:grid-cols-2" style={{ marginBottom: 30 }}>
        {/* Candidates needing attention */}
        <div style={{ ...card, padding: 22, cursor: "pointer" }} onClick={() => openCandidates(null)} className="transition-shadow hover:shadow-md">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 4, height: 18, borderRadius: 3, background: D.amber }} />
              <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: D.text }}>Candidates needing attention</h2>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: D.blue }}>Open →</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", color: D.text, lineHeight: 1 }}>{needAction}</span>
            <span style={{ fontSize: 13.5, color: D.text3 }}>need a decision or a nudge</span>
          </div>
          <div style={{ display: "flex", marginTop: 16 }}>
            {(recent || []).slice(0, 6).map((c, i) => (
              <span key={c.candidate_id} title={c.name} style={{ width: 32, height: 32, borderRadius: "50%", background: avatarBg(i), border: `2px solid ${D.cardBg}`, marginLeft: i === 0 ? 0 : -9, fontSize: 10.5, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            ))}
            {(recent || []).length > 6 && <span style={{ width: 32, height: 32, borderRadius: "50%", background: D.avatarGrey, border: `2px solid ${D.cardBg}`, marginLeft: -9, fontSize: 11, fontWeight: 600, color: D.text2, display: "flex", alignItems: "center", justifyContent: "center" }}>+{(recent || []).length - 6}</span>}
          </div>
        </div>

        {/* Active job roles */}
        <div style={{ ...card, padding: 22, cursor: "pointer" }} onClick={() => setPopout("roles")} className="transition-shadow hover:shadow-md">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 4, height: 18, borderRadius: 3, background: D.blue }} />
              <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0, color: D.text }}>Active job roles</h2>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: D.blue }}>Open →</span>
          </div>
          <div style={{ display: "flex", gap: 26 }}>
            <div><div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", color: D.text, lineHeight: 1 }}>{roles.length}</div><div style={{ fontSize: 12.5, color: D.text4, marginTop: 4 }}>open roles</div></div>
            <div><div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", color: D.blue, lineHeight: 1 }}>{a?.avg_score ?? 0}</div><div style={{ fontSize: 12.5, color: D.text4, marginTop: 4 }}>avg score</div></div>
            <div><div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", color: D.red, lineHeight: 1 }}>{roles.reduce((s, r) => s + (r.stale || 0), 0)}</div><div style={{ fontSize: 12.5, color: D.text4, marginTop: 4 }}>stale total</div></div>
          </div>
        </div>
      </div>

      {/* ===== Pipeline health (green) ===== */}
      <Section color={D.green} title="Pipeline health" />
      <div className="grid gap-4 lg:grid-cols-2">
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
                <div key={f.key} onClick={() => openCandidates(f.key)} style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
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

        {/* AI fit donut */}
        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: D.text }}>AI fit breakdown</div>
          <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>Quality of candidates across the board</div>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }} className="flex-wrap">
            <div style={{ width: 128, height: 128, borderRadius: "50%", flexShrink: 0, background: `conic-gradient(${D.green} 0 ${gPct}%, ${D.amber} ${gPct}% ${gPct + aPct}%, ${D.red} ${gPct + aPct}% 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: D.cardBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: D.green, lineHeight: 1 }}>{lanes.green.pct}%</span>
                <span style={{ fontSize: 11, color: D.text4 }}>strong fit</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 14 }}>
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

      {/* ===== Pop-outs ===== */}
      {popout === "candidates" && (
        <Popout title="Candidates needing attention" accent={D.amber}
          sub={queueFilter ? `${STAGE_LABEL[queueFilter] || (queueFilter === "stale" ? "Going stale" : queueFilter)} · ${filtered.length}` : `${filtered.length} candidates`}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {[{ k: null, label: "All" }, { k: "cv_submission", label: "Needs review" }, { k: "ocean_assessment", label: "OCEAN" }, { k: "interview", label: "Interview" }, { k: "offer", label: "Ready to offer" }, { k: "stale", label: "Going stale" }].map((f) => (
              <span key={f.label} onClick={() => setQueueFilter(f.k)} style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 999, cursor: "pointer", color: queueFilter === f.k ? "#fff" : D.text2, background: queueFilter === f.k ? D.blue : D.inset, border: `0.5px solid ${queueFilter === f.k ? D.blue : D.border}` }}>{f.label}</span>
            ))}
          </div>
          {filtered.length === 0 ? <div style={{ fontSize: 13, color: D.text4, padding: "26px 4px", textAlign: "center" }}>No candidates in this bucket right now.</div> : <CandidateRows list={filtered} />}
        </Popout>
      )}
      {popout === "roles" && (
        <Popout title="Active job roles" accent={D.blue} sub={`${roles.length} open role${roles.length === 1 ? "" : "s"}`}>
          {roles.length === 0 ? <div style={{ fontSize: 13, color: D.text4, padding: "26px 4px", textAlign: "center" }}>No roles yet.</div> : <RoleCards list={roles} />}
        </Popout>
      )}
    </div>
  );
}

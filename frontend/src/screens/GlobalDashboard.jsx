import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";
import { usePalette } from "../context/ThemeContext.jsx";

// Stage labels are shown read-only — the hiring lifecycle belongs to the
// client's ATS, we only mirror it for context.
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
  const [popout, setPopout] = useState(null); // null | 'candidates' | 'positions'
  const [filter, setFilter] = useState(null);

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

  function openCandidates(f) { setFilter(f || null); setPopout("candidates"); }

  if (a === null) return <div style={{ ...card, height: 320 }} className="animate-pulse" />;

  const lanes = a?.lane_breakdown || { green: { count: 0, pct: 0 }, amber: { count: 0, pct: 0 }, red: { count: 0, pct: 0 } };
  const ops = a?.ai_ops || {};
  const roles = a?.roles || [];

  // What the AI layer owns — analyst work, not the client's hiring pipeline.
  const TASKS = [
    { key: "awaiting_assessment", label: "Assessments outstanding", sub: "personality test not completed", n: ops.awaiting_assessment ?? 0, color: D.amber, tint: D.amberBg, border: D.amberBorder },
    { key: "awaiting_interview", label: "Interviews to score", sub: "waiting on an interviewer", n: ops.awaiting_interview ?? 0, color: "#8B5CF6", tint: "rgba(139,92,246,0.14)", border: "rgba(139,92,246,0.32)" },
    { key: "low_confidence", label: "Flagged for review", sub: "CV parsed with low confidence", n: ops.low_confidence ?? 0, color: D.red, tint: D.redBg, border: D.redBorder },
  ];

  const RISKS = [
    { key: "dealbreaker", label: "Dealbreaker triggered", n: ops.dealbreakers ?? 0, c: D.red },
    { key: "missing_must_haves", label: "Missing a must-have", n: ops.missing_must_haves ?? 0, c: D.amber },
    { key: "unscored", label: "Not yet scored", n: ops.unscored ?? 0, c: D.text4 },
  ];

  const filtered = (recent || []).filter((c) => {
    if (!filter) return true;
    if (filter === "awaiting_assessment") return !c.ocean_completed;
    if (filter === "awaiting_interview") return !c.interview_completed;
    if (filter === "low_confidence") return c.low_confidence;
    if (filter === "dealbreaker") return c.dealbreaker;
    if (filter === "missing_must_haves") return c.missing_must_haves > 0;
    if (filter === "unscored") return c.score == null;
    if (["green", "amber", "red"].includes(filter)) return c.lane === filter;
    return true;
  });

  const laneTotal = Math.max(1, lanes.green.count + lanes.amber.count + lanes.red.count);
  const gPct = (lanes.green.count / laneTotal) * 100;
  const aPct = (lanes.amber.count / laneTotal) * 100;

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

  const FILTERS = [
    { k: null, label: "All" },
    { k: "green", label: "Strong fit" },
    { k: "awaiting_assessment", label: "No assessment" },
    { k: "awaiting_interview", label: "Not interviewed" },
    { k: "dealbreaker", label: "Dealbreaker" },
    { k: "low_confidence", label: "Low confidence" },
  ];

  const CandidateRows = ({ list }) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="hidden md:grid" style={{ gridTemplateColumns: "1.6fr 70px 110px 1fr 110px 90px", gap: 12, padding: "10px 4px", fontSize: 10.5, fontWeight: 600, color: D.text5 }}>
        <div>Candidate</div><div>AI score</div><div>Lane</div><div>Role</div><div>ATS status</div><div>Action</div>
      </div>
      {list.map((c, i) => {
        const lane = LANE[c.lane] || null;
        return (
          <div key={c.candidate_id} className="grid items-center md:!grid-cols-[1.6fr_70px_110px_1fr_110px_90px]" style={{ gridTemplateColumns: "1fr auto", gap: 12, padding: "12px 4px", borderTop: `0.5px solid ${D.hair}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: avatarBg(i), color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: D.text }}>
                  {c.name}
                  {c.dealbreaker && <span style={{ fontSize: 10, fontWeight: 700, color: D.red, background: D.redBg, border: `0.5px solid ${D.redBorder}`, padding: "1px 6px", borderRadius: 20, marginLeft: 8 }}>dealbreaker</span>}
                  {c.low_confidence && <span style={{ fontSize: 10, fontWeight: 700, color: D.amber, background: D.amberBg, border: `0.5px solid ${D.amberBorder}`, padding: "1px 6px", borderRadius: 20, marginLeft: 6 }}>low confidence</span>}
                </div>
                <div style={{ fontSize: 11, color: D.text4 }}>
                  {c.experience_years != null ? `${c.experience_years} yrs` : "—"}{c.location ? ` · ${c.location}` : ""}
                  {!c.ocean_completed && <span style={{ color: D.text5 }}> · no assessment</span>}
                </div>
              </div>
            </div>
            <div className="hidden md:block" style={{ fontSize: 14, fontWeight: 700, color: lane ? lane.c : D.text4 }}>{c.score ?? "—"}</div>
            <div className="hidden md:block">
              {lane && <span style={{ fontSize: 11, fontWeight: 600, color: lane.c, background: lane.bg, border: `0.5px solid ${lane.border}`, padding: "4px 10px", borderRadius: 999 }}>{lane.label}</span>}
            </div>
            <div className="hidden md:block" style={{ fontSize: 12.5, color: D.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.role_title}</div>
            <div className="hidden md:block" style={{ fontSize: 12, color: D.text4 }}>{STAGE_LABEL[c.stage] || c.stage}</div>
            <button onClick={() => navigate(`/jobs/${c.job_id}/candidate/${c.candidate_id}`)} style={{ fontSize: 12, fontWeight: 700, background: D.text, color: D.page, border: "none", borderRadius: 999, padding: "7px 15px", cursor: "pointer", justifySelf: "start" }}>Open</button>
          </div>
        );
      })}
    </div>
  );

  const Popout = ({ title, sub, accent, children }) => (
    <div onClick={() => setPopout(null)} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 960, background: D.page, border: `0.5px solid ${D.border}`, borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,.5)", fontFamily: D.font, overflow: "hidden" }}>
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
          <p style={{ fontSize: 15, color: D.text3, margin: 0 }}>Scoring and assessment across {roles.length} synced position{roles.length === 1 ? "" : "s"}.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* ATS connection health — an integration product needs this visible */}
          <div style={{ ...card, borderRadius: 11, padding: "8px 13px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: D.green, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.text }}>ATS connected</div>
              <div style={{ fontSize: 10.5, color: D.text4 }}>synced {new Date(a.generated_at).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI insight */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, ...card, padding: "11px 15px", marginBottom: 26 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>💡</span>
        <span style={{ fontSize: 13, color: D.text2, lineHeight: 1.5, flex: 1, minWidth: 0 }}>{insightBusy ? "Reading your pipeline…" : insight}</span>
        <span onClick={() => setInsightIdx((i) => (i + 1) % INSIGHT_PROMPTS.length)} style={{ fontSize: 12, color: D.text4, cursor: "pointer", whiteSpace: "nowrap" }}>Next →</span>
      </div>

      {/* ===== Needs your attention (indigo) — AI-layer work only ===== */}
      <Section color="#6366F1" title="Needs your attention" sub="Work owned by PeopleQuest — the hiring pipeline stays in your ATS" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" style={{ marginBottom: 30 }}>
        {TASKS.map((t) => (
          <div key={t.key} onClick={() => openCandidates(t.key)}
            style={{ background: t.tint, border: `1px solid ${t.border}`, borderRadius: 18, padding: 20, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            className="transition-transform hover:-translate-y-0.5">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.label}</span>
              <span style={{ fontSize: 34, fontWeight: 800, color: t.color, letterSpacing: "-1.5px", lineHeight: 1 }}>{t.n}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <span style={{ fontSize: 12, color: D.text3 }}>{t.sub}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: t.color }}>View →</span>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Scoring quality (green) ===== */}
      <Section color={D.green} title="Scoring quality" sub={`${ops.scored ?? 0} of ${a.total_applicants ?? 0} candidates scored`} />
      <div className="grid gap-4 lg:grid-cols-2" style={{ marginBottom: 30 }}>
        {/* AI fit donut */}
        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: D.text }}>AI fit breakdown</div>
          <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>How strong the applicant pool is overall</div>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }} className="flex-wrap">
            <div style={{ width: 128, height: 128, borderRadius: "50%", flexShrink: 0, background: `conic-gradient(${D.green} 0 ${gPct}%, ${D.amber} ${gPct}% ${gPct + aPct}%, ${D.red} ${gPct + aPct}% 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: D.cardBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: D.green, lineHeight: 1 }}>{lanes.green.pct}%</span>
                <span style={{ fontSize: 11, color: D.text4 }}>strong fit</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { k: "green", c: D.green, label: "Green · strong fit", d: lanes.green },
                { k: "amber", c: D.amber, label: "Amber · review", d: lanes.amber },
                { k: "red", c: D.red, label: "Red · likely no", d: lanes.red },
              ].map((l) => (
                <div key={l.label} onClick={() => openCandidates(l.k)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.c }} />
                  <span style={{ fontSize: 13.5, color: D.text2, flex: 1 }}>{l.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: D.text }}>{l.d.count}</span>
                  <span style={{ fontSize: 13, color: D.text4, width: 38, textAlign: "right" }}>{l.d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk flags */}
        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: D.text }}>Risk flags</div>
          <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>What the AI wants you to look at before shortlisting</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {RISKS.map((r) => (
              <div key={r.key} onClick={() => openCandidates(r.key)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: D.inset, borderRadius: 12, cursor: "pointer" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.c, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: D.text2, flex: 1 }}>{r.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: r.n > 0 ? r.c : D.text5, letterSpacing: "-.5px" }}>{r.n}</span>
              </div>
            ))}
            {(a.models_pending ?? 0) > 0 && (
              <div onClick={() => setPopout("positions")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: D.amberBg, border: `1px solid ${D.amberBorder}`, borderRadius: 12, cursor: "pointer" }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                <span style={{ fontSize: 13, color: D.text2, flex: 1 }}><b style={{ color: D.amber }}>{a.models_pending}</b> position{a.models_pending === 1 ? "" : "s"} without a complete scoring model</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: D.amber }}>Fix →</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Candidates (amber) ===== */}
      <Section color={D.amber} title="Scored candidates"
        right={<span onClick={() => openCandidates(null)} style={{ fontSize: 12.5, fontWeight: 700, color: D.blue, cursor: "pointer" }}>Open list →</span>} />
      <div style={{ ...card, padding: 22, marginBottom: 30, cursor: "pointer" }} onClick={() => openCandidates(null)} className="transition-shadow hover:shadow-md">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", color: D.text, lineHeight: 1 }}>{a.total_applicants ?? 0}</span>
          <span style={{ fontSize: 13.5, color: D.text3 }}>candidates analysed · avg score {a.avg_score ?? 0}</span>
        </div>
        <div style={{ display: "flex", marginTop: 16 }}>
          {(recent || []).slice(0, 8).map((c, i) => (
            <span key={c.candidate_id} title={c.name} style={{ width: 32, height: 32, borderRadius: "50%", background: avatarBg(i), border: `2px solid ${D.cardBg}`, marginLeft: i === 0 ? 0 : -9, fontSize: 10.5, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
          ))}
          {(recent || []).length > 8 && <span style={{ width: 32, height: 32, borderRadius: "50%", background: D.avatarGrey, border: `2px solid ${D.cardBg}`, marginLeft: -9, fontSize: 11, fontWeight: 600, color: D.text2, display: "flex", alignItems: "center", justifyContent: "center" }}>+{(recent || []).length - 8}</span>}
        </div>
      </div>

      {/* ===== Positions (blue) — synced, read-only ===== */}
      <Section color={D.blue} title="Positions" sub="Synced from your ATS — read-only"
        right={<span onClick={() => navigate("/jobs")} style={{ fontSize: 13, color: D.blue, fontWeight: 600, cursor: "pointer" }}>View all →</span>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((j) => {
          const tot = Math.max(1, j.g + j.a + j.r);
          return (
            <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ ...card, padding: 20, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 5, color: D.text }}>{j.title}</div>
                  <div style={{ fontSize: 12.5, color: D.text4 }}>{j.location}</div>
                </div>
                {j.model_ready
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: D.green, background: D.greenBg, border: `0.5px solid ${D.greenBorder}`, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>model ready</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, color: D.amber, background: D.amberBg, border: `0.5px solid ${D.amberBorder}`, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>needs setup</span>}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: D.text }}>{j.applicants}</div><div style={{ fontSize: 12, color: D.text4, marginTop: 3 }}>candidates</div></div>
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
        {roles.length === 0 && <div style={{ ...card, padding: 24, textAlign: "center", fontSize: 14, color: D.text4 }} className="col-span-full">No positions synced yet.</div>}
      </div>

      {/* ===== Pop-outs ===== */}
      {popout === "candidates" && (
        <Popout title="Scored candidates" accent={D.amber} sub={`${filtered.length} shown`}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {FILTERS.map((f) => (
              <span key={f.label} onClick={() => setFilter(f.k)} style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 999, cursor: "pointer", color: filter === f.k ? "#fff" : D.text2, background: filter === f.k ? D.blue : D.inset, border: `0.5px solid ${filter === f.k ? D.blue : D.border}` }}>{f.label}</span>
            ))}
          </div>
          {filtered.length === 0
            ? <div style={{ fontSize: 13, color: D.text4, padding: "26px 4px", textAlign: "center" }}>No candidates match this filter.</div>
            : <CandidateRows list={filtered} />}
        </Popout>
      )}
      {popout === "positions" && (
        <Popout title="Positions needing setup" accent={D.amber} sub="Scoring model incomplete — scores may be unreliable">
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {roles.filter((r) => !r.model_ready).map((r) => (
              <div key={r.job_id} onClick={() => { setPopout(null); navigate(`/jobs/${r.job_id}/success-profile`); }}
                style={{ ...card, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }} className="flex-wrap">
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: D.text }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: D.text4, marginTop: 2 }}>
                    {!r.has_criteria && "Scoring criteria not generated"}
                    {!r.has_criteria && !r.has_profile && " · "}
                    {!r.has_profile && "Success Profile not defined"}
                  </div>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: D.blue, whiteSpace: "nowrap" }}>Set up →</span>
              </div>
            ))}
            {roles.filter((r) => !r.model_ready).length === 0 && <div style={{ fontSize: 13, color: D.text4, padding: "20px 4px", textAlign: "center" }}>Every position has a complete scoring model.</div>}
          </div>
        </Popout>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { round, candidateStatus } from "../lib/format.js";
import { usePalette } from "../context/ThemeContext.jsx";

function Card({ c, D }) {
  const p = c.profile || {};
  const s = c.score || {};
  const criteria = s.criteria_scores || [];
  const status = candidateStatus(s);
  const budget = c.budget_fit;
  const srcTag = {
    cv: { bg: D.blueBg, color: D.blue }, ocean: { bg: D.greenBg, color: D.green },
    interview: { bg: "rgba(139,92,246,0.16)", color: "#8B5CF6" }, hr_notes: { bg: D.amberBg, color: D.amber },
  };
  const bud = {
    green: { color: D.green, bg: D.greenBg, border: D.greenBorder }, amber: { color: D.amber, bg: D.amberBg, border: D.amberBorder },
    red: { color: D.red, bg: D.redBg, border: D.redBorder }, blue: { color: D.blue, bg: D.blueBg, border: D.blueBorder },
    neutral: { color: D.text3, bg: D.pillBg, border: D.border },
  };
  return (
    <div style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16, padding: 24, flex: "1 1 400px", minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: D.text }}>{p.name}</div>
        {status !== "complete" && <span style={{ fontSize: 12, fontWeight: 600, color: D.text3, background: D.inset, padding: "4px 11px", borderRadius: 20, whiteSpace: "nowrap" }}>In progress</span>}
        <div style={{ whiteSpace: "nowrap" }}><span style={{ fontSize: 19, fontWeight: 800, color: D.text }}>{round(s.combined_score)}</span>{status !== "complete" && <span style={{ fontSize: 12, color: D.text4 }}> so far</span>}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {criteria.map((m) => {
          const tag = srcTag[m.source] || srcTag.cv;
          const na = m.not_applicable;
          const dot = m.score > 70 ? D.green : m.score >= 40 ? D.amber : D.red;
          return (
            <div key={m.criterion_id} style={{ display: "grid", gridTemplateColumns: "56px 1fr 56px 34px", gap: 10, alignItems: "center", padding: "7px 0", opacity: na ? 0.45 : 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", color: tag.color, background: tag.bg, padding: "4px 0", borderRadius: 6, textTransform: "uppercase" }}>{m.source === "hr_notes" ? "HR" : m.source}</span>
              <span style={{ fontSize: 12.5, color: D.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.criterion_name}</span>
              {m.scored && !na
                ? <div style={{ height: 8, background: D.inset, borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${round(m.score)}%`, background: dot, borderRadius: 5 }} /></div>
                : <div style={{ height: 8, borderRadius: 5, background: `repeating-linear-gradient(45deg,${D.border},${D.border} 4px,${D.inset} 4px,${D.inset} 8px)` }} />}
              <span style={{ fontSize: 12, color: D.text5, textAlign: "right" }}>{na ? "—" : `${Math.round(m.weight * 100)}%`}</span>
            </div>
          );
        })}
      </div>

      {budget && budget.status !== "unknown" && (() => { const b = bud[budget.lane] || bud.neutral; return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 18, padding: "10px 12px", background: b.bg, border: `1px solid ${b.border}`, borderRadius: 10 }}>
          <span style={{ fontSize: 12.5, color: D.text3 }}>Budget · expected {budget.expected_label || "—"}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: b.color, whiteSpace: "nowrap" }}>{budget.label}</span>
        </div>
      ); })()}

      <div style={{ fontSize: 13, fontWeight: 600, color: D.text4, margin: "22px 0 10px" }}>Strengths</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{(s.strengths || []).map((x, i) => <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: D.text2, lineHeight: 1.5 }}><span style={{ color: D.text5, flexShrink: 0 }}>•</span>{x}</div>)}</div>

      <div style={{ fontSize: 13, fontWeight: 600, color: D.text4, margin: "22px 0 10px" }}>Gaps</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{(s.gaps || []).map((x, i) => <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: D.text2, lineHeight: 1.5 }}><span style={{ color: D.text5, flexShrink: 0 }}>•</span>{x}</div>)}</div>

      <div style={{ fontSize: 13, fontWeight: 600, color: D.text4, margin: "22px 0 10px" }}>Recent roles</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: "auto" }}>{(p.work_history || []).slice(0, 2).map((w, i) => <div key={i} style={{ fontSize: 13.5, color: D.text2 }}>{w.title} · {w.employer}</div>)}</div>
    </div>
  );
}

export default function CompareView() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const D = usePalette();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);
  const [cands, setCands] = useState(null);
  const [comparison, setComparison] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (ids.length !== 2) return;
    Promise.all(ids.map((id) => axios.get(`/api/candidates/${jobId}/${id}`).then((r) => r.data))).then((list) => {
      setCands(list);
      axios.post("/api/compare-candidates", { candidate_id_1: ids[0], candidate_id_2: ids[1], job_id: jobId })
        .then((r) => setComparison(r.data.comparison_text)).catch(() => setComparison("Comparison unavailable.")).finally(() => setBusy(false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, params.get("ids")]);

  if (ids.length !== 2) return <div style={{ color: D.text3 }}>Select two candidates to compare.</div>;
  if (!cands) return <div style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16, height: 300 }} className="animate-pulse" />;
  const [a, b] = cands;

  return (
    <div>
      <div onClick={() => navigate(`/jobs/${jobId}/dashboard`)} style={{ fontSize: 13, color: D.blue, fontWeight: 600, cursor: "pointer", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to candidate list</div>
      <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", margin: "0 0 18px", color: D.text }}>Comparing {a.profile?.name} &amp; {b.profile?.name}</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
        <Card c={a} D={D} /><Card c={b} D={D} />
      </div>

      <div style={{ background: D.recBg, border: `0.5px solid ${D.recBorder}`, borderRadius: 16, padding: "22px 24px", marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", color: "#8B5CF6", marginBottom: 12 }}>✦ AI COMPARISON</div>
        <div style={{ fontSize: 14.5, color: D.text2, lineHeight: 1.65 }}>{busy ? "Analysing both candidates…" : comparison}</div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 18 }} className="flex-wrap">
        <button onClick={() => navigate(`/jobs/${jobId}/candidate/${ids[0]}`)} style={{ padding: "11px 18px", background: D.cardBg, color: D.text2, border: `0.5px solid ${D.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Open {a.profile?.name?.split(" ")[0]}</button>
        <button onClick={() => navigate(`/jobs/${jobId}/candidate/${ids[1]}`)} style={{ padding: "11px 18px", background: D.cardBg, color: D.text2, border: `0.5px solid ${D.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Open {b.profile?.name?.split(" ")[0]}</button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { round, displayLane, candidateStatus } from "../lib/format.js";

const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 24, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const SRC = { cv: { bg: "#EEF2FF", color: "#4338CA" }, ocean: { bg: "#ECFDF5", color: "#047857" }, interview: { bg: "#F5F3FF", color: "#6D28D9" }, hr_notes: { bg: "#FFF7ED", color: "#C2410C" } };
const LANE = { green: "#059669", amber: "#D97706", red: "#DC2626", in_progress: "#9CA3AF" };
const BUDGET = {
  green: { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" }, amber: { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  red: { color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" }, blue: { color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  neutral: { color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB" },
};

function Card({ c }) {
  const p = c.profile || {};
  const s = c.score || {};
  const criteria = s.criteria_scores || [];
  const status = candidateStatus(s);
  const budget = c.budget_fit;
  return (
    <div style={{ ...cardBox, flex: "1 1 400px", minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        {status !== "complete" && <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", background: "#F3F4F8", padding: "4px 11px", borderRadius: 20, whiteSpace: "nowrap" }}>In progress</span>}
        <div style={{ whiteSpace: "nowrap" }}><span style={{ fontSize: 19, fontWeight: 800, color: "#111827" }}>{round(s.combined_score)}</span>{status !== "complete" && <span style={{ fontSize: 12, color: "#9AA0AE" }}> so far</span>}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {criteria.map((m) => {
          const tag = SRC[m.source] || SRC.cv;
          const na = m.not_applicable;
          const dot = m.score > 70 ? "#059669" : m.score >= 40 ? "#D97706" : "#DC2626";
          return (
            <div key={m.criterion_id} style={{ display: "grid", gridTemplateColumns: "56px 1fr 56px 34px", gap: 10, alignItems: "center", padding: "7px 0", opacity: na ? 0.45 : 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", color: tag.color, background: tag.bg, padding: "4px 0", borderRadius: 6, textTransform: "uppercase" }}>{m.source === "hr_notes" ? "HR" : m.source}</span>
              <span style={{ fontSize: 12.5, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.criterion_name}</span>
              {m.scored && !na
                ? <div style={{ height: 8, background: "#F1F2F6", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${round(m.score)}%`, background: dot, borderRadius: 5 }} /></div>
                : <div style={{ height: 8, borderRadius: 5, background: "repeating-linear-gradient(45deg,#E6E8EE,#E6E8EE 4px,#F4F5F8 4px,#F4F5F8 8px)" }} />}
              <span style={{ fontSize: 12, color: "#B6B9C6", textAlign: "right" }}>{na ? "—" : `${Math.round(m.weight * 100)}%`}</span>
            </div>
          );
        })}
      </div>

      {budget && budget.status !== "unknown" && (() => { const b = BUDGET[budget.lane] || BUDGET.neutral; return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 18, padding: "10px 12px", background: b.bg, border: `1px solid ${b.border}`, borderRadius: 10 }}>
          <span style={{ fontSize: 12.5, color: "#6B7280" }}>Budget · expected {budget.expected_label || "—"}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: b.color, whiteSpace: "nowrap" }}>{budget.label}</span>
        </div>
      ); })()}

      <div style={{ fontSize: 13, fontWeight: 600, color: "#9AA0AE", margin: "22px 0 10px" }}>Strengths</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{(s.strengths || []).map((x, i) => <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: "#374151", lineHeight: 1.5 }}><span style={{ color: "#C4C7D2", flexShrink: 0 }}>•</span>{x}</div>)}</div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#9AA0AE", margin: "22px 0 10px" }}>Gaps</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{(s.gaps || []).map((x, i) => <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: "#374151", lineHeight: 1.5 }}><span style={{ color: "#C4C7D2", flexShrink: 0 }}>•</span>{x}</div>)}</div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#9AA0AE", margin: "22px 0 10px" }}>Recent roles</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: "auto" }}>{(p.work_history || []).slice(0, 2).map((w, i) => <div key={i} style={{ fontSize: 13.5, color: "#374151" }}>{w.title} · {w.employer}</div>)}</div>
    </div>
  );
}

export default function CompareView() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
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

  if (ids.length !== 2) return <div className="text-gray-500">Select two candidates to compare.</div>;
  if (!cands) return <div style={{ ...cardBox, height: 300 }} className="animate-pulse" />;
  const [a, b] = cands;

  return (
    <div>
      <div onClick={() => navigate(`/jobs/${jobId}/dashboard`)} style={{ fontSize: 13, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to candidate list</div>
      <h2 className="font-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", margin: "0 0 18px" }}>Comparing {a.profile?.name} &amp; {b.profile?.name}</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
        <Card c={a} /><Card c={b} />
      </div>

      <div style={{ background: "#F8F6FE", border: "1px solid #ECE7FB", borderRadius: 16, padding: "22px 24px", marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", color: "#7C3AED", marginBottom: 12 }}>✦ AI COMPARISON</div>
        <div style={{ fontSize: 14.5, color: "#44405A", lineHeight: 1.65 }}>{busy ? "Analysing both candidates…" : comparison}</div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 18 }} className="flex-wrap">
        <button onClick={() => navigate(`/jobs/${jobId}/candidate/${ids[0]}`)} style={{ padding: "11px 18px", background: "#fff", color: "#374151", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Open {a.profile?.name?.split(" ")[0]}</button>
        <button onClick={() => navigate(`/jobs/${jobId}/candidate/${ids[1]}`)} style={{ padding: "11px 18px", background: "#fff", color: "#374151", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Open {b.profile?.name?.split(" ")[0]}</button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const card = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 22, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const OCEAN_LEVELS = ["low", "medium-low", "medium", "medium-high", "high"];
const LEVEL_PCT = { low: 20, "medium-low": 40, medium: 60, "medium-high": 80, high: 100 };
const TRAITS = [["O", "Openness"], ["C", "Conscientious."], ["E", "Extraversion"], ["A", "Agreeableness"], ["N", "Neuroticism"]];
const PILL = {
  must: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", head: "#047857", title: "✓ Must-haves", key: "must_haves" },
  nice: { color: "#4338CA", bg: "#EEF2FF", border: "#C7D2FE", head: "#6366F1", title: "＋ Nice-to-haves", key: "nice_to_haves" },
  deal: { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA", head: "#B91C1C", title: "✕ Dealbreakers", key: "dealbreakers" },
};

const EMPTY = {
  summary: "", must_haves: [], nice_to_haves: [], dealbreakers: [],
  ideal_ocean_profile: { O: "medium", C: "high", E: "medium", A: "high", N: "low" },
  benchmark_experience_years: 2, benchmark_team_size: 0, benchmark_education: "",
};

export default function SuccessProfile() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [aiBanner, setAiBanner] = useState(false);

  useEffect(() => {
    axios.get("/api/jobs").then((r) => setJob(r.data.find((j) => j.job_id === jobId) || null));
    axios.get(`/api/jobs/${jobId}/success-profile`).then((r) => setProfile(r.data && Object.keys(r.data).length ? { ...EMPTY, ...r.data } : { ...EMPTY })).catch(() => setProfile({ ...EMPTY }));
  }, [jobId]);

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  async function generate() {
    setGenerating(true);
    try { setProfile({ ...EMPTY, ...(await axios.post(`/api/jobs/${jobId}/success-profile/generate`)).data }); setAiBanner(true); }
    catch { flash("Couldn't generate — please try again."); }
    finally { setGenerating(false); }
  }
  async function save() {
    setSaving(true);
    try { await axios.put(`/api/jobs/${jobId}/success-profile`, profile); setAiBanner(false); flash("Success profile saved"); }
    catch { flash("Save failed."); }
    finally { setSaving(false); }
  }
  function flash(m) { setToast(m); setTimeout(() => setToast(""), 2500); }

  if (!profile) return <div style={{ ...card, height: 280 }} className="animate-pulse" />;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }} className="pb-8">
      <div onClick={() => navigate(`/jobs/${jobId}/dashboard`)} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to candidates</div>

      {/* Banner */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#F5F3FF,#EEF2FF)", border: "1px solid #E9E5FF", borderRadius: 16, padding: "18px 22px", marginBottom: 22 }} className="flex-wrap gap-3">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: GRAD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✨</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#312E81" }}>Define the ideal candidate — {job?.role_title || ""}</div>
            <div style={{ fontSize: 13, color: "#6D5D9E" }}>Let AI pre-fill benchmarks from the role — edit anything before saving.</div>
          </div>
        </div>
        <button onClick={generate} disabled={generating} style={{ padding: "10px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", opacity: generating ? 0.7 : 1 }}>✨ {generating ? "Generating…" : "Generate with AI"}</button>
      </div>

      {aiBanner && <div style={{ background: "#F5F3FF", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#6D28D9" }}>AI-generated — please review before saving.</div>}
      {toast && <div style={{ background: "#ECFDF5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#047857" }}>{toast}</div>}

      {/* 2x2 grid */}
      <div className="grid gap-4 sm:grid-cols-2" style={{ marginBottom: 16 }}>
        {["must", "nice", "deal"].map((k) => <PillCard key={k} cfg={PILL[k]} items={profile[PILL[k].key]} onChange={(v) => set(PILL[k].key, v)} />)}
        {/* Benchmarks */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Benchmarks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Bench label="Ideal experience (years)"><input type="number" min="0" value={profile.benchmark_experience_years} onChange={(e) => set("benchmark_experience_years", Number(e.target.value))} style={benchInput} /></Bench>
            <Bench label="Team size led"><input type="number" min="0" value={profile.benchmark_team_size} onChange={(e) => set("benchmark_team_size", Number(e.target.value))} style={benchInput} /></Bench>
            <Bench label="Education"><input value={profile.benchmark_education} onChange={(e) => set("benchmark_education", e.target.value)} placeholder="e.g. Diploma or above" style={{ ...benchInput, width: 200 }} /></Bench>
          </div>
        </div>
      </div>

      {/* Ideal OCEAN */}
      <div style={{ ...card, marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Ideal OCEAN profile</div>
        <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 20 }}>Target personality traits for top performers in this role</div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
          {TRAITS.map(([key, lbl]) => {
            const val = profile.ideal_ocean_profile?.[key] || "medium";
            const idx = OCEAN_LEVELS.indexOf(val);
            return (
              <div key={key}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{lbl}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", textTransform: "capitalize" }}>{val}</span>
                </div>
                <div style={{ height: 8, background: "#F1F2F6", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}><div style={{ height: "100%", width: `${LEVEL_PCT[val]}%`, background: "linear-gradient(90deg,#818CF8,#7C3AED)", borderRadius: 5 }} /></div>
                <input type="range" min="0" max="4" value={idx < 0 ? 2 : idx} onChange={(e) => set("ideal_ocean_profile", { ...profile.ideal_ocean_profile, [key]: OCEAN_LEVELS[Number(e.target.value)] })} className="w-full accent-violet-600" />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => navigate(`/jobs/${jobId}/dashboard`)} style={{ padding: "11px 18px", background: "#fff", color: "#6B7280", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: "11px 20px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save success profile"}</button>
      </div>
    </div>
  );
}

const benchInput = { width: 90, padding: "6px 10px", border: "1px solid #E2E4EC", borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: "right", outline: "none" };
function Bench({ label, children }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span style={{ fontSize: 14, color: "#4B5563" }}>{label}</span>{children}</div>;
}

function PillCard({ cfg, items, onChange }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  function add() { const v = text.trim(); if (v) onChange([...(items || []), v]); setText(""); setAdding(false); }
  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: cfg.head, marginBottom: 14 }}>{cfg.title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(items || []).map((it, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: "7px 12px", borderRadius: 9 }}>
            {it}<span onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ cursor: "pointer", opacity: 0.6 }}>✕</span>
          </span>
        ))}
        {adding ? (
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setText(""); setAdding(false); } }} onBlur={add} placeholder="Type & Enter" style={{ fontSize: 13, padding: "7px 12px", border: "1px solid #D6D8E3", borderRadius: 9, outline: "none", minWidth: 120 }} />
        ) : (
          <span onClick={() => setAdding(true)} style={{ fontSize: 13, fontWeight: 500, color: "#9AA0AE", background: "#fff", border: "1px dashed #D6D8E3", padding: "7px 12px", borderRadius: 9, cursor: "pointer" }}>＋ Add</span>
        )}
      </div>
    </div>
  );
}

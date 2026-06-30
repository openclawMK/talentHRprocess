import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const INDUSTRIES = ["F&B", "Hospitality", "Retail", "Manufacturing & Production", "Logistics & Warehouse", "Early Childhood Education", "Other"];
const EDUCATION = ["SPM", "Diploma", "Degree", "Any"];
const ROLE_LEVELS = [
  { value: "entry", label: "Entry-level", hint: "CV 35% · OCEAN 15% · Interview 50%" },
  { value: "supervisory", label: "Supervisory", hint: "CV 45% · OCEAN 10% · Interview 45%" },
];
const SRC = { cv: { bg: "#EEF2FF", color: "#4338CA" }, ocean: { bg: "#ECFDF5", color: "#047857" }, interview: { bg: "#F5F3FF", color: "#6D28D9" } };

const input = { width: "100%", padding: "11px 14px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 15, color: "#111827", outline: "none", background: "#fff" };
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 };

export default function JobBuilder() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ role_title: "", industry: "F&B", location: "Kuala Lumpur", role_level: "entry", experience_years_min: 1, education_level_min: "SPM", key_responsibilities: "" });
  const [criteria, setCriteria] = useState([]);
  const [original, setOriginal] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const total = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);
  const totalPct = Math.round(total * 100);
  const valid = Math.abs(total - 1) <= 0.01;
  const respList = () => form.key_responsibilities.split("\n").map((s) => s.trim()).filter(Boolean);

  async function generate() {
    if (!form.role_title.trim()) { setError("Please enter a role title."); return; }
    setError(""); setGenerating(true);
    try {
      const res = await axios.post("/api/generate-criteria", { industry: form.industry, role_title: form.role_title, role_level: form.role_level, key_responsibilities: respList() });
      const c = res.data.criteria || [];
      setCriteria(c); setOriginal(c);
    } catch { setError("Couldn't generate criteria. Please try again."); }
    finally { setGenerating(false); }
  }
  function updateWeight(id, pct) { setCriteria((cs) => cs.map((c) => (c.id === id ? { ...c, weight: pct / 100 } : c))); }
  function remove(id) { setCriteria((cs) => cs.filter((c) => c.id !== id)); }

  async function save() {
    if (!valid) return;
    setSaving(true); setError("");
    try {
      const res = await axios.post("/api/jobs", {
        role_title: form.role_title, industry: form.industry, location: form.location, role_level: form.role_level,
        requirements: { experience_years_min: Number(form.experience_years_min) || 0, education_level_min: form.education_level_min },
        key_responsibilities: respList(),
        criteria: criteria.map((c, i) => ({ id: `c${i + 1}`, name: c.name, weight: c.weight, source: c.source, description: c.description || "" })),
      });
      navigate(`/jobs/${res.data.job_id}/dashboard`);
    } catch (err) { setError(err?.response?.data?.error || "Couldn't create the role."); setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div onClick={() => navigate("/")} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to dashboard</div>
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 6px" }}>Create a new job role</h1>
      <p style={{ fontSize: 15, color: "#6B7280", margin: "0 0 26px" }}>Fill in the basics — AI will draft the scoring criteria for you.</p>

      {/* Form card */}
      <div style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 26, boxShadow: "0 1px 2px rgba(16,24,40,.04)", marginBottom: 16 }}>
        <div className="grid gap-[18px] sm:grid-cols-2" style={{ marginBottom: 18 }}>
          <div><label style={label}>Job title</label><input style={input} value={form.role_title} onChange={(e) => set("role_title", e.target.value)} placeholder="e.g. Restaurant Manager" /></div>
          <div><label style={label}>Industry</label>
            <select style={input} value={form.industry} onChange={(e) => set("industry", e.target.value)}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
          </div>
        </div>
        <div className="grid gap-[18px] sm:grid-cols-2" style={{ marginBottom: 18 }}>
          <div><label style={label}>Location</label><input style={input} value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
          <div><label style={label}>Minimum education</label>
            <select style={input} value={form.education_level_min} onChange={(e) => set("education_level_min", e.target.value)}>{EDUCATION.map((x) => <option key={x}>{x}</option>)}</select>
          </div>
        </div>
        <div className="grid gap-[18px] sm:grid-cols-2" style={{ marginBottom: 18 }}>
          <div><label style={label}>Min experience (years)</label><input type="number" min="0" style={input} value={form.experience_years_min} onChange={(e) => set("experience_years_min", e.target.value)} /></div>
          <div><label style={label}>Role level</label>
            <div style={{ display: "flex", gap: 8 }}>
              {ROLE_LEVELS.map((rl) => (
                <button key={rl.value} type="button" onClick={() => set("role_level", rl.value)} title={rl.hint}
                  style={{ flex: 1, padding: "11px 8px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${form.role_level === rl.value ? "#7C3AED" : "#E2E4EC"}`, background: form.role_level === rl.value ? "#F5F3FF" : "#fff", color: form.role_level === rl.value ? "#6D28D9" : "#374151" }}>{rl.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div><label style={label}>Key responsibilities (one per line)</label>
          <textarea style={{ ...input, minHeight: 120, lineHeight: 1.6, resize: "vertical" }} value={form.key_responsibilities} onChange={(e) => set("key_responsibilities", e.target.value)} placeholder={"Manage daily operations\nLead a team of 10 staff\nHandle customer escalations"} />
        </div>
      </div>

      {/* AI criteria card */}
      {criteria.length === 0 ? (
        <div style={{ background: "linear-gradient(135deg,#F5F3FF,#EEF2FF)", border: "1px solid #E9E5FF", borderRadius: 16, padding: 22, marginBottom: 22, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#6D5D9E", marginBottom: 12 }}>Generate AI scoring criteria tailored to this role.</div>
          <button onClick={generate} disabled={generating} style={{ padding: "11px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: generating ? 0.7 : 1 }}>
            {generating ? "Generating…" : "✨ Generate criteria"}
          </button>
        </div>
      ) : (
        <div style={{ background: "linear-gradient(135deg,#F5F3FF,#EEF2FF)", border: "1px solid #E9E5FF", borderRadius: 16, padding: 22, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }} className="flex-wrap gap-3">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: GRAD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✨</div>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: "#312E81" }}>AI-generated scoring criteria</div><div style={{ fontSize: 13, color: "#6D5D9E" }}>Adjust weights to total 100% before publishing.</div></div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: valid ? "#047857" : "#B91C1C" }}>Total {totalPct}%{valid ? " ✓" : ""}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {criteria.map((c) => {
              const tag = SRC[c.source] || SRC.cv;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", textAlign: "center", width: 56, color: tag.color, background: tag.bg, padding: "4px 0", borderRadius: 6 }}>{c.source}</span>
                  <div style={{ width: 150, fontSize: 14, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.name}>{c.name}</div>
                  <input type="range" min="5" max="50" value={Math.round(c.weight * 100)} onChange={(e) => updateWeight(c.id, Number(e.target.value))} className="flex-1 accent-violet-600" />
                  <span style={{ width: 40, textAlign: "right", fontSize: 14, fontWeight: 700, color: "#4F46E5" }}>{Math.round(c.weight * 100)}%</span>
                  <button onClick={() => remove(c.id)} style={{ color: "#B6B9C6", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button onClick={generate} disabled={generating} style={{ padding: "9px 15px", background: "#fff", color: "#6D28D9", border: "1px solid #D6CDF5", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>✨ {generating ? "…" : "Regenerate"}</button>
            <button onClick={() => setCriteria(original)} style={{ padding: "9px 15px", background: "transparent", color: "#9AA0AE", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Reset to AI suggestion</button>
          </div>
        </div>
      )}

      {error && <div style={{ color: "#DC2626", fontSize: 14, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => navigate("/")} style={{ padding: "12px 18px", background: "#fff", color: "#6B7280", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        <button onClick={save} disabled={!valid || saving || criteria.length === 0} style={{ padding: "12px 22px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: !valid || saving || criteria.length === 0 ? 0.5 : 1 }}>
          {saving ? "Publishing…" : "Publish job role"}
        </button>
      </div>
    </div>
  );
}

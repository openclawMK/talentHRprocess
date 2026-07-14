import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
// Fallback list if the industries lookup fails — the live list is fetched from
// the Salary Center's industry set so both stay in sync.
const FALLBACK_INDUSTRIES = ["F&B / Retail / Hospitality", "Professional / Office", "Other"];
const EDUCATION = ["SPM", "Diploma", "Degree", "Any"];
const ROLE_LEVELS = [
  { value: "entry", label: "Entry-level" },
  { value: "supervisory", label: "Supervisory" },
];
const INTERVIEW_CRITERIA_OPTIONS = [
  { value: 3, label: "3", hint: "Quick" },
  { value: 5, label: "5", hint: "Standard" },
  { value: 6, label: "6", hint: "Max detail" },
];

const input = { width: "100%", padding: "11px 14px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 15, color: "#111827", outline: "none", background: "#fff" };
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 };

export default function JobBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCompanyId = params.get("company") || "";

  const [form, setForm] = useState({ role_title: "", industry: "F&B / Retail / Hospitality", location: "Kuala Lumpur", role_level: "entry", experience_years_min: 1, education_level_min: "SPM", key_responsibilities: "" });
  const [interviewCriteriaCount, setInterviewCriteriaCount] = useState(3);
  const [industries, setIndustries] = useState(FALLBACK_INDUSTRIES);
  const [benchmarkRoles, setBenchmarkRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(presetCompanyId);
  const [newCompanyMode, setNewCompanyMode] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", industry: "" });
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get("/api/salary-center").then((r) => {
      const list = [...(r.data?.industries || []), "Other"];
      if (list.length > 1) setIndustries(list);
      setBenchmarkRoles(r.data?.roles || []);
    }).catch(() => {});
    axios.get("/api/companies").then((r) => setCompanies(r.data || [])).catch(() => {});
  }, []);

  // Role title suggestions for the selected industry — from the same real,
  // cited role dataset behind the Salary Center. Still a free-text field.
  const titleSuggestions = useMemo(
    () => [...new Set(benchmarkRoles.filter((r) => r.industry === form.industry).map((r) => r.category))].sort(),
    [benchmarkRoles, form.industry]
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const respList = () => form.key_responsibilities.split("\n").map((s) => s.trim()).filter(Boolean);
  const valid = form.role_title.trim() && companyId;

  async function createCompany() {
    if (!newCompany.name.trim()) return;
    setCreatingCompany(true); setError("");
    try {
      const res = await axios.post("/api/companies", newCompany);
      setCompanies((cs) => [...cs, res.data]);
      setCompanyId(res.data.id);
      setNewCompanyMode(false);
      setNewCompany({ name: "", industry: "" });
    } catch (err) { setError(err?.response?.data?.error || "Couldn't create the company."); }
    finally { setCreatingCompany(false); }
  }

  async function save() {
    if (!valid) return;
    setSaving(true); setError("");
    try {
      const res = await axios.post("/api/jobs", {
        role_title: form.role_title, industry: form.industry, location: form.location, role_level: form.role_level,
        requirements: { experience_years_min: Number(form.experience_years_min) || 0, education_level_min: form.education_level_min },
        key_responsibilities: respList(),
        company_id: companyId,
        interview_criteria_count: interviewCriteriaCount,
        // No criteria supplied — the server drafts them silently (AI-generated,
        // 15% OCEAN / 35% Profile fit / 50% Interview). HR's real work happens
        // next, on the Success Profile screen.
      });
      navigate(`/jobs/${res.data.job_id}/success-profile`);
    } catch (err) { setError(err?.response?.data?.error || "Couldn't create the role."); setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div onClick={() => navigate(companyId ? `/companies/${companyId}` : "/companies")} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back</div>
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 6px" }}>Create a new role</h1>
      <p style={{ fontSize: 15, color: "#6B7280", margin: "0 0 26px" }}>Fill in the basics — next you'll define the Success Profile that scores every candidate.</p>

      {/* Company */}
      <div style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 26, boxShadow: "0 1px 2px rgba(16,24,40,.04)", marginBottom: 16 }}>
        <label style={label}>Company</label>
        {!newCompanyMode ? (
          <div style={{ display: "flex", gap: 10 }}>
            <select style={input} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="" disabled>Select a company…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => setNewCompanyMode(true)} style={{ padding: "11px 16px", background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>＋ New company</button>
          </div>
        ) : (
          <div>
            <div className="grid gap-[10px] sm:grid-cols-2" style={{ marginBottom: 10 }}>
              <input style={input} placeholder="Company name" value={newCompany.name} onChange={(e) => setNewCompany((c) => ({ ...c, name: e.target.value }))} />
              <input style={input} placeholder="Industry (optional)" value={newCompany.industry} onChange={(e) => setNewCompany((c) => ({ ...c, industry: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={createCompany} disabled={creatingCompany || !newCompany.name.trim()} style={{ padding: "9px 15px", background: GRAD, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: creatingCompany || !newCompany.name.trim() ? 0.5 : 1 }}>{creatingCompany ? "Creating…" : "Create company"}</button>
              <button type="button" onClick={() => setNewCompanyMode(false)} style={{ padding: "9px 15px", background: "transparent", color: "#9AA0AE", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Role form */}
      <div style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 26, boxShadow: "0 1px 2px rgba(16,24,40,.04)", marginBottom: 16 }}>
        <div className="grid gap-[18px] sm:grid-cols-2" style={{ marginBottom: 18 }}>
          <div>
            <label style={label}>Job title</label>
            <input style={input} list="role-title-suggestions" value={form.role_title} onChange={(e) => set("role_title", e.target.value)} placeholder="e.g. Restaurant Manager — pick a suggestion or type your own" />
            <datalist id="role-title-suggestions">{titleSuggestions.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div><label style={label}>Industry</label>
            <select style={input} value={form.industry} onChange={(e) => set("industry", e.target.value)}>{industries.map((i) => <option key={i}>{i}</option>)}</select>
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
                <button key={rl.value} type="button" onClick={() => set("role_level", rl.value)}
                  style={{ flex: 1, padding: "11px 8px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${form.role_level === rl.value ? "#7C3AED" : "#E2E4EC"}`, background: form.role_level === rl.value ? "#F5F3FF" : "#fff", color: form.role_level === rl.value ? "#6D28D9" : "#374151" }}>{rl.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Interview criteria</label>
          <div style={{ display: "flex", gap: 8 }}>
            {INTERVIEW_CRITERIA_OPTIONS.map((o) => (
              <button key={o.value} type="button" onClick={() => setInterviewCriteriaCount(o.value)}
                style={{ flex: 1, padding: "9px 8px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${interviewCriteriaCount === o.value ? "#7C3AED" : "#E2E4EC"}`, background: interviewCriteriaCount === o.value ? "#F5F3FF" : "#fff", color: interviewCriteriaCount === o.value ? "#6D28D9" : "#374151" }}>{o.label} <span style={{ fontWeight: 500, opacity: 0.7 }}>· {o.hint}</span></button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 6 }}>How many distinct things you'll score in the interview — each gets its own weight inside the 50% interview score. More questions per criterion can still be chosen later when conducting the interview.</div>
        </div>
        <div><label style={label}>Key responsibilities (one per line)</label>
          <textarea style={{ ...input, minHeight: 120, lineHeight: 1.6, resize: "vertical" }} value={form.key_responsibilities} onChange={(e) => set("key_responsibilities", e.target.value)} placeholder={"Manage daily operations\nLead a team of 10 staff\nHandle customer escalations"} />
        </div>
      </div>

      {/* What happens next */}
      <div style={{ background: "linear-gradient(135deg,#F5F3FF,#EEF2FF)", border: "1px solid #E9E5FF", borderRadius: 16, padding: "18px 22px", marginBottom: 22, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: GRAD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✨</div>
        <div style={{ fontSize: 13.5, color: "#6D5D9E", lineHeight: 1.55 }}>Next, you'll define this role's <b style={{ color: "#4C1D95" }}>Success Profile</b> — the ideal candidate (must-haves, dealbreakers, personality, salary budget). AI drafts it for you; you review and adjust before it starts scoring candidates.</div>
      </div>

      {error && <div style={{ color: "#DC2626", fontSize: 14, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => navigate("/companies")} style={{ padding: "12px 18px", background: "#fff", color: "#6B7280", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        <button onClick={save} disabled={!valid || saving} style={{ padding: "12px 22px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: !valid || saving ? 0.5 : 1 }}>
          {saving ? "Creating…" : "Continue to Success Profile →"}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const avgColor = (v) => (v >= 70 ? "#047857" : v >= 40 ? "#D97706" : "#DC2626");
const input = { width: "100%", padding: "11px 14px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 15, color: "#111827", outline: "none", background: "#fff" };

export default function CompanySelector() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState(null);
  const [a, setA] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => axios.get("/api/companies").then((r) => setCompanies(r.data)).catch(() => setCompanies([]));
  useEffect(() => {
    load();
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(null));
  }, []);

  async function createCompany() {
    if (!form.name.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await axios.post("/api/companies", form);
      setCompanies((cs) => [...(cs || []), res.data]);
      setCreating(false); setForm({ name: "", industry: "" });
      navigate(`/companies/${res.data.id}`);
    } catch (err) { setError(err?.response?.data?.error || "Couldn't create the company."); }
    finally { setSaving(false); }
  }

  const summary = [
    { icon: "🏢", value: companies?.length ?? 0, label: "Companies", accent: "#6366F1" },
    { icon: "▤", value: a?.open_roles ?? 0, label: "Open roles", accent: "#7C3AED" },
    { icon: "👥", value: a?.total_applicants ?? 0, label: "Total applicants", accent: "#0EA5E9" },
    { icon: "✓", value: a?.green_count ?? 0, label: "Strong candidates", accent: "#059669" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 5px" }}>Companies</h1>
          <p style={{ fontSize: 15, color: "#6B7280", margin: 0 }}>Open a company to see its job roles.</p>
        </div>
        <button onClick={() => setCreating(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 20px rgba(99,102,241,.28)" }}>＋ New company</button>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 26 }}>
        {summary.map((s) => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.accent + "1A", color: s.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div><div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1 }}>{s.value}</div><div style={{ fontSize: 12.5, color: "#9AA0AE", marginTop: 3, fontWeight: 500 }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* New company inline form */}
      {creating && (
        <div style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 22, marginBottom: 22, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>New company</div>
          <div className="grid gap-[12px] sm:grid-cols-2" style={{ marginBottom: 14 }}>
            <input style={input} placeholder="Company name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input style={input} placeholder="Industry (optional)" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
          </div>
          {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createCompany} disabled={saving || !form.name.trim()} style={{ padding: "10px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: saving || !form.name.trim() ? 0.5 : 1 }}>{saving ? "Creating…" : "Create company"}</button>
            <button onClick={() => { setCreating(false); setError(""); }} style={{ padding: "10px 18px", background: "#fff", color: "#6B7280", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 18 }}>
        {companies === null ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, height: 200 }} className="animate-pulse" />)
        ) : companies.length === 0 && !creating ? (
          <div onClick={() => setCreating(true)} style={{ border: "1.5px dashed #D6D8E3", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer", minHeight: 200 }} className="transition-colors hover:border-violet-300 hover:bg-violet-50/30">
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#F3F4F8", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>＋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Create your first company</div>
            <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 4, maxWidth: 200 }}>Then add roles under it and start hiring.</div>
          </div>
        ) : companies.map((c) => (
          <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ position: "relative", background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, boxShadow: "0 1px 2px rgba(16,24,40,.04)", cursor: "pointer", overflow: "hidden" }} className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div style={{ height: 4, background: c.accent }} />
            <div style={{ padding: "24px 24px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 22 }}>
                <div style={{ width: 54, height: 54, borderRadius: 15, background: c.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, flexShrink: 0 }}>{c.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.4px", lineHeight: 1.2 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 4 }}>{c.industry || "No industry set"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                <div style={{ fontSize: 13.5, color: "#6B7280" }}><b style={{ color: "#1F2430" }}>{c.roles}</b> role{c.roles === 1 ? "" : "s"}</div>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.accent }}>View roles →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

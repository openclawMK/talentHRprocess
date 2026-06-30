import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const card = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };

export default function JobSelector() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);
  const [roles, setRoles] = useState({}); // job_id -> analytics row

  useEffect(() => {
    axios.get("/api/jobs").then((r) => setJobs(r.data)).catch(() => setJobs([]));
    axios.get("/api/analytics").then((r) => {
      const map = {};
      (r.data?.roles || []).forEach((x) => { map[x.job_id] = x; });
      setRoles(map);
    }).catch(() => setRoles({}));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }} className="flex-wrap gap-3">
        <div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", margin: 0 }}>Job roles</h1>
          <p style={{ fontSize: 15, color: "#6B7280", margin: "5px 0 0" }}>Open a role to review applicants, or create a new one.</p>
        </div>
        <button onClick={() => navigate("/jobs/new")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>＋ Create job</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs === null
          ? Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ ...card, height: 190 }} className="animate-pulse" />)
          : jobs.map((j) => {
              const r = roles[j.job_id] || { applicants: 0, avg: 0, g: 0, a: 0, r: 0 };
              const tot = Math.max(1, r.g + r.a + r.r);
              return (
                <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ ...card, padding: 22, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 6 }}>{j.role_title}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>{j.industry}</span>
                    <span style={{ fontSize: 13, color: "#9AA0AE" }}>{j.location}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                    <div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>{r.applicants}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 3 }}>applicants</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#4F46E5", lineHeight: 1 }}>{r.avg}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 3 }}>avg score</div></div>
                  </div>
                  <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "#F3F4F8" }}>
                    <div style={{ width: `${(r.g / tot) * 100}%`, background: "#059669" }} />
                    <div style={{ width: `${(r.a / tot) * 100}%`, background: "#D97706" }} />
                    <div style={{ width: `${(r.r / tot) * 100}%`, background: "#DC2626" }} />
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#6B7280" }}><span>🟢 {r.g}</span><span>🟡 {r.a}</span><span>🔴 {r.r}</span></div>
                </div>
              );
            })}

        {jobs !== null && (
          <button onClick={() => navigate("/jobs/new")} style={{ ...card, minHeight: 190, borderStyle: "dashed", borderColor: "#D6D8E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9AA0AE", cursor: "pointer", background: "#FAFAFC" }} className="hover:border-violet-300 hover:text-violet-700">
            <span style={{ fontSize: 26 }}>＋</span>
            <span style={{ marginTop: 8, fontSize: 14, fontWeight: 600 }}>Create new role</span>
            <span style={{ marginTop: 4, fontSize: 12 }}>AI-generated scoring criteria</span>
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Modal from "../components/Modal.jsx";
import { displayLane, round } from "../lib/format.js";
import { candidateStages } from "../lib/pipeline.js";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const AVATARS = [
  "linear-gradient(135deg,#6366F1,#7C3AED)", "linear-gradient(135deg,#0EA5E9,#6366F1)",
  "linear-gradient(135deg,#059669,#0EA5E9)", "linear-gradient(135deg,#F59E0B,#EF4444)",
  "linear-gradient(135deg,#EC4899,#7C3AED)", "linear-gradient(135deg,#14B8A6,#059669)",
];
const LANE = {
  green: { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", dot: "#059669", label: "Strong" },
  amber: { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", dot: "#D97706", label: "Review" },
  red: { color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA", dot: "#DC2626", label: "Likely no" },
  in_progress: { color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB", dot: "#9CA3AF", label: "In progress" },
};
const STAGE_LABEL = { cv_submission: "CV review", ocean_assessment: "OCEAN", interview: "Interview", offer: "Ready / offer" };
const FUNNEL = [
  { key: "cv_submission", label: "CV review" },
  { key: "ocean_assessment", label: "OCEAN" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
];

function initials(name) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function avatarFor(name) {
  let h = 0;
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}
function shortStage(candidate, job) {
  const { currentKey, rejected } = candidateStages(candidate, job);
  if (rejected) return "Rejected";
  return STAGE_LABEL[currentKey] || "—";
}

export default function Dashboard() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState(null);
  const [job, setJob] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pipeline, setPipeline] = useState(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [savingStage, setSavingStage] = useState(null);
  const [waModal, setWaModal] = useState(false);
  const [waForm, setWaForm] = useState({ candidate_name: "", phone: "" });
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState(null);
  const [hrAlerts, setHrAlerts] = useState(false);
  const [hrPhone, setHrPhone] = useState("");
  const [hrSaved, setHrSaved] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  async function saveHrAlerts(alerts = hrAlerts, phone = hrPhone) {
    try {
      await axios.patch(`/api/jobs/${jobId}/whatsapp-settings`, { hr_whatsapp_alerts: alerts, hr_contact_phone: phone });
      setHrSaved(true);
      setTimeout(() => setHrSaved(false), 2000);
    } catch { /* ignore */ }
  }
  async function sendPortalLink() {
    if (!waForm.phone.trim()) return;
    setWaSending(true); setWaResult(null);
    try { setWaResult((await axios.post(`/api/jobs/${jobId}/send-portal-link`, waForm)).data); }
    catch (e) { setWaResult({ error: e.response?.data?.error || "Failed to send." }); }
    finally { setWaSending(false); }
  }
  function copyLink() {
    if (!job?.portal_token) return;
    const url = `${window.location.origin}/apply/${job.portal_token}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }, () => window.prompt("Copy link:", url));
  }
  const load = useCallback(() => {
    axios.get(`/api/candidates/${jobId}`).then((r) => setCandidates(r.data)).catch(() => setCandidates([]));
  }, [jobId]);
  const loadAnalytics = useCallback(() => {
    axios.get(`/api/jobs/${jobId}/analytics`).then((r) => setAnalytics(r.data?.empty ? null : r.data)).catch(() => setAnalytics(null));
  }, [jobId]);

  useEffect(() => {
    axios.get("/api/jobs").then((r) => {
      const j = r.data.find((x) => x.job_id === jobId) || null;
      setJob(j);
      if (j) { setHrAlerts(!!j.hr_whatsapp_alerts); setHrPhone(j.hr_contact_phone || ""); }
    });
    axios.get(`/api/jobs/${jobId}/pipeline`).then((r) => setPipeline(r.data)).catch(() => setPipeline(null));
  }, [jobId]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  async function toggleStage(key) {
    if (!pipeline) return;
    const stage = pipeline.stages.find((s) => s.key === key);
    if (!stage || stage.locked) return;
    setSavingStage(key);
    try { setPipeline((await axios.patch(`/api/jobs/${jobId}/pipeline`, { stages: { [key]: !stage.enabled } })).data); load(); }
    catch { /* ignore */ } finally { setSavingStage(null); }
  }
  function toggleSel(id) {
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p);
  }

  const merged = [...(candidates || [])].sort((x, y) => (y.score?.combined_score ?? -1) - (x.score?.combined_score ?? -1));
  const counts = { all: merged.length, green: 0, amber: 0, red: 0 };
  merged.forEach((c) => { const l = displayLane(c.score); if (counts[l] != null) counts[l]++; });
  const visible = merged.filter((c) => filter === "all" || displayLane(c.score) === filter);

  const stats = [
    { label: "Applicants", value: analytics?.total_applicants ?? merged.length, color: "#111827" },
    { label: "Green", value: counts.green, color: "#059669" },
    { label: "Amber", value: counts.amber, color: "#D97706" },
    { label: "Red", value: counts.red, color: "#DC2626" },
    { label: "Avg score", value: analytics?.avg_score ?? 0, color: "#4F46E5" },
  ];
  const funMax = Math.max(1, ...FUNNEL.map((f) => analytics?.by_stage?.[f.key] ?? 0));

  return (
    <div className="pb-8">
      <div onClick={() => navigate("/")} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to dashboard</div>

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }} className="flex-wrap">
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", margin: 0 }}>{job?.role_title || "Role"}</h1>
            <span style={{ fontSize: 15, color: "#9AA0AE", fontWeight: 500 }}>{merged.length} candidate{merged.length === 1 ? "" : "s"}</span>
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>{job?.industry} · {job?.location}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }} className="flex-wrap">
          <button onClick={() => navigate(`/jobs/${jobId}/success-profile`)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "linear-gradient(135deg,#F5F3FF,#EDE9FE)", color: "#6D28D9", border: "1px solid #DDD6FE", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>◎ Success Profile</button>
          <button onClick={() => { setWaResult(null); setWaModal(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(22,163,74,.25)" }}>💬 Send via WhatsApp</button>
          <button onClick={copyLink} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: copied ? "#ECFDF5" : "#fff", color: copied ? "#047857" : "#374151", border: `1px solid ${copied ? "#A7F3D0" : "#E2E4EC"}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{copied ? "✓ Link copied" : "🔗 Copy link"}</button>
        </div>
      </div>

      {/* WhatsApp send modal */}
      {waModal && (
        <Modal title="Send application link via WhatsApp" onClose={() => setWaModal(false)}>
          {waResult?.ok ? (
            <div className="text-sm">
              <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">{waResult.skipped ? "WhatsApp isn't configured yet — logged but not sent." : "Message sent! ✅"}</div>
              <button onClick={() => setWaModal(false)} className="mt-4 w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white">Done</button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Candidate name</span>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none" value={waForm.candidate_name} onChange={(e) => setWaForm({ ...waForm, candidate_name: e.target.value })} placeholder="Optional" /></label>
              <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Phone (Malaysian)</span>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none" value={waForm.phone} onChange={(e) => setWaForm({ ...waForm, phone: e.target.value })} placeholder="012-345 6789" /></label>
              {waResult?.error && <p className="text-sm text-red-600">{waResult.error}</p>}
              <button onClick={sendPortalLink} disabled={waSending || !waForm.phone.trim()} className="w-full rounded-md py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "#16A34A" }}>{waSending ? "Sending…" : "Send link"}</button>
            </div>
          )}
        </Modal>
      )}

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5" style={{ marginBottom: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ ...cardBox, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 500, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* pipeline funnel */}
      <div style={{ ...cardBox, borderRadius: 14, padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }} className="flex-wrap">
          {FUNNEL.map((f, i) => {
            const n = analytics?.by_stage?.[f.key] ?? 0;
            const bottleneck = n === funMax && funMax > 0;
            return (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 120 }}>
                <div style={{ flex: 1, borderRadius: 11, padding: "12px 14px", textAlign: "center", background: bottleneck ? "#FFFBEB" : "#FAFAFC", border: bottleneck ? "1px solid #FDE68A" : "1px solid transparent" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: bottleneck ? "#B45309" : "#4F46E5" }}>{n}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginTop: 5 }}>{f.label}</div>
                </div>
                {i < FUNNEL.length - 1 && <span style={{ color: "#C4C7D2", fontSize: 15 }}>→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* pipeline setup */}
      {pipeline && (
        <div style={{ ...cardBox, borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <div onClick={() => setShowPipeline((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ color: "#7C3AED", fontSize: 16 }}>≡</span><span style={{ fontSize: 15, fontWeight: 700 }}>Pipeline setup</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#9AA0AE" }}>{Object.entries(pipeline.source_shares || {}).map(([k, v]) => `${k.toUpperCase()} ${Math.round(v * 100)}%`).join(" · ")}</span>
              <span style={{ fontSize: 12, color: "#B6B9C6" }}>{showPipeline ? "▲" : "▼"}</span>
            </div>
          </div>
          {showPipeline && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 14 }}>Turn stages on or off. Disabled stages drop out of scoring and their weight is redistributed.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {pipeline.stages.map((s) => {
                  const meta = { cv_submission: "CV submission", ocean_assessment: "OCEAN assessment", interview: "Interview", offer: "Offer" }[s.key];
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", background: "#FAFAFC", borderRadius: 11 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{meta}</span>
                      {s.locked && <span style={{ fontSize: 13, color: "#B6B9C6" }}>always on</span>}
                      <button onClick={() => toggleStage(s.key)} disabled={s.locked || savingStage === s.key} style={{ marginLeft: "auto", position: "relative", height: 22, width: 40, borderRadius: 999, background: s.enabled ? "#7C3AED" : "#D6D8E3", opacity: s.locked ? 0.5 : 1, border: "none", cursor: s.locked ? "default" : "pointer" }}>
                        <span style={{ position: "absolute", top: 3, left: s.enabled ? 21 : 3, height: 16, width: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 14px 2px", borderTop: "1px solid #F1F2F6", marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#16A34A", fontSize: 15 }}>💬</span><span style={{ fontSize: 15, fontWeight: 700 }}>WhatsApp HR alerts</span></div>
                  <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 4 }}>Get a WhatsApp ping when a strong candidate (score ≥ green) applies.</div>
                  {hrAlerts && (
                    <div className="mt-2 flex items-center gap-2">
                      <input value={hrPhone} onChange={(e) => setHrPhone(e.target.value)} placeholder="Your phone e.g. 012-345 6789" className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none" />
                      <button onClick={() => saveHrAlerts()} className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">{hrSaved ? "Saved ✓" : "Save"}</button>
                    </div>
                  )}
                </div>
                <button onClick={() => { const v = !hrAlerts; setHrAlerts(v); saveHrAlerts(v, hrPhone); }} style={{ position: "relative", height: 22, width: 40, borderRadius: 999, background: hrAlerts ? "#16A34A" : "#D6D8E3", border: "none", cursor: "pointer" }}>
                  <span style={{ position: "absolute", top: 3, left: hrAlerts ? 21 : 3, height: 16, width: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* filter pills + compare */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }} className="flex-wrap">
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "all", label: `All ${counts.all}`, on: "#111827", onText: "#fff", bg: "#111827", text: "#fff", border: "transparent" },
            { k: "green", label: `🟢 Green ${counts.green}`, bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
            { k: "amber", label: `🟡 Amber ${counts.amber}`, bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
            { k: "red", label: `🔴 Red ${counts.red}`, bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
          ].map((p) => {
            const active = filter === p.k;
            return (
              <span key={p.k} onClick={() => setFilter(p.k)} style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "7px 13px", borderRadius: 8, color: active && p.k === "all" ? "#fff" : p.text || "#374151", background: active ? (p.k === "all" ? "#111827" : p.bg) : (p.k === "all" ? "#F3F4F8" : p.bg), border: `1px solid ${active ? (p.border || "#111827") : (p.k === "all" ? "transparent" : p.border)}`, opacity: active || p.k !== "all" ? 1 : 0.85 }}>{p.label}</span>
            );
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span onClick={() => { setCompareMode((v) => !v); setSelected([]); }} style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "7px 13px", borderRadius: 8, color: compareMode ? "#fff" : "#4338CA", background: compareMode ? GRAD : "#EEF2FF" }}>{compareMode ? "Cancel compare" : "⇄ Compare"}</span>
          <span style={{ fontSize: 13, color: "#6B7280" }}>Sorted by <b style={{ color: "#374151" }}>Score ↓</b></span>
        </div>
      </div>

      {/* compare bar */}
      {compareMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#F5F3FF", border: "1px solid #E9E5FF", borderRadius: 12, padding: "12px 18px", marginBottom: 14 }} className="flex-wrap">
          <span style={{ fontSize: 14, color: "#4338CA", fontWeight: 700 }}>{selected.length} selected</span>
          <span style={{ fontSize: 13, color: "#6D5D9E" }}>Tick 2 candidates, then compare them side by side.</span>
          <button onClick={() => selected.length === 2 && navigate(`/jobs/${jobId}/compare?ids=${selected.join(",")}`)} disabled={selected.length !== 2} style={{ marginLeft: "auto", padding: "9px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: selected.length === 2 ? "pointer" : "default", opacity: selected.length === 2 ? 1 : 0.5 }}>Compare selected →</button>
        </div>
      )}

      {/* candidate table */}
      {candidates === null ? (
        <div style={{ ...cardBox, height: 240 }} className="animate-pulse" />
      ) : visible.length === 0 ? (
        <div style={{ ...cardBox, padding: 40, textAlign: "center", color: "#9AA0AE" }}>
          {merged.length === 0 ? <>No candidates yet. <span onClick={copyLink} style={{ color: "#6366F1", fontWeight: 600, cursor: "pointer" }}>Copy the application link →</span></> : "No candidates in this lane."}
        </div>
      ) : (
        <div style={{ ...cardBox, overflow: "hidden" }}>
          <div className="hidden md:grid" style={{ gridTemplateColumns: "1fr 150px 130px 140px 36px", gap: 16, padding: "13px 22px", background: "#FAFAFC", borderBottom: "1px solid #ECEDF2", fontSize: 12, fontWeight: 700, color: "#9AA0AE", letterSpacing: ".4px", textTransform: "uppercase" }}>
            <div>Candidate</div><div>AI score</div><div>Lane</div><div>Stage</div><div></div>
          </div>
          {visible.map((c) => {
            const lane = LANE[displayLane(c.score)] || LANE.in_progress;
            const score = round(c.score?.combined_score);
            const sel = selected.includes(c.candidate_id);
            const years = c.profile?.total_experience_months != null ? Math.round(c.profile.total_experience_months / 12) : "—";
            const loc = c.profile?.contact?.location?.split(",")[0] || "—";
            return (
              <div key={c.candidate_id} onClick={() => compareMode ? toggleSel(c.candidate_id) : navigate(`/jobs/${jobId}/candidate/${c.candidate_id}`)}
                className="grid items-center md:!grid-cols-[1fr_150px_130px_140px_36px]" style={{ gridTemplateColumns: "1fr auto", gap: 16, padding: "15px 22px", borderBottom: "1px solid #F1F2F6", cursor: "pointer", background: sel ? "#F5F3FF" : "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
                  {compareMode && <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${sel ? "#7C3AED" : "#D6D8E3"}`, background: sel ? "#7C3AED" : "#fff", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sel ? "✓" : ""}</div>}
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: avatarFor(c.profile?.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initials(c.profile?.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.profile?.name || "Unnamed"}</div>
                    <div style={{ fontSize: 13, color: "#9AA0AE" }}>{years} yrs · {loc}</div>
                  </div>
                </div>
                {/* mobile-only compact score + lane (hidden from md up) */}
                <div className="flex items-center gap-2.5 md:hidden" style={{ flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: lane.color }}>{score}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: lane.color, background: lane.bg, border: `1px solid ${lane.border}`, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: lane.dot }} />{lane.label}
                  </span>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <span style={{ fontSize: 17, fontWeight: 800, color: lane.color }}>{score}</span>
                  <div style={{ flex: 1, height: 6, background: "#F1F2F6", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${score}%`, background: lane.dot, borderRadius: 4 }} /></div>
                </div>
                <div className="hidden md:block">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: lane.color, background: lane.bg, border: `1px solid ${lane.border}`, padding: "4px 10px", borderRadius: 20 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: lane.dot }} />{lane.label}
                  </span>
                </div>
                <div className="hidden text-sm font-medium md:block" style={{ color: "#4B5563" }}>{shortStage(c, job)}</div>
                <div className="hidden text-right md:block" style={{ color: "#C4C7D2", fontSize: 18 }}>›</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

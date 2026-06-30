import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Modal from "../components/Modal.jsx";
import { monthsToDuration, round, candidateStatus, screeningScore, screeningVerdict } from "../lib/format.js";
import { candidateStages } from "../lib/pipeline.js";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 22, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const AVATARS = ["linear-gradient(135deg,#6366F1,#7C3AED)", "linear-gradient(135deg,#0EA5E9,#6366F1)", "linear-gradient(135deg,#059669,#0EA5E9)", "linear-gradient(135deg,#F59E0B,#EF4444)", "linear-gradient(135deg,#EC4899,#7C3AED)"];
const LANE = {
  green: { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", dot: "#059669", label: "Green" },
  amber: { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", dot: "#D97706", label: "Amber" },
  red: { color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA", dot: "#DC2626", label: "Red" },
  in_progress: { color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB", dot: "#9CA3AF", label: "In progress" },
};
const REC = {
  HIRE: { color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", icon: "✓" },
  HOLD: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: "⏸" },
  REJECT: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: "✕" },
};
const CONF_PCT = { High: 88, Medium: 64, Low: 42 };
const LAYER = {
  cv_fit: { label: "CV Fit", accent: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE", bar: "#6366F1" },
  personality_fit: { label: "Personality", accent: "#059669", bg: "#ECFDF5", border: "#A7F3D0", bar: "#059669" },
  interview_result: { label: "Interview", accent: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", bar: "#7C3AED" },
};
const SRC_TAG = { cv: { bg: "#EEF2FF", color: "#4338CA" }, ocean: { bg: "#ECFDF5", color: "#047857" }, interview: { bg: "#F5F3FF", color: "#6D28D9" }, hr_notes: { bg: "#FFF7ED", color: "#C2410C" } };

// Per-trait descriptive phrases: [high, moderate, low]
const OCEAN_DESC = {
  O: ["Curious, embraces new ideas", "Open to some change", "Prefers familiar routines"],
  C: ["Organised and dependable", "Generally reliable", "May need structure & reminders"],
  E: ["Outgoing and energetic", "Balanced and measured", "Reserved, works independently"],
  A: ["Collaborative team player", "Cooperative yet assertive", "Direct and candid"],
  ES: ["Calm under pressure", "Generally composed", "Sensitive to stress"],
};

const initials = (n) => (n || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
function avatarFor(n) { let h = 0; for (const ch of n || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATARS[h % AVATARS.length]; }

export default function CandidateDetail() {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteResult, setNoteResult] = useState(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [invite, setInvite] = useState({ interview_type: "In-person interview", date: "", time: "" });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chat, setChat] = useState(null);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [sfit, setSfit] = useState(null);
  const [oceanSending, setOceanSending] = useState(false);
  const [oceanResult, setOceanResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`/api/candidates/${jobId}/${candidateId}`).then((r) => setCandidate(r.data)).catch(() => setCandidate(false));
    axios.get("/api/jobs").then((r) => setJob(r.data.find((j) => j.job_id === jobId) || null));
    axios.get(`/api/candidates/${jobId}/${candidateId}/success-fit`).then((r) => setSfit(r.data)).catch(() => setSfit({ configured: false }));
  }, [jobId, candidateId]);

  async function loadChat() {
    setShowChat((v) => !v);
    if (chat === null) {
      try { setChat((await axios.get(`/api/candidates/${jobId}/${candidateId}/whatsapp-history`)).data); }
      catch { setChat({ configured: false, thread: [] }); }
    }
  }
  async function sendInvite() {
    setInviteSending(true); setInviteResult(null);
    try { setInviteResult((await axios.post(`/api/candidates/${jobId}/${candidateId}/send-interview-invite`, invite)).data); }
    catch (e) { setInviteResult({ error: e.response?.data?.error || "Failed to send invite." }); }
    finally { setInviteSending(false); }
  }
  async function setOutcome(outcome) {
    const verb = outcome === "offer" ? "send an OFFER message to" : "send a REJECTION message to";
    if (!window.confirm(`This will ${verb} the candidate via WhatsApp and mark them as ${outcome}. Continue?`)) return;
    setOutcomeSaving(true);
    try { setCandidate((await axios.post(`/api/candidates/${jobId}/${candidateId}/outcome`, { outcome })).data.candidate); }
    catch { /* ignore */ } finally { setOutcomeSaving(false); }
  }
  async function sendOceanTest() {
    setOceanSending(true); setOceanResult(null);
    try {
      const res = await axios.post(`/api/candidates/${jobId}/${candidateId}/send-ocean-test`, { base_url: window.location.origin });
      setOceanResult(res.data); setChat(null);
    } catch (e) { setOceanResult({ error: e.response?.data?.error || "Failed to send the assessment link." }); }
    finally { setOceanSending(false); }
  }
  function copyOceanLink(url) {
    const link = url || `${window.location.origin}/assessment/${candidateId}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }
  async function regenerate() {
    setRegenLoading(true);
    try { setCandidate((await axios.post(`/api/candidates/${jobId}/${candidateId}/regenerate-recommendation`)).data); }
    catch { /* ignore */ } finally { setRegenLoading(false); }
  }
  async function saveNote() {
    if (!note.trim()) return;
    setNoteSaving(true); setNoteResult(null);
    try {
      const res = await axios.post(`/api/candidates/${jobId}/${candidateId}/hr-notes`, { notes: note.trim() });
      setCandidate(res.data.candidate); setNoteResult({ saved: true, date: res.data.date }); setNote("");
    } catch { /* ignore */ } finally { setNoteSaving(false); }
  }
  async function exportPdf() {
    try {
      const res = await axios.get(`/api/candidates/${jobId}/${candidateId}/export/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url;
      a.download = `${(candidate.profile?.name || "Candidate").replace(/[^a-z0-9]+/gi, "_")}_Report.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { alert("Couldn't generate the PDF."); }
  }
  async function del() {
    if (!window.confirm("Delete this candidate and their scores? This can't be undone.")) return;
    try { await axios.delete(`/api/candidates/${jobId}/${candidateId}`); } catch { /* ignore */ }
    navigate(`/jobs/${jobId}/dashboard`);
  }

  if (candidate === false) return <div className="text-gray-500">Candidate not found.</div>;
  if (!candidate || !job) return <div style={{ ...cardBox, height: 300 }} className="animate-pulse" />;

  const p = candidate.profile || {};
  const s = candidate.score || {};
  const criteria = s.criteria_scores || [];
  const pending = s.pending_sources || [];
  const status = candidateStatus(s);
  const lane = LANE[(status === "complete" ? s.lane : "in_progress")] || LANE.in_progress;
  const rec = candidate.recommendation;
  const bd = candidate.score_breakdown;
  const traits = candidate.ocean_traits;
  const combined = round(s.combined_score);
  const interviewPending = pending.includes("interview");
  const oceanPending = pending.includes("ocean") && !traits;
  const oceanLink = `${window.location.origin}/assessment/${candidateId}`;
  const screenV = status === "screening" ? screeningVerdict(screeningScore(s)) : null;
  const { stages } = candidateStages(candidate, job);

  const haveSkills = (p.skills || []).map((x) => x.toLowerCase());
  const missingSkills = (job.requirements?.required_skills || []).filter((r) => !haveSkills.some((h) => h.includes(r.toLowerCase()) || r.toLowerCase().includes(h)));
  const years = p.total_experience_months != null ? Math.round(p.total_experience_months / 12) : "—";

  return (
    <div className="pb-8">
      <div onClick={() => navigate(`/jobs/${jobId}/dashboard`)} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to candidates</div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 22 }} className="flex-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, background: avatarFor(p.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 19 }}>{initials(p.name)}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }} className="flex-wrap">
              <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", margin: 0 }}>{p.name || "Unnamed"}</h1>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: lane.color, background: lane.bg, border: `1px solid ${lane.border}`, padding: "4px 10px", borderRadius: 20 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: lane.dot }} />{lane.label} lane
              </span>
            </div>
            <div style={{ fontSize: 14, color: "#6B7280", marginTop: 5 }}>
              Submitted {candidate.submitted_date} · <span style={{ fontWeight: 600, color: "#4B5563", textTransform: "capitalize" }}>{candidate.source}</span>{p.age != null ? ` · Age ${p.age}` : ""} · {job.role_title} · {years} yrs{p.contact?.location ? ` · ${p.contact.location.split(",")[0]}` : ""}
            </div>
            {p.languages?.length > 0 && <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 4 }}>🗣 {p.languages.join(", ")}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }} className="flex-wrap">
          {status !== "complete" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", background: "#F3F4F8", padding: "4px 11px", borderRadius: 20 }}>{status === "screening" ? "Screening" : "In progress"}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{combined}</span><span style={{ fontSize: 12, color: "#9AA0AE" }}>so far</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setInviteResult(null); setInviteModal(true); }} style={{ padding: "11px 16px", background: "#fff", color: "#374151", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>🧭 Send invite</button>
            <button onClick={exportPdf} style={{ padding: "11px 16px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>⤓ Export PDF</button>
          </div>
        </div>
      </div>

      {/* Pipeline stepper */}
      <div style={{ ...cardBox, padding: "20px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {stages.map((st, i) => {
            const done = st.status === "done", cur = st.status === "current";
            return (
              <div key={st.key} style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: done ? "#6366F1" : cur ? "#EEF2FF" : "#F3F4F8", border: `2px solid ${done || cur ? "#6366F1" : "#E2E4EC"}`, color: done ? "#fff" : cur ? "#6366F1" : "#9AA0AE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{done ? "✓" : st.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: done || cur ? "#374151" : "#9AA0AE" }}>{st.label}</div>
                </div>
                {i < stages.length - 1 && <div style={{ flex: 1, height: 2, background: done ? "#6366F1" : "#ECEDF2", margin: "15px 8px 0" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_320px]">
        {/* MAIN */}
        <div className="flex flex-col gap-4">
          {/* Recommendation */}
          {rec && (() => {
            const r = REC[rec.recommendation] || REC.HOLD;
            return (
              <div style={{ background: r.bg, border: `1.5px solid ${r.border}`, borderRadius: 18, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }} className="flex-wrap gap-3">
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: r.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{r.icon}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: r.color, opacity: 0.85 }}>
                        AI recommendation
                        <span onClick={regenerate} title="Regenerate" style={{ cursor: "pointer", opacity: regenLoading ? 0.5 : 0.7 }}>↻</span>
                      </div>
                      <div className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.6px", color: r.color }}>{rec.recommendation}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>Confidence</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{rec.confidence}</div>
                    <div style={{ fontSize: 12, color: "#9AA0AE" }}>{CONF_PCT[rec.confidence] ?? 60}% certainty</div>
                  </div>
                </div>
                {(rec.reasons || []).length > 0 && (
                  <div style={{ background: "rgba(255,255,255,.7)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>Key reasons</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {rec.reasons.map((rr, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "#374151" }}><span style={{ color: r.color, fontWeight: 700, flexShrink: 0 }}>›</span>{rr}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(rec.concerns || []).length > 0 && (
                    <div style={{ background: "rgba(255,255,255,.7)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#B45309", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>⚠ Top concern</div>
                      <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.5 }}>{rec.concerns[0]}</div>
                    </div>
                  )}
                  <div style={{ background: "rgba(255,255,255,.7)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#4338CA", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>→ Next action</div>
                    <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.5 }}>{rec.next_action}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* OCEAN test pending — send the candidate the questionnaire */}
          {oceanPending && (
            <div style={{ background: "#F7F3FF", border: "1px solid #DDD6FE", borderRadius: 16, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }} className="flex-wrap">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff", border: "1px solid #E0D2FA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🧠</div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#5B21B6" }}>Personality assessment not completed</div>
                  <div style={{ fontSize: 13.5, color: "#7C4DDB", lineHeight: 1.55, marginTop: 4 }}>Send {p.name?.split(" ")[0] || "this candidate"} a private link to complete the short OCEAN questionnaire. Their results attach automatically and unlock the personality score.</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }} className="flex-wrap">
                    <input readOnly value={oceanResult?.url || oceanLink} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 200, fontSize: 13, color: "#4B5563", background: "#fff", border: "1px solid #E0D2FA", borderRadius: 9, padding: "10px 12px", outline: "none" }} />
                    <button onClick={() => copyOceanLink(oceanResult?.url)} style={{ padding: "10px 14px", background: "#fff", color: "#6D28D9", border: "1px solid #DDD6FE", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "✓ Copied" : "Copy link"}</button>
                    <button onClick={sendOceanTest} disabled={oceanSending} style={{ padding: "10px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", opacity: oceanSending ? 0.6 : 1 }}>{oceanSending ? "Sending…" : "Send via WhatsApp"}</button>
                  </div>

                  {oceanResult?.ok && (
                    <div style={{ fontSize: 13, color: oceanResult.skipped ? "#B45309" : "#047857", marginTop: 11 }}>
                      {oceanResult.skipped
                        ? (oceanResult.reason === "no_phone" ? "No phone on file — share the copied link with the candidate directly." : "WhatsApp isn't configured — share the copied link with the candidate directly.")
                        : "Link sent via WhatsApp ✓ The candidate can complete it on their phone."}
                    </div>
                  )}
                  {oceanResult?.error && <div style={{ fontSize: 13, color: "#DC2626", marginTop: 11 }}>{oceanResult.error}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Score breakdown */}
          <div style={cardBox}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Score breakdown</div>
            <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 18 }}>Three weighted layers — OCEAN and interview unlock as the candidate progresses</div>
            <div className="grid grid-cols-3 gap-3">
              {["cv_fit", "personality_fit", "interview_result"].map((k) => {
                const L = LAYER[k]; const layer = bd?.[k] || {};
                const disabled = layer.status === "disabled";
                const sc = layer.score;
                return (
                  <div key={k} style={{ border: `1px solid ${disabled ? "#E5E7EB" : L.border}`, background: disabled ? "#F9FAFB" : L.bg, borderRadius: 13, padding: 16, opacity: disabled ? 0.6 : 1 }}>
                    <div style={{ fontSize: 13, color: "#44485A", fontWeight: 700, marginBottom: 8 }}>{L.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", color: disabled ? "#9CA3AF" : L.accent }}>{sc != null ? `${sc}%` : "—"}</div>
                    <div style={{ fontSize: 12, color: "#8A8FA0", marginTop: 4 }}>{Math.round((layer.weight_in_total || 0) * 100)}% of final score</div>
                    {layer.status === "pending" && <div style={{ fontSize: 12, fontWeight: 700, color: "#B45309", marginTop: 9 }}>Pending</div>}
                    {disabled && <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginTop: 9 }}>Not applicable</div>}
                    {sc != null && !disabled && <div style={{ height: 6, background: "rgba(255,255,255,.75)", borderRadius: 4, overflow: "hidden", marginTop: 10 }}><div style={{ height: "100%", width: `${sc}%`, background: L.bar, borderRadius: 4 }} /></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Success Profile fit */}
          {sfit?.configured && (() => {
            const fl = LANE[sfit.lane] || LANE.in_progress;
            const Row = ({ ok, text, neutral }) => (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "#374151", lineHeight: 1.45, padding: "5px 0" }}>
                <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, marginTop: 1, color: ok ? "#047857" : neutral ? "#6B7280" : "#B91C1C", background: ok ? "#ECFDF5" : neutral ? "#F3F4F6" : "#FEF2F2" }}>{ok ? "✓" : neutral ? "•" : "✕"}</span>
                <span>{text}</span>
              </div>
            );
            return (
              <div style={cardBox}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 6 }} className="flex-wrap">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}>◎ Success Profile fit</div>
                    <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 3 }}>How well this candidate matches the ideal hire defined for the role</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: fl.color, background: fl.bg, border: `1px solid ${fl.border}`, padding: "5px 12px", borderRadius: 20 }}>{sfit.verdict}</span>
                    <div style={{ textAlign: "right" }}>
                      <div className="font-display" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1, color: fl.color }}>{sfit.fit}<span style={{ fontSize: 16, color: "#9AA0AE", fontWeight: 700 }}>%</span></div>
                    </div>
                  </div>
                </div>
                <div style={{ height: 8, background: "#F1F2F6", borderRadius: 5, overflow: "hidden", margin: "10px 0 18px" }}><div style={{ height: "100%", width: `${sfit.fit}%`, background: fl.dot, borderRadius: 5 }} /></div>

                {sfit.dealbreakers.some((d) => d.triggered) && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 11, padding: "12px 15px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>⛔ Dealbreaker triggered</div>
                    {sfit.dealbreakers.filter((d) => d.triggered).map((d, i) => <div key={i} style={{ fontSize: 13, color: "#7F1D1D", lineHeight: 1.45 }}>{d.text}</div>)}
                  </div>
                )}

                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {sfit.must_haves.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Must-haves · {sfit.must_haves.filter((m) => m.met).length}/{sfit.must_haves.length}</div>
                      {sfit.must_haves.map((m, i) => <Row key={i} ok={m.met} text={m.text} />)}
                    </div>
                  )}
                  {sfit.nice_to_haves.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Nice-to-haves · {sfit.nice_to_haves.filter((m) => m.met).length}/{sfit.nice_to_haves.length}</div>
                      {sfit.nice_to_haves.map((m, i) => <Row key={i} ok={m.met} neutral={!m.met} text={m.text} />)}
                    </div>
                  )}
                  {sfit.benchmarks.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Benchmarks</div>
                      {sfit.benchmarks.map((b, i) => <Row key={i} ok={b.met} text={`${b.label}: ${b.actual} vs target ${b.target}`} />)}
                    </div>
                  )}
                  {sfit.has_ocean && sfit.ocean?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Personality alignment · {sfit.ocean.filter((o) => o.match).length}/{sfit.ocean.length}</div>
                      {sfit.ocean.map((o, i) => <Row key={i} ok={o.match} text={`${o.trait}: ${o.actual} (ideal ${o.ideal})`} />)}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Criteria breakdown */}
          <div style={cardBox}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><div style={{ fontSize: 15, fontWeight: 700 }}>Criteria breakdown</div><div style={{ fontSize: 12, color: "#9AA0AE", fontWeight: 600 }}>score · weight</div></div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {criteria.map((m) => {
                const tag = SRC_TAG[m.source] || SRC_TAG.cv;
                const na = m.not_applicable;
                const dot = m.score > 70 ? "#059669" : m.score >= 40 ? "#D97706" : "#DC2626";
                return (
                  <div key={m.criterion_id} style={{ display: "grid", gridTemplateColumns: "56px 1fr 70px 40px", gap: 12, alignItems: "center", padding: "8px 0", opacity: na ? 0.45 : 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".4px", textAlign: "center", color: tag.color, background: tag.bg, padding: "4px 0", borderRadius: 6, textTransform: "uppercase" }}>{m.source === "hr_notes" ? "HR" : m.source}</span>
                    <span style={{ fontSize: 13, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.criterion_name}</span>
                    {m.scored && !na ? (
                      <div style={{ height: 9, background: "#F1F2F6", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${round(m.score)}%`, background: dot, borderRadius: 5 }} /></div>
                    ) : (
                      <div style={{ height: 9, borderRadius: 5, background: "repeating-linear-gradient(45deg,#E6E8EE,#E6E8EE 5px,#F4F5F8 5px,#F4F5F8 10px)" }} />
                    )}
                    <span style={{ fontSize: 12, color: "#B6B9C6", textAlign: "right" }}>{na ? "—" : `${Math.round(m.weight * 100)}%`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {s.summary && <div style={{ background: "#F7F8FB", border: "1px solid #EEF0F4", borderRadius: 16, padding: "20px 22px" }}><div style={{ fontSize: 14.5, color: "#44485A", lineHeight: 1.65 }}>{s.summary}</div></div>}

          {/* Screening banner */}
          {status === "screening" && screenV && (
            <div style={{ ...cardBox, borderColor: LANE[screenV.lane].border, background: LANE[screenV.lane].bg }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }} className="flex-wrap">
                <div style={{ fontSize: 14, fontWeight: 700, color: LANE[screenV.lane].color }}>Screening result: {screenV.label}</div>
                <button onClick={() => navigate(`/jobs/${jobId}/candidate/${candidateId}/interview`)} style={{ padding: "9px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Conduct interview →</button>
              </div>
            </div>
          )}

          {/* Areas to probe */}
          {(s.gaps || []).length > 0 && (
            <div style={cardBox}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Areas to probe in interview</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {s.gaps.map((g, i) => <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 14, color: "#374151", lineHeight: 1.5 }}><span style={{ color: "#7C3AED", fontWeight: 700, flexShrink: 0 }}>→</span>{g}</div>)}
              </div>
            </div>
          )}

          {/* Work history */}
          <div style={cardBox}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Work history</div>
            <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 20 }}>Extracted from the uploaded CV</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(p.work_history || []).map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "#6366F1", marginTop: 4 }} /><span style={{ flex: 1, width: 2, background: "#ECEDF2", marginTop: 4 }} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}><div style={{ fontSize: 15, fontWeight: 700 }}>{h.title}</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "3px 0 6px" }} className="flex-wrap"><span style={{ fontSize: 13, color: "#6366F1", fontWeight: 600 }}>{h.employer}</span>{h.industry && <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F3F4F8", padding: "2px 8px", borderRadius: 6 }}>{h.industry}</span>}<span style={{ fontSize: 12, color: "#9AA0AE" }}>{monthsToDuration(h.duration_months)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Required skills (missing) */}
          <div style={cardBox}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Required skills</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
              {missingSkills.length === 0 ? <span style={{ fontSize: 13, color: "#047857" }}>✓ All required skills evidenced in the CV.</span> :
                missingSkills.map((sk) => <span key={sk} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", padding: "7px 13px", borderRadius: 9 }}><span style={{ fontSize: 11 }}>✕</span>{sk}</span>)}
            </div>
            {missingSkills.length > 0 && <div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 12 }}>Required by the role but not yet evidenced — confirm during screening or interview.</div>}
          </div>

          {/* HR notes */}
          <div style={cardBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontSize: 16 }}>💬</span><span style={{ fontSize: 15, fontWeight: 700 }}>HR notes</span></div>
            <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 14 }}>Saved and used in the final AI analysis once all three scoring stages are complete.</div>
            {(candidate.hr_notes_list || []).map((n, i) => <div key={i} style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "8px 12px", marginBottom: 8, fontSize: 13, color: "#374151" }}><span style={{ color: "#9AA0AE" }}>{n.date} · </span>{n.text}</div>)}
            {noteResult?.saved && <div style={{ background: "#ECFDF5", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 13, color: "#047857" }}>Saved {noteResult.date}.</div>}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context — interview impressions, attitude, red flags, anything the AI missed…" style={{ width: "100%", minHeight: 96, padding: "13px 15px", border: "1px solid #E2E4EC", borderRadius: 11, fontSize: 14, color: "#374151", lineHeight: 1.6, resize: "vertical", outline: "none" }} />
            <button onClick={saveNote} disabled={noteSaving || !note.trim()} style={{ marginTop: 12, padding: "9px 16px", background: "#fff", color: "#6B7280", border: "1px solid #E2E4EC", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: noteSaving || !note.trim() ? 0.5 : 1 }}>{noteSaving ? "Saving…" : "Save note"}</button>
          </div>

          {/* WhatsApp conversation */}
          <div style={{ ...cardBox, padding: showChat ? 22 : "18px 22px" }}>
            <div onClick={loadChat} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💬</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>WhatsApp conversation</div><div style={{ fontSize: 12, color: "#9AA0AE" }}>{chat ? `${chat.thread.length} message${chat.thread.length === 1 ? "" : "s"}` : "View thread"}</div></div>
              <span style={{ color: "#C4C7D2", fontSize: 14 }}>{showChat ? "▴" : "▾"}</span>
            </div>
            {showChat && chat && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {chat.thread.length === 0 ? <div style={{ fontSize: 13, color: "#9AA0AE" }}>No messages yet.{!chat.configured && " (WhatsApp not configured.)"}</div> :
                  chat.thread.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.direction === "outbound" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "80%", whiteSpace: "pre-wrap", borderRadius: 10, padding: "8px 12px", fontSize: 13, background: m.direction === "outbound" ? "#DCFCE7" : "#F3F4F8", color: "#374151" }}>{m.body}<div style={{ fontSize: 10, color: "#9AA0AE", marginTop: 2 }}>{new Date(m.at).toLocaleString()}</div></div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* outcome banner */}
          {candidate.outcome && (
            <div style={{ borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, background: candidate.outcome === "offer" ? "#ECFDF5" : "#FEF2F2", color: candidate.outcome === "offer" ? "#047857" : "#B91C1C" }}>
              Marked as {candidate.outcome === "offer" ? "OFFER" : "REJECTED"}{candidate.outcome_date ? ` on ${candidate.outcome_date}` : ""} — candidate notified via WhatsApp.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            {interviewPending && <button onClick={() => navigate(`/jobs/${jobId}/candidate/${candidateId}/interview`)} style={{ padding: "12px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>🗓 Conduct interview scoring →</button>}
            <button onClick={() => { setInviteResult(null); setInviteModal(true); }} style={{ padding: "12px 18px", background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>✉ Send interview invite</button>
            {status === "complete" && !candidate.outcome && (
              <>
                <button onClick={() => setOutcome("offer")} disabled={outcomeSaving} style={{ padding: "12px 18px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Mark offer</button>
                <button onClick={() => setOutcome("rejected")} disabled={outcomeSaving} style={{ padding: "12px 18px", background: "#fff", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Mark rejected</button>
              </>
            )}
            <button onClick={del} style={{ marginLeft: "auto", padding: "12px 18px", background: "#fff", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>🗑 Delete</button>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4" style={{ position: "sticky", top: 16 }}>
          <div style={{ ...cardBox, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 600, marginBottom: 14 }}>{status === "complete" ? "Overall fit score" : "Score so far"}</div>
            <div className="font-display" style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-2px", lineHeight: 1, color: lane.color }}>{combined}</div>
            <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 6 }}>out of 100</div>
            <div style={{ height: 8, background: "#F1F2F6", borderRadius: 5, overflow: "hidden", marginTop: 16 }}><div style={{ height: "100%", width: `${combined}%`, background: lane.dot, borderRadius: 5 }} /></div>
          </div>

          {traits && (
            <div style={cardBox}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Personality · OCEAN</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {[
                  ["Openness", traits.openness, OCEAN_DESC.O],
                  ["Conscientiousness", traits.conscientiousness, OCEAN_DESC.C],
                  ["Extraversion", traits.extraversion, OCEAN_DESC.E],
                  ["Agreeableness", traits.agreeableness, OCEAN_DESC.A],
                  ["Emotional stability", traits.emotional_stability ?? 100 - (traits.neuroticism ?? 0), OCEAN_DESC.ES],
                ].map(([label, v, descs]) => (
                  <div key={label}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span><span style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>{v}</span></div>
                    <div style={{ height: 7, background: "#F1F2F6", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${v}%`, background: "linear-gradient(90deg,#A78BFA,#7C3AED)", borderRadius: 5 }} /></div>
                    <div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 4 }}>{v >= 60 ? descs[0] : v >= 40 ? descs[1] : descs[2]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bd && (
            <div style={cardBox}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#047857", marginBottom: 10 }}>✓ Strengths</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>{(bd.strengths || []).map((x, i) => <div key={i} style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.45 }}>• {x}</div>)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#B45309", marginBottom: 10 }}>⚠ Risks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>{(bd.risks || []).length ? bd.risks.map((x, i) => <div key={i} style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.45 }}>• {x}</div>) : <div style={{ fontSize: 13, color: "#9AA0AE" }}>None flagged.</div>}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 10 }}>? Missing evidence</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{(bd.missing_evidence || []).length ? bd.missing_evidence.map((x, i) => <div key={i} style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.45 }}>• {x}</div>) : <div style={{ fontSize: 13, color: "#9AA0AE" }}>Nothing outstanding.</div>}</div>
            </div>
          )}
        </div>
      </div>

      {/* Invite modal */}
      {inviteModal && (
        <Modal title="Send interview invite via WhatsApp" onClose={() => setInviteModal(false)}>
          {inviteResult?.ok ? (
            <div className="text-sm">
              <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">{inviteResult.skipped ? "WhatsApp isn't configured — logged but not sent." : "Invite sent! ✅ The candidate can reply YES to confirm."}</div>
              <button onClick={() => { setInviteModal(false); setChat(null); }} className="mt-4 w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white">Done</button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Interview type</span>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={invite.interview_type} onChange={(e) => setInvite({ ...invite, interview_type: e.target.value })}>
                  <option>In-person interview</option><option>Phone interview</option><option>Video interview</option><option>Walk-in interview</option>
                </select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Date</span><input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={invite.date} onChange={(e) => setInvite({ ...invite, date: e.target.value })} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Time</span><input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={invite.time} onChange={(e) => setInvite({ ...invite, time: e.target.value })} /></label>
              </div>
              {inviteResult?.error && <p className="text-sm text-red-600">{inviteResult.error}</p>}
              <button onClick={sendInvite} disabled={inviteSending || !invite.date || !invite.time} className="w-full rounded-md py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "#16A34A" }}>{inviteSending ? "Sending…" : "Send invite"}</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

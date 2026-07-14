import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { round } from "../lib/format.js";
import { candidateStages } from "../lib/pipeline.js";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const AVATARS = ["linear-gradient(135deg,#6366F1,#7C3AED)", "linear-gradient(135deg,#0EA5E9,#6366F1)", "linear-gradient(135deg,#059669,#0EA5E9)", "linear-gradient(135deg,#F59E0B,#EF4444)", "linear-gradient(135deg,#EC4899,#7C3AED)"];
const initials = (n) => (n || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
function avatarFor(n) { let h = 0; for (const c of n || "") h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATARS[h % AVATARS.length]; }
const overallMeta = (v) => (v >= 70 ? { tag: "Hire signal", color: "#16A34A" } : v >= 50 ? { tag: "Lean yes", color: "#D97706" } : { tag: "Below bar", color: "#DC2626" });
const ratingMeta = (v) => (v >= 70 ? { tag: "Strong", color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", badge: "#16A34A" } : v >= 40 ? { tag: "Adequate", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", badge: "#D97706" } : { tag: "Weak", color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA", badge: "#DC2626" });

export default function InterviewScoring() {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  const [mode, setMode] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [ratings, setRatings] = useState({});
  const [notes, setNotes] = useState({});
  const [manualQ, setManualQ] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [questionCount, setQuestionCount] = useState(5);

  useEffect(() => {
    axios.get(`/api/candidates/${jobId}/${candidateId}`).then((r) => setCandidate(r.data)).catch(() => setCandidate(false));
    axios.get("/api/jobs").then((r) => setJob(r.data.find((j) => j.job_id === jobId) || null)).catch(() => setJob(null));
  }, [jobId, candidateId]);

  const interviewDefs = (job?.criteria || []).filter((c) => c.source === "interview");
  const seedRatings = (list) => { const init = {}; list.forEach((c) => (init[c.id] = 70)); setRatings(init); };

  async function chooseAi() {
    setMode("ai"); setLoadingAi(true); setError(null);
    try { const r = await axios.get(`/api/candidates/${jobId}/${candidateId}/interview-prep?count=${questionCount}`); setCriteria(r.data.criteria); seedRatings(r.data.criteria); }
    catch { setError("Couldn't generate AI questions. Switch to Manual instead."); setCriteria([]); }
    finally { setLoadingAi(false); }
  }
  function chooseManual() {
    setMode("manual"); setError(null);
    const list = interviewDefs.map((c) => ({ id: c.id, name: c.name, description: c.description }));
    setCriteria(list); seedRatings(list);
  }
  function resetMode() { setMode(null); setCriteria(null); setRatings({}); setNotes({}); setManualQ({}); setError(null); }
  async function submit() {
    setSaving(true); setError(null);
    try {
      const payload = criteria.map((c) => ({ criterion_id: c.id, score: ratings[c.id] ?? 70, notes: notes[c.id] || null, source: mode, questions: mode === "manual" ? (manualQ[c.id] || "").split("\n").map((q) => q.trim()).filter(Boolean) : c.questions || [] }));
      await axios.post(`/api/candidates/${jobId}/${candidateId}/interview-scores`, { ratings: payload });
      navigate(`/jobs/${jobId}/candidate/${candidateId}`);
    } catch (e) { setError(e.response?.data?.error || "Failed to save scores."); setSaving(false); }
  }

  if (candidate === false) return <div className="text-gray-500">Candidate not found.</div>;
  if (!candidate || !job) return <div style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, height: 280 }} className="animate-pulse" />;
  if (interviewDefs.length === 0) return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div onClick={() => navigate(`/jobs/${jobId}/candidate/${candidateId}`)} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>← Back to candidate</div>
      <div style={{ textAlign: "center", color: "#9AA0AE", marginTop: 40 }}>No interview criteria defined for this role.</div>
    </div>
  );

  const name = candidate.profile?.name;
  const { currentKey } = candidateStages(candidate, job);
  const stageLabel = { cv_submission: "CV", ocean_assessment: "OCEAN", interview: "Interview", offer: "Offer" }[currentKey] || "—";
  const interviewWeight = Math.round(interviewDefs.reduce((a, c) => a + (c.weight || 0), 0) * 100);

  const back = (
    <div onClick={() => navigate(`/jobs/${jobId}/candidate/${candidateId}`)} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to candidate</div>
  );

  // ---- MODE SELECT ----
  if (mode === null) {
    return (
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        {back}
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 8 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#F5F3FF", color: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📋</div>
          <div>
            <h1 className="font-display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", margin: 0 }}>Interview Scoring</h1>
            <div style={{ fontSize: 14, color: "#9AA0AE", marginTop: 2 }}>Choose how to run this interview — you give the final score for each criterion.</div>
          </div>
        </div>

        {/* candidate strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #ECEDF2", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "20px 0 24px" }} className="flex-wrap">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: avatarFor(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{initials(name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 13, color: "#9AA0AE" }}>{job.role_title} · {stageLabel} stage · {round(candidate.score?.combined_score)} so far</div>
          </div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#9AA0AE", fontWeight: 600 }}>Interview weight</div><div style={{ fontSize: 18, fontWeight: 800, color: "#7C3AED" }}>{interviewWeight}%</div></div>
          <div style={{ width: 1, height: 38, background: "#EEF0F4" }} />
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#9AA0AE", fontWeight: 600 }}>Criteria</div><div style={{ fontSize: 18, fontWeight: 800 }}>{interviewDefs.length}</div></div>
        </div>

        {/* mode cards */}
        <div className="grid gap-[18px] md:grid-cols-2" style={{ marginBottom: 24 }}>
          <div style={{ position: "relative", background: "linear-gradient(180deg,#FBFAFF,#fff)", border: "1.5px solid #E7DEFB", borderRadius: 18, padding: 26, display: "flex", flexDirection: "column" }} className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <span style={{ position: "absolute", top: 18, right: 18, fontSize: 11, fontWeight: 700, color: "#6D28D9", background: "#F3EEFE", border: "1px solid #E0D2FA", padding: "4px 10px", borderRadius: 20 }}>★ Recommended</span>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18, boxShadow: "0 6px 16px rgba(124,58,237,.3)" }}>✨</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.2px", marginBottom: 8 }}>AI-generated questions</div>
            <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.55, marginBottom: 18 }}>AI writes tailored questions and a scoring rubric for each criterion, based on this role and the candidate's CV. You rate each one.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
              {["Tailored to the candidate's CV & gaps", "Scoring rubric for consistent rating", "Probes the areas flagged on the CV"].map((t) => <div key={t} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "#44485A" }}><span style={{ color: "#7C3AED" }}>✓</span> {t}</div>)}
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>How many questions?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[3, 5, 10].map((n) => (
                  <button key={n} type="button" onClick={(e) => { e.stopPropagation(); setQuestionCount(n); }}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${questionCount === n ? "#7C3AED" : "#E2E4EC"}`, background: questionCount === n ? "#7C3AED" : "#fff", color: questionCount === n ? "#fff" : "#374151" }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
              <span style={{ fontSize: 13, color: "#9AA0AE" }}>🕑 ~30 sec to generate</span>
              <button type="button" onClick={chooseAi} style={{ fontSize: 14, fontWeight: 700, color: "#fff", background: GRAD, padding: "10px 18px", borderRadius: 10, boxShadow: "0 6px 16px rgba(99,102,241,.28)", border: "none", cursor: "pointer" }}>Generate &amp; start →</button>
            </div>
          </div>

          <div onClick={chooseManual} style={{ background: "#fff", border: "1.5px solid #ECEDF2", borderRadius: 18, padding: 26, cursor: "pointer", display: "flex", flexDirection: "column" }} className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div style={{ width: 46, height: 46, borderRadius: 13, background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>✎</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.2px", marginBottom: 8 }}>Write my own questions</div>
            <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.55, marginBottom: 18 }}>Type your own questions for each criterion and score the candidate on them. Best if you already have a question set.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
              {["Full control over every question", "Reuse your team's standard set", "Score each criterion as you go"].map((t) => <div key={t} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "#44485A" }}><span style={{ color: "#4F46E5" }}>✓</span> {t}</div>)}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
              <span style={{ fontSize: 13, color: "#9AA0AE" }}>✍ Blank scoring sheet</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF", padding: "10px 18px", borderRadius: 10 }}>Start writing →</span>
            </div>
          </div>
        </div>

        {/* what you'll score */}
        <div style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 22, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>What you'll score</div>
            <div style={{ fontSize: 12.5, color: "#9AA0AE", fontWeight: 600 }}>From the role's criteria</div>
          </div>
          <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 18 }}>Both methods score the same {interviewDefs.length} interview criteria — only the questions differ.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {interviewDefs.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "#FAFAFC", borderRadius: 12, padding: "14px 16px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".4px", color: "#7C3AED", background: "#F5F3FF", padding: "5px 9px", borderRadius: 6, flexShrink: 0 }}>INTERVIEW</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.name}</div>{c.description && <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 2 }}>{c.description}</div>}</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#4F46E5" }}>{Math.round(c.weight * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadingAi) return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {back}
      <div style={{ textAlign: "center", color: "#9AA0AE", marginTop: 60 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #EEF2FF", borderTopColor: "#6366F1", margin: "0 auto 16px" }} className="animate-spin" />
        Generating tailored questions for {job.role_title}…
      </div>
    </div>
  );

  // ---- CONDUCT ----
  const list = criteria || [];
  const overall = list.length ? Math.round(list.reduce((a, c) => a + (ratings[c.id] ?? 70), 0) / list.length) : 0;
  const om = overallMeta(overall);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="pb-4">
      {back}
      {/* dark header */}
      <div style={{ background: "linear-gradient(135deg,#1E1B3A,#3B2E6E)", borderRadius: 18, padding: "22px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 22, boxShadow: "0 10px 30px rgba(60,46,110,.25)" }} className="flex-wrap">
        <div style={{ width: 78, height: 78, borderRadius: "50%", background: `conic-gradient(${om.color} ${overall}%, rgba(255,255,255,.16) 0)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#221E40", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{overall}</span><span style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}>/ 100</span></div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}><span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: om.color, padding: "3px 11px", borderRadius: 20 }}>{om.tag}</span><span style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>Live interview score</span></div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-.3px" }}>Interview Scoring</div>
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{name} · {job.role_title} · averages your {list.length} ratings</div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "9px 13px" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>{mode === "ai" ? "AI questions" : "Manual"}</span>
          <span onClick={resetMode} style={{ fontSize: 13, fontWeight: 700, color: "#C4B5FD", cursor: "pointer", whiteSpace: "nowrap" }}>Change</span>
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 14, color: "#B91C1C" }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {list.map((c, i) => {
          const rating = ratings[c.id] ?? 70;
          const rm = ratingMeta(rating);
          return (
            <div key={c.id} style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "#B6B9C6", textTransform: "uppercase", marginBottom: 6 }}>Criterion {i + 1} of {list.length}</div>
                  <div style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: "-.2px" }}>{c.name}</div>
                  {c.description && <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 3 }}>{c.description}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <div style={{ minWidth: 52, height: 34, padding: "0 13px", borderRadius: 9, background: rm.badge, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>{rating}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: rm.color, background: rm.bg, border: `1px solid ${rm.border}`, padding: "2px 9px", borderRadius: 20 }}>{rm.tag}</span>
                </div>
              </div>

              {mode === "manual" ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Your questions <span style={{ color: "#9AA0AE", fontWeight: 500 }}>(one per line)</span></div>
                  <textarea value={manualQ[c.id] || ""} onChange={(e) => setManualQ((q) => ({ ...q, [c.id]: e.target.value }))} placeholder={"e.g. Tell me about a time you handled a difficult customer.\nWhat would you do if two staff called in sick during a rush?"} style={{ width: "100%", minHeight: 84, padding: "13px 15px", border: "1px solid #E2E4EC", borderRadius: 11, fontSize: 14, color: "#374151", lineHeight: 1.6, resize: "vertical", background: "#FBFBFD", outline: "none" }} />
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#6D28D9", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>✨ Suggested questions</div>
                  <div style={{ background: "#FBFAFF", border: "1px solid #ECE7FB", borderRadius: 11, padding: "14px 16px", fontSize: 14, color: "#44405A", lineHeight: 1.7, whiteSpace: "pre-line" }}>{(c.questions || []).join("\n")}</div>
                  {c.rubric && <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "10px 12px", background: "#FCFBFE", borderRadius: 9, fontSize: 12.5, color: "#6D5D9E" }}><span style={{ fontWeight: 700, flexShrink: 0 }}>Rubric</span><span style={{ lineHeight: 1.5 }}>Excellent: {c.rubric.high} · Weak: {c.rubric.low}</span></div>}
                </>
              )}

              <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid #F1F2F6" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Your rating</span>
                  <span style={{ fontSize: 13, color: "#6B7280" }}><b style={{ color: rm.badge, fontSize: 15 }}>{rating}</b> / 100</span>
                </div>
                <input type="range" min="0" max="100" value={rating} onChange={(e) => setRatings((r) => ({ ...r, [c.id]: Number(e.target.value) }))} style={{ width: "100%", accentColor: rm.badge, cursor: "pointer", height: 6 }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11.5, color: "#B6B9C6" }}><span>0 · Not demonstrated</span><span>50 · Adequate</span><span>100 · Excellent</span></div>
              </div>

              <textarea value={notes[c.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))} placeholder="Notes on candidate's answer (optional)…" style={{ width: "100%", minHeight: 54, padding: "12px 15px", border: "1px solid #E2E4EC", borderRadius: 11, fontSize: 14, color: "#374151", lineHeight: 1.6, resize: "vertical", background: "#FBFBFD", outline: "none", marginTop: 18 }} />
            </div>
          );
        })}
      </div>

      {/* sticky bar */}
      <div style={{ position: "sticky", bottom: 0, marginTop: 20, background: "rgba(255,255,255,.9)", backdropFilter: "blur(8px)", border: "1px solid #ECEDF2", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 -2px 14px rgba(16,24,40,.06)" }} className="flex-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#9AA0AE" }}>Overall</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: om.color, letterSpacing: "-.5px" }}>{overall}</span>
          <span style={{ fontSize: 13, color: "#9AA0AE" }}>/ 100</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: om.color, padding: "3px 10px", borderRadius: 20 }}>{om.tag}</span>
        </div>
        <button onClick={() => navigate(`/jobs/${jobId}/candidate/${candidateId}`)} style={{ marginLeft: "auto", padding: "12px 18px", background: "transparent", color: "#6B7280", border: "none", fontWeight: 600, fontSize: 14.5, cursor: "pointer" }}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ padding: "13px 22px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 14.5, cursor: "pointer", boxShadow: "0 8px 20px rgba(99,102,241,.28)", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Submit interview scores →"}</button>
      </div>
    </div>
  );
}

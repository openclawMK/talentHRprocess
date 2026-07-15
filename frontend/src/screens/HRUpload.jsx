import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { displayLane, round } from "../lib/format.js";
import { usePalette } from "../context/ThemeContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const STEPS = ["Document parsed & text extracted", "Work history & skills identified", "Scoring against role criteria…", "Generating recommendation"];

export default function HRUpload() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inputRef = useRef(null);
  const D = usePalette();
  const card = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 20 };
  const LANE = { green: { label: "Green", color: D.green, bg: D.greenBg }, amber: { label: "Amber", color: D.amber, bg: D.amberBg }, red: { label: "Red", color: D.red, bg: D.redBg }, in_progress: { label: "In progress", color: D.text3, bg: D.pillBg } };
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(params.get("jobId") || "");
  const [phase, setPhase] = useState("idle"); // idle | proc | done
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get("/api/jobs").then((r) => { setJobs(r.data); if (!jobId && r.data[0]) setJobId(r.data[0].job_id); });
  }, []); // eslint-disable-line

  const role = jobs.find((j) => j.job_id === jobId);

  function onPick(f) {
    setError("");
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) return setError("Please upload a PDF or DOCX file.");
    if (f.size > 5 * 1024 * 1024) return setError("File too large — keep it under 5MB.");
    if (!jobId) return setError("Please pick a role first.");
    upload(f);
  }

  async function upload(f) {
    setPhase("proc"); setStep(0); setFileName(f.name);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1000);
    try {
      const fd = new FormData(); fd.append("file", f); fd.append("jobId", jobId);
      const res = await axios.post("/api/upload-cv", fd);
      clearInterval(timer);
      const c = res.data;
      setResult(c);
      const laneKey = displayLane(c.score);
      setRecent((prev) => [{ name: c.profile?.name || "Candidate", file: f.name, score: round(c.score?.combined_score), lane: laneKey, id: c.candidate_id }, ...prev].slice(0, 5));
      setPhase("done");
    } catch (err) {
      clearInterval(timer);
      setError(err?.response?.data?.error || "We couldn't read this CV. Try a cleaner PDF.");
      setPhase("idle");
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 6px", color: D.text }}>Upload a CV</h1>
        <p style={{ fontSize: 15, color: D.text3, margin: 0 }}>AI parses, scores and slots the candidate into <b style={{ color: D.text2 }}>{role?.role_title || "the selected role"}</b> automatically.</p>
      </div>

      {/* Role selector */}
      {phase === "idle" && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ padding: "9px 14px", border: `0.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, color: D.text2, background: D.cardBg, outline: "none" }}>
            {jobs.map((j) => <option key={j.job_id} value={j.job_id}>{j.role_title} — {j.industry}</option>)}
          </select>
        </div>
      )}

      {/* IDLE */}
      {phase === "idle" && (
        <>
          <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
            style={{ background: D.cardBg, border: `2px dashed ${D.border}`, borderRadius: 20, padding: "56px 30px", textAlign: "center", cursor: "pointer" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>↥</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: D.text }}>Drag &amp; drop a CV here</div>
            <div style={{ fontSize: 14, color: D.text4, marginBottom: 22 }}>or click to browse from your computer</div>
            <button style={{ padding: "12px 22px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 600, fontSize: 15, cursor: "pointer", boxShadow: "0 8px 20px rgba(99,102,241,.3)" }}>Select file</button>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 26 }}>
              {["PDF", "Word"].map((t) => <span key={t} style={{ fontSize: 12, fontWeight: 600, color: D.text3, background: D.pillBg, padding: "6px 12px", borderRadius: 8 }}>{t}</span>)}
              <span style={{ fontSize: 12, color: D.text5, alignSelf: "center" }}>· max 5 MB</span>
            </div>
            <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          </div>
          {error && <div style={{ marginTop: 16, background: D.redBg, border: `1px solid ${D.redBorder}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, color: D.red, textAlign: "center" }}>{error}</div>}

          {recent.length > 0 && (
            <div style={{ marginTop: 22, ...card, borderRadius: 16, padding: "18px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: D.text4, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>Recently uploaded</div>
              {recent.map((r, i) => {
                const L = LANE[r.lane] || LANE.in_progress;
                return (
                  <div key={i} onClick={() => navigate(`/jobs/${jobId}/candidate/${r.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", cursor: "pointer" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: D.redBg, color: D.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{r.file.split(".").pop().toUpperCase().slice(0, 4)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: D.text }}>{r.file}</div><div style={{ fontSize: 12, color: D.text4 }}>{r.name} · scored {r.score}</div></div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: L.color, background: L.bg, padding: "4px 10px", borderRadius: 20 }}>{L.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PROCESSING */}
      {phase === "proc" && (
        <div style={{ ...card, padding: "48px 30px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: "4px solid #EEF2FF", borderTopColor: "#6366F1", margin: "0 auto 24px" }} className="animate-spin" />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: D.text }}>Analysing <b style={{ color: D.blue }}>{fileName}</b></div>
          <div style={{ fontSize: 14, color: D.text4, marginBottom: 28 }}>AI is reading the document — this takes a few seconds.</div>
          <div style={{ maxWidth: 340, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
            {STEPS.map((label, i) => {
              const done = i < step, active = i === step;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: done ? D.text2 : active ? D.blue : D.text5, fontWeight: active ? 600 : 400 }}>
                  {done ? <span style={{ width: 22, height: 22, borderRadius: "50%", background: D.greenBg, color: D.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</span>
                    : active ? <span style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid #C7D2FE", borderTopColor: "#6366F1" }} className="animate-spin" />
                    : <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${D.border}` }} />}
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DONE */}
      {phase === "done" && result && (() => {
        const L = LANE[displayLane(result.score)] || LANE.in_progress;
        const bd = result.score_breakdown || {};
        const layers = [
          { label: "CV Fit", v: bd.cv_fit?.score, color: "#4F46E5" },
          { label: "Personality", v: bd.personality_fit?.score, color: "#7C3AED" },
          { label: "Interview", v: bd.interview_result?.score, color: "#0EA5E9" },
        ];
        return (
          <div style={{ ...card, padding: "44px 30px", textAlign: "center" }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: D.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", fontSize: 36, color: D.green }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: D.text }}>Candidate scored &amp; added</div>
            <div style={{ fontSize: 15, color: D.text3, marginBottom: 26 }}><b style={{ color: D.text }}>{result.profile?.name}</b> scored <b style={{ color: L.color }}>{round(result.score?.combined_score)} ({L.label})</b> and was added to the {role?.role_title} pipeline.</div>
            <div className="grid grid-cols-3 gap-3" style={{ maxWidth: 420, margin: "0 auto 28px" }}>
              {layers.map((l) => (
                <div key={l.label} style={{ border: `0.5px solid ${D.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: l.v != null ? l.color : D.text5 }}>{l.v != null ? l.v : "—"}</div>
                  <div style={{ fontSize: 12, color: D.text4, marginTop: 2 }}>{l.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }} className="flex-wrap">
              <button onClick={() => { setPhase("idle"); setResult(null); }} style={{ padding: "12px 18px", background: D.cardBg, color: D.text3, border: `0.5px solid ${D.border}`, borderRadius: 11, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Upload another</button>
              <button onClick={() => navigate(`/jobs/${jobId}/candidate/${result.candidate_id}`)} style={{ padding: "12px 20px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>View candidate detail →</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

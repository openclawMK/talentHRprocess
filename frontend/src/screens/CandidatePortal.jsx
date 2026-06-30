import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const VGRAD = "linear-gradient(135deg,#8B5CF6,#7C3AED)";
const IGRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const SCALE = [
  { v: 1, label: "Strongly disagree" }, { v: 2, label: "Disagree" }, { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" }, { v: 5, label: "Strongly agree" },
];
const PER_PAGE = 5;
const STEPS = ["landing", "details", "assessment", "review", "confirm"];
const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, padding: 36 };
const inputStyle = { width: "100%", padding: "13px 15px", border: "1px solid #DDE0E9", borderRadius: 11, fontSize: 15, color: "#111827", marginBottom: 20, outline: "none" };
const lbl = { display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 };

export default function CandidatePortal() {
  const { token } = useParams();
  const [job, setJob] = useState(undefined);
  const [step, setStep] = useState("landing");
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", expected_salary: "" });
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);
  const [applying, setApplying] = useState(false);
  const [candidateId, setCandidateId] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [page, setPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { axios.get(`/api/portal/${token}`).then((r) => setJob(r.data)).catch(() => setJob(null)); }, [token]);
  useEffect(() => {
    if (step === "assessment" && items.length === 0) {
      axios.get("/api/ocean-questions").then((r) => setItems([...(r.data.items || [])].sort(() => Math.random() - 0.5)));
    }
  }, [step, items.length]);

  const totalPages = Math.ceil(items.length / PER_PAGE);
  const pageItems = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const allAnswered = items.length > 0 && Object.keys(answers).length === items.length;
  const pageAnswered = pageItems.every((it) => answers[it.id]);

  function pickFile(f) {
    setError("");
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) return setError("Please upload a PDF or DOCX file.");
    if (f.size > 5 * 1024 * 1024) return setError("File too large — keep it under 5MB.");
    setFile(f);
  }
  async function submitApplication() {
    if (!form.name.trim() || !form.email.trim() || !file) { setError("Please fill in your name, email and attach your CV."); return; }
    setApplying(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("name", form.name); fd.append("email", form.email); fd.append("phone", form.phone); fd.append("expected_salary", form.expected_salary);
      const res = await axios.post(`/api/portal/${token}/apply`, fd);
      setCandidateId(res.data.candidate_id); setParsed(res.data.parsed); setStep("assessment");
    } catch (e) { setError(e.response?.data?.error || "We couldn't process your CV. Please try again."); }
    finally { setApplying(false); }
  }
  async function submitFinal() {
    setSubmitting(true); setError("");
    try { await axios.post(`/api/portal/${token}/ocean`, { candidate_id: candidateId, responses: answers }); setStep("confirm"); }
    catch (e) { setError(e.response?.data?.error || "Couldn't submit. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (job === undefined) return <Centered>Loading…</Centered>;
  if (job === null) return <Centered><div style={{ textAlign: "center" }}><h1 style={{ fontSize: 20, fontWeight: 700 }}>Link not valid</h1><p style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>This application link is invalid or has expired.</p></div></Centered>;

  const idx = STEPS.indexOf(step);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FB" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #ECEDF2", padding: "20px 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", fontSize: 20, fontWeight: 800, letterSpacing: "-.3px" }}><span style={{ color: "#6D28D9" }}>PeopleQuest</span> <span style={{ color: "#9AA0AE", fontWeight: 700 }}>Careers</span></div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 28 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
          {STEPS.map((s, i) => <div key={s} style={{ flex: 1, height: 7, borderRadius: 4, background: i <= idx ? IGRAD : "#E6E8EE" }} />)}
        </div>

        {/* Landing */}
        {step === "landing" && (
          <div style={cardBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#6B7280", fontWeight: 600, marginBottom: 14 }}><span>💼 {job.industry}</span><span style={{ color: "#D6D8E3" }}>·</span><span>📍 {job.location}</span></div>
            <h1 className="font-display" style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.8px", margin: "0 0 24px" }}>{job.role_title}</h1>
            {job.key_responsibilities?.length > 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>What you'll do</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
                  {job.key_responsibilities.map((r, i) => <div key={i} style={{ display: "flex", gap: 10, fontSize: 15, color: "#374151" }}><span style={{ color: "#A78BFA" }}>•</span> {r}</div>)}
                </div>
              </>
            )}
            <div style={{ background: "#F7F3FF", borderRadius: 14, padding: "20px 22px", marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#6D28D9", marginBottom: 8 }}>How it works</div>
              <div style={{ fontSize: 14.5, color: "#7C4DDB", lineHeight: 1.6 }}>1. Share your details and upload your CV · 2. Complete a short personality questionnaire · 3. Submit. Takes about 5 minutes.</div>
            </div>
            <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14.5, color: "#4B5563", lineHeight: 1.55, marginBottom: 26, cursor: "pointer" }}>
              <span onClick={() => setConsent((v) => !v)} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${consent ? "#7C3AED" : "#C7CBDA"}`, background: consent ? "#7C3AED" : "#fff", color: "#fff", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{consent ? "✓" : ""}</span>
              I consent to PeopleQuest collecting and processing my personal data and CV for recruitment purposes, in line with Malaysia's Personal Data Protection Act 2010 (PDPA).
            </label>
            <button onClick={() => setStep("details")} disabled={!consent} style={{ width: "100%", padding: 15, background: VGRAD, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: consent ? 1 : 0.5 }}>Start application →</button>
          </div>
        )}

        {/* Details */}
        {step === "details" && (
          <div style={cardBox}>
            <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 26px" }}>Your details</h1>
            <label style={lbl}>Full name *</label>
            <input style={inputStyle} placeholder="As per IC" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label style={lbl}>Email *</label>
            <input type="email" style={inputStyle} placeholder="you@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label style={lbl}>Phone</label>
            <input style={inputStyle} placeholder="01X-XXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label style={lbl}>Expected monthly salary (RM)</label>
            <input inputMode="numeric" style={inputStyle} placeholder="e.g. 2500" value={form.expected_salary} onChange={(e) => setForm({ ...form, expected_salary: e.target.value.replace(/[^\d]/g, "") })} />
            <div style={{ fontSize: 12.5, color: "#9AA0AE", marginTop: -12, marginBottom: 20 }}>Optional — your expected gross monthly pay. Helps us match you to the right role.</div>
            <label style={lbl}>CV / Resume *</label>
            <div onClick={() => !applying && inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!applying) pickFile(e.dataTransfer.files?.[0]); }}
              style={{ border: "2px dashed #C7CBDA", borderRadius: 14, padding: 36, textAlign: "center", marginBottom: 26, cursor: "pointer" }}>
              {file ? <div style={{ fontSize: 15, color: "#6D28D9", fontWeight: 600 }}>📄 {file.name}</div> : (
                <>
                  <div style={{ fontSize: 30, color: "#9AA0AE", marginBottom: 8 }}>⤓</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>Drop your CV or browse</div>
                  <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 4 }}>PDF or DOCX, max 5MB</div>
                </>
              )}
              <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            </div>
            {error && <p style={{ color: "#DC2626", fontSize: 14, marginTop: -12, marginBottom: 16 }}>{error}</p>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span onClick={() => setStep("landing")} style={{ fontSize: 15, fontWeight: 600, color: "#6B7280", cursor: "pointer" }}>← Back</span>
              <button onClick={submitApplication} disabled={applying} style={{ padding: "13px 24px", background: IGRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: applying ? 0.7 : 1 }}>{applying ? "Reading your CV…" : "Continue →"}</button>
            </div>
          </div>
        )}

        {/* Assessment */}
        {step === "assessment" && (
          <div style={cardBox}>
            <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 8px" }}>Personality questionnaire</h1>
            <div style={{ fontSize: 15, color: "#6B7280", marginBottom: 4 }}>There are no right or wrong answers. Rate how much each statement describes you.</div>
            <div style={{ fontSize: 14, color: "#9AA0AE", marginBottom: 22 }}>I see myself as someone who…</div>
            {items.length === 0 ? <div style={{ color: "#9AA0AE" }}>Loading…</div> : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {pageItems.map((it) => (
                    <div key={it.id} style={{ border: "1px solid #ECEDF2", borderRadius: 14, padding: 20 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1F2430", marginBottom: 16 }}>…{it.text}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {SCALE.map((sc) => {
                          const active = answers[it.id] === sc.v;
                          return <span key={sc.v} onClick={() => setAnswers((a) => ({ ...a, [it.id]: sc.v }))} style={{ fontSize: 14, fontWeight: 600, borderRadius: 10, padding: "10px 16px", cursor: "pointer", border: `1px solid ${active ? "#7C3AED" : "#DDE0E9"}`, background: active ? "#7C3AED" : "#fff", color: active ? "#fff" : "#4B5563" }}>{sc.label}</span>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
                  <span style={{ fontSize: 14, color: "#9AA0AE" }}>Page {page + 1} of {totalPages}</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    {page > 0 && <button onClick={() => setPage((p) => p - 1)} style={{ padding: "13px 20px", background: "#fff", color: "#6B7280", border: "1px solid #E2E4EC", borderRadius: 11, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>← Back</button>}
                    {page < totalPages - 1
                      ? <button onClick={() => setPage((p) => p + 1)} disabled={!pageAnswered} style={{ padding: "13px 24px", background: VGRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: pageAnswered ? 1 : 0.5 }}>Next →</button>
                      : <button onClick={() => setStep("review")} disabled={!allAnswered} style={{ padding: "13px 24px", background: VGRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: allAnswered ? 1 : 0.5 }}>Review →</button>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Review */}
        {step === "review" && (
          <div style={cardBox}>
            <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 6px" }}>Review &amp; submit</h1>
            <div style={{ fontSize: 15, color: "#6B7280", marginBottom: 24 }}>Please confirm everything looks right before submitting.</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                ["Applying for", job.role_title], ["Name", form.name], ["Email", form.email],
                ...(form.phone ? [["Phone", form.phone]] : []),
                ...(form.expected_salary ? [["Expected salary", `RM${Number(form.expected_salary).toLocaleString("en-MY")}/mo`]] : []),
                ["CV", file?.name],
                ...(parsed?.latest_role ? [["Most recent role", parsed.latest_role]] : []),
                ["Questionnaire", `${Object.keys(answers).length} / ${items.length} answered`],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderBottom: i < arr.length - 1 ? "1px solid #F1F2F6" : "none" }}>
                  <span style={{ fontSize: 15, color: "#6B7280" }}>{k}</span><span style={{ fontSize: 15, fontWeight: 700, color: "#1F2430" }}>{v}</span>
                </div>
              ))}
            </div>
            {error && <p style={{ color: "#DC2626", fontSize: 14, marginTop: 14 }}>{error}</p>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
              <span onClick={() => setStep("assessment")} style={{ fontSize: 15, fontWeight: 600, color: "#6B7280", cursor: "pointer" }}>← Edit answers</span>
              <button onClick={submitFinal} disabled={submitting} style={{ padding: "13px 26px", background: IGRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: submitting ? 0.7 : 1 }}>{submitting ? "Submitting…" : "Submit application"}</button>
            </div>
          </div>
        )}

        {/* Confirm */}
        {step === "confirm" && (
          <div style={{ ...cardBox, border: "1px solid #BBF7D0", padding: "52px 36px", textAlign: "center" }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", border: "3px solid #16A34A", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px" }}>✓</div>
            <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 14px" }}>Application received</h1>
            <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6, margin: "0 auto 14px", maxWidth: 520 }}>Thank you, {form.name.split(" ")[0]}. Your application for <b style={{ color: "#1F2430" }}>{job.role_title}</b> has been submitted. Our recruitment team will review it and be in touch if there's a match.</p>
            <div style={{ fontSize: 14, color: "#9AA0AE" }}>You may now close this window.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FB", padding: 24 }}>{children}</div>;
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const VGRAD = "linear-gradient(135deg,#8B5CF6,#7C3AED)";
const IGRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const SCALE = [
  { v: 1, label: "Strongly disagree" }, { v: 2, label: "Disagree" }, { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" }, { v: 5, label: "Strongly agree" },
];
const PER_PAGE = 5;
const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, padding: 36 };

export default function CandidateAssessment() {
  const { candidateId } = useParams();
  const [meta, setMeta] = useState(undefined); // undefined=loading, null=invalid
  const [step, setStep] = useState("intro"); // intro | assessment | confirm
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [page, setPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`/api/assessment/${candidateId}`).then((r) => setMeta(r.data)).catch(() => setMeta(null));
  }, [candidateId]);
  useEffect(() => {
    if (step === "assessment" && items.length === 0) {
      axios.get("/api/ocean-questions").then((r) => setItems([...(r.data.items || [])].sort(() => Math.random() - 0.5)));
    }
  }, [step, items.length]);

  const totalPages = Math.ceil(items.length / PER_PAGE);
  const pageItems = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const allAnswered = items.length > 0 && Object.keys(answers).length === items.length;
  const pageAnswered = pageItems.every((it) => answers[it.id]);

  async function submitFinal() {
    setSubmitting(true); setError("");
    try { await axios.post(`/api/assessment/${candidateId}/ocean`, { responses: answers }); setStep("confirm"); }
    catch (e) { setError(e.response?.data?.error || "Couldn't submit. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (meta === undefined) return <Centered>Loading…</Centered>;
  if (meta === null) return <Centered><div style={{ textAlign: "center" }}><h1 style={{ fontSize: 20, fontWeight: 700 }}>Link not valid</h1><p style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>This assessment link is invalid or has expired.</p></div></Centered>;

  const firstName = (meta.name || "there").split(" ")[0];

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FB" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #ECEDF2", padding: "20px 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", fontSize: 20, fontWeight: 800, letterSpacing: "-.3px" }}><span style={{ color: "#6D28D9" }}>PeopleQuest</span> <span style={{ color: "#9AA0AE", fontWeight: 700 }}>Careers</span></div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: 28 }}>

        {/* Intro */}
        {step === "intro" && (
          <div style={cardBox}>
            {meta.already_done && (
              <div style={{ background: "#ECFDF5", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 16px", marginBottom: 22, fontSize: 14, color: "#047857" }}>
                ✓ You've already completed this questionnaire. You can retake it below if you'd like to update your answers.
              </div>
            )}
            <div style={{ fontSize: 14, color: "#6B7280", fontWeight: 600, marginBottom: 10 }}>Personality questionnaire · {meta.role_title}</div>
            <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 18px" }}>Hi {firstName}, one quick step</h1>
            <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6, marginBottom: 22 }}>
              As part of your application for <b style={{ color: "#1F2430" }}>{meta.role_title}</b>, please complete a short personality questionnaire. There are no right or wrong answers — just rate how much each statement describes you.
            </p>
            <div style={{ background: "#F7F3FF", borderRadius: 14, padding: "20px 22px", marginBottom: 26 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#6D28D9", marginBottom: 8 }}>What to expect</div>
              <div style={{ fontSize: 14.5, color: "#7C4DDB", lineHeight: 1.6 }}>10 short statements · about 5 minutes · your answers stay confidential and are used only for this application.</div>
            </div>
            <button onClick={() => setStep("assessment")} style={{ width: "100%", padding: 15, background: VGRAD, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Start questionnaire →</button>
          </div>
        )}

        {/* Assessment */}
        {step === "assessment" && (
          <div style={cardBox}>
            <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
              {Array.from({ length: totalPages || 1 }).map((_, i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 4, background: i <= page ? IGRAD : "#E6E8EE" }} />)}
            </div>
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
                {error && <p style={{ color: "#DC2626", fontSize: 14, marginTop: 16 }}>{error}</p>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
                  <span style={{ fontSize: 14, color: "#9AA0AE" }}>Page {page + 1} of {totalPages}</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    {page > 0 && <button onClick={() => setPage((p) => p - 1)} style={{ padding: "13px 20px", background: "#fff", color: "#6B7280", border: "1px solid #E2E4EC", borderRadius: 11, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>← Back</button>}
                    {page < totalPages - 1
                      ? <button onClick={() => setPage((p) => p + 1)} disabled={!pageAnswered} style={{ padding: "13px 24px", background: VGRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: pageAnswered ? 1 : 0.5 }}>Next →</button>
                      : <button onClick={submitFinal} disabled={!allAnswered || submitting} style={{ padding: "13px 26px", background: IGRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: allAnswered && !submitting ? 1 : 0.5 }}>{submitting ? "Submitting…" : "Submit"}</button>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Confirm */}
        {step === "confirm" && (
          <div style={{ ...cardBox, border: "1px solid #BBF7D0", padding: "52px 36px", textAlign: "center" }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", border: "3px solid #16A34A", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px" }}>✓</div>
            <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 14px" }}>Thank you, {firstName}!</h1>
            <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6, margin: "0 auto 14px", maxWidth: 520 }}>Your questionnaire for <b style={{ color: "#1F2430" }}>{meta.role_title}</b> has been submitted. Our recruitment team will continue reviewing your application.</p>
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

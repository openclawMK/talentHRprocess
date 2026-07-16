import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { usePalette } from "../context/ThemeContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const STARTERS = [
  "Who should I hire across all roles?",
  "Who's passed screening and awaits an interview?",
  "Any candidates over budget or above market?",
  "Which candidates have a dealbreaker or flagged check?",
];

// Pull role/candidate context from the current route so "why this score?" just works.
function routeContext(pathname) {
  const job = pathname.match(/\/jobs\/(job_[^/]+)/);
  const cand = pathname.match(/\/candidate\/([^/]+)/);
  return { jobId: job ? job[1] : undefined, candidateId: cand ? cand[1] : undefined };
}

export default function AskAssistant() {
  const location = useLocation();
  const D = usePalette();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]); // {role:'user'|'assistant', content}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, busy, open]);

  async function ask(q) {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const { jobId, candidateId } = routeContext(location.pathname);
      const res = await axios.post("/api/assistant/ask", { question, history, jobId, candidateId });
      setMsgs((m) => [...m, { role: "assistant", content: res.data.answer || "…" }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry — I couldn't answer that just now. Please try again." }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button onClick={() => setOpen(true)} title="AI Assistant"
          style={{ position: "fixed", right: 22, bottom: 22, zIndex: 60, display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 10px 28px rgba(99,102,241,.4)" }}>
          ✨ AI Assistant
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 60, width: "min(100%, 400px)", background: D.page, borderLeft: `1px solid ${D.border}`, boxShadow: "-12px 0 40px rgba(0,0,0,.35)", display: "flex", flexDirection: "column", fontFamily: D.font, color: D.text }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderBottom: `1px solid ${D.border}`, background: D.cardBg }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: GRAD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.2px", color: D.text }}>AI Assistant</div>
              <div style={{ fontSize: 11.5, color: D.text4 }}>Answers from your live hiring data · GPT-4o</div>
            </div>
            {msgs.length > 0 && <button onClick={() => setMsgs([])} title="Clear" style={{ fontSize: 12, color: D.text4, background: "none", border: "none", cursor: "pointer" }}>Clear</button>}
            <button onClick={() => setOpen(false)} title="Close" style={{ fontSize: 20, color: D.text4, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          {/* Body */}
          <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: 18, background: D.page }}>
            {msgs.length === 0 && (
              <div>
                <div style={{ fontSize: 13.5, color: D.text3, lineHeight: 1.6, marginBottom: 16 }}>Ask me anything about your candidates, roles, scores or salaries. I read your live pipeline — I can advise and draft messages, but I never send or change anything.</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: D.text4, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 9 }}>Try asking</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => ask(s)} style={{ textAlign: "left", fontSize: 13, color: D.blue, background: D.pillBg, border: `0.5px solid ${D.pillBorder}`, borderRadius: 10, padding: "10px 13px", cursor: "pointer" }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                <div style={{ maxWidth: "88%", whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55, padding: "11px 14px", borderRadius: 13, ...(m.role === "user" ? { background: GRAD, color: "#fff", borderBottomRightRadius: 4 } : { background: D.cardBg, color: D.text2, border: `0.5px solid ${D.border}`, borderBottomLeftRadius: 4 }) }}>{m.content}</div>
              </div>
            ))}
            {busy && <div style={{ fontSize: 13, color: D.text4, padding: "4px 2px" }}>Thinking…</div>}
          </div>

          {/* Input */}
          <div style={{ padding: 14, borderTop: `1px solid ${D.border}`, background: D.cardBg, display: "flex", gap: 9 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} placeholder="Ask about candidates, scores, salary…" disabled={busy}
              style={{ flex: 1, padding: "11px 14px", background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 11, fontSize: 14, color: D.text, outline: "none" }} />
            <button onClick={() => ask()} disabled={busy || !input.trim()} style={{ padding: "11px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy || !input.trim() ? 0.5 : 1 }}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}

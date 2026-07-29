import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const VGRAD = "linear-gradient(135deg,#8B5CF6,#7C3AED)";
const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, padding: 36 };
// The call now ends when the MODEL calls the end_call tool (see
// voiceScreen.js) — only after it has asked if the candidate has more
// questions, heard them confirm they don't, and said its closing line. Fixed
// timers used to force a wrap-up regardless of where the conversation
// actually was, which cut candidates off before that confirmation. This is
// now purely a safety net for a runaway call that never calls the tool.
const SAFETY_LIMIT_MS = 10 * 60 * 1000;
// If the candidate is still mid-sentence when the safety limit lands, give them a
// bounded moment to finish rather than cutting them off. Bounded, so a candidate
// who simply keeps talking can't hold the call open indefinitely.
const SAFETY_LIMIT_GRACE_MS = 20 * 1000;

export default function VoiceScreen() {
  const { candidateId } = useParams();
  const [meta, setMeta] = useState(undefined); // undefined=loading, null=invalid, "disabled"=off in Settings
  const [step, setStep] = useState("intro"); // intro | connecting | live | ending | confirm
  const [status, setStatus] = useState("Connecting…"); // shown during the call
  const [error, setError] = useState("");
  const [subtitle, setSubtitle] = useState(""); // live caption of what the AI is currently saying

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioElRef = useRef(null);
  const transcriptRef = useRef([]); // [{role:'candidate'|'ai', text}]
  const subtitleRef = useRef(""); // accumulates delta chunks for the AI's current line
  const safetyTimeoutRef = useRef(null);
  const candidateSpeakingRef = useRef(false);
  const endCallPendingRef = useRef(false); // model called end_call while candidate was still talking
  const graceUsedRef = useRef(false); // safety-limit grace can only be taken once
  const endedRef = useRef(false); // guards against ending twice

  useEffect(() => {
    axios.get(`/api/voice-screen/${candidateId}`).then((r) => setMeta(r.data))
      .catch((e) => setMeta(e.response?.data?.disabled ? "disabled" : null));
  }, [candidateId]);

  useEffect(() => () => cleanup(), []); // stop mic + close connection on unmount

  function cleanup() {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
  }

  // Pure safety net for a call that never calls end_call (e.g. a model bug
  // or dropped tool call) — never the normal way the call ends. Never cuts
  // off mid-sentence: if the candidate is still talking, take one bounded
  // grace window so their final answer is captured before we close.
  function safetyStop() {
    if (candidateSpeakingRef.current && !graceUsedRef.current) {
      graceUsedRef.current = true;
      safetyTimeoutRef.current = setTimeout(endCall, SAFETY_LIMIT_GRACE_MS);
      return;
    }
    endCall();
  }

  // Called when the model invokes the end_call tool — the actual signal that
  // the conversation is over (closing question asked, candidate confirmed no
  // more questions, thank-you said). If they're still mid-sentence somehow,
  // defer until they finish rather than cutting them off.
  function requestEndCall() {
    if (endedRef.current) return;
    if (candidateSpeakingRef.current) {
      endCallPendingRef.current = true;
      return;
    }
    endedRef.current = true;
    // The tool-call item finishes generating as soon as the model decides to
    // call it, which can be a beat before the trailing audio for the
    // thank-you line has actually finished playing back over WebRTC (jitter
    // buffer lag) — hanging up immediately was cutting that line off before
    // the candidate heard it. Give playback a moment to catch up first.
    setTimeout(endCall, 2500);
  }

  async function startCall() {
    setError("");
    setStep("connecting");
    subtitleRef.current = "";
    setSubtitle("");
    try {
      const { data } = await axios.post(`/api/voice-screen/${candidateId}/session`);
      const clientSecret = data.client_secret;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Play the AI's voice as it streams back.
      pc.ontrack = (e) => {
        if (audioElRef.current) audioElRef.current.srcObject = e.streams[0];
      };

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      mic.getTracks().forEach((track) => pc.addTrack(track, mic));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      // With turn_detection on, the model otherwise just waits for the
      // candidate to speak first — nothing prompts it to open the call
      // itself, so candidates were left saying "hi?" into silence. Once the
      // channel is actually open, explicitly ask for a first response so the
      // AI greets them and asks its first question per buildInstructions.
      dc.onopen = () => {
        dc.send(JSON.stringify({ type: "response.create" }));
      };
      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
            transcriptRef.current.push({ role: "candidate", text: event.transcript.trim() });
          } else if (event.type === "response.output_audio_transcript.delta" || event.type === "response.audio_transcript.delta") {
            // Live subtitle, built up chunk by chunk as the AI actually speaks.
            subtitleRef.current += event.delta || "";
            setSubtitle(subtitleRef.current);
          } else if (
            (event.type === "response.output_audio_transcript.done" || event.type === "response.audio_transcript.done") &&
            event.transcript
          ) {
            transcriptRef.current.push({ role: "ai", text: event.transcript.trim() });
            // In case delta events weren't sent, make sure the finished line
            // still ends up on screen rather than staying blank.
            subtitleRef.current = event.transcript.trim();
            setSubtitle(subtitleRef.current);
          } else if (event.type === "input_audio_buffer.speech_started") {
            candidateSpeakingRef.current = true;
            setStatus("Listening…");
            // The candidate is talking now — the AI's last line has served
            // its purpose, so clear it rather than leave a stale caption up.
            subtitleRef.current = "";
            setSubtitle("");
          } else if (event.type === "input_audio_buffer.speech_stopped") {
            candidateSpeakingRef.current = false;
            // end_call arrived while they were mid-answer — now that they've
            // finished, actually end the call.
            if (endCallPendingRef.current) {
              endCallPendingRef.current = false;
              requestEndCall();
            }
          } else if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") {
            setStatus("AI speaking…");
          } else if (event.type === "response.created") {
            // A fresh AI turn is starting — clear out the previous line so
            // captions don't run two questions together.
            subtitleRef.current = "";
            setSubtitle("");
          } else if (event.type === "response.output_item.done" && event.item?.type === "function_call" && event.item?.name === "end_call") {
            requestEndCall();
          }
        } catch {
          /* ignore malformed events */
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!res.ok) throw new Error(`Connection failed (${res.status})`);
      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStep("live");
      setStatus("Listening…");
      safetyTimeoutRef.current = setTimeout(safetyStop, SAFETY_LIMIT_MS);
    } catch (err) {
      console.error(err);
      setError("Couldn't start the voice screening — please check your microphone permission and try again.");
      cleanup();
      setStep("intro");
    }
  }

  async function endCall() {
    setStep("ending");
    cleanup();
    const transcript = transcriptRef.current
      .map((t) => `${t.role === "candidate" ? "Candidate" : "Interviewer"}: ${t.text}`)
      .join("\n");
    try {
      if (transcript.trim()) {
        await axios.post(`/api/voice-screen/${candidateId}/complete`, { transcript });
      }
    } catch (e) {
      console.error("Failed to save screening:", e);
    }
    setStep("confirm");
  }

  if (meta === undefined) return <Centered>Loading…</Centered>;
  if (meta === "disabled")
    return (
      <Centered>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Voice screening not available</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>This step isn't part of your application right now. Please continue with the rest of the process as instructed.</p>
        </div>
      </Centered>
    );
  if (meta === null)
    return (
      <Centered>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Link not valid</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>This screening link is invalid or has expired.</p>
        </div>
      </Centered>
    );

  const firstName = (meta.name || "there").split(" ")[0];

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FB" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #ECEDF2", padding: "20px 28px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", fontSize: 20, fontWeight: 800, letterSpacing: "-.3px" }}>
          <span style={{ color: "#6D28D9" }}>People Hire</span> <span style={{ color: "#9AA0AE", fontWeight: 700 }}>Careers</span>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: 28 }}>
        {step === "intro" && (
          <div style={cardBox}>
            {meta.already_done && (
              <div style={{ background: "#ECFDF5", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 16px", marginBottom: 22, fontSize: 14, color: "#047857" }}>
                ✓ You've already completed this screening. You can retake it below if you'd like.
              </div>
            )}
            <div style={{ fontSize: 14, color: "#6B7280", fontWeight: 600, marginBottom: 10 }}>
              Voice screening · {meta.role_title}{meta.company_name ? ` · ${meta.company_name}` : ""}
            </div>
            <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 18px" }}>Hi {firstName}, let's have a quick chat</h1>
            <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6, marginBottom: 22 }}>
              As part of your application for <b style={{ color: "#1F2430" }}>{meta.role_title}</b>, please complete a short voice screening with our AI interviewer. Find somewhere quiet, and make sure your microphone is working.
            </p>
            <div style={{ background: "#F7F3FF", borderRadius: 14, padding: "20px 22px", marginBottom: 26 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#6D28D9", marginBottom: 8 }}>What to expect</div>
              <div style={{ fontSize: 14.5, color: "#7C4DDB", lineHeight: 1.6 }}>About 5 to 6 questions, roughly 4-5 minutes · speak naturally, as if talking to a person · your microphone will be used only for this call.</div>
            </div>
            {error && <p style={{ color: "#DC2626", fontSize: 14, marginBottom: 16 }}>{error}</p>}
            <button onClick={startCall} style={{ width: "100%", padding: 15, background: VGRAD, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>🎙 Start voice screening</button>
          </div>
        )}

        {(step === "connecting" || step === "live" || step === "ending") && (
          <div style={{ ...cardBox, textAlign: "center", padding: "56px 36px" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>{step === "connecting" ? "Connecting…" : step === "ending" ? "Wrapping up…" : "Voice screening in progress"}</h2>
            {step === "live" && <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 30px" }}>{firstName}, you're now speaking with our AI interviewer</p>}
            <div style={{ width: 130, height: 130, borderRadius: "50%", background: VGRAD, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 26px", opacity: step === "live" ? 1 : 0.5 }}>
              <span style={{ fontSize: 44 }}>🎙</span>
            </div>
            {step === "live" && (
              <>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#6D28D9", background: "#F7F3FF", padding: "8px 18px", borderRadius: 999, marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED" }} /> {status}
                </div>
                {/* Live subtitle of what the AI is saying, so candidates can follow
                    along even over a shaky connection or if they mishear a word. */}
                <div style={{ minHeight: 64, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                  {subtitle && (
                    <p style={{ fontSize: 16, lineHeight: 1.5, color: "#1F2430", background: "#F7F8FB", border: "1px solid #ECEDF2", borderRadius: 12, padding: "14px 20px", maxWidth: 480, margin: 0 }}>{subtitle}</p>
                  )}
                </div>
                <div>
                  <button onClick={endCall} style={{ padding: "12px 24px", background: "#fff", color: "#DC2626", border: "1px solid #FCA5A5", borderRadius: 11, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>End screening</button>
                </div>
              </>
            )}
            <audio ref={audioElRef} autoPlay />
          </div>
        )}

        {step === "confirm" && (
          <div style={{ ...cardBox, border: "1px solid #BBF7D0", padding: "52px 36px", textAlign: "center" }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", border: "3px solid #16A34A", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px" }}>✓</div>
            <h1 className="font-display" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 14px" }}>Screening complete!</h1>
            <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6, margin: "0 auto 14px", maxWidth: 480 }}>Thanks, {firstName} — your voice screening for <b style={{ color: "#1F2430" }}>{meta.role_title}</b> has been submitted. Our recruitment team will review and follow up.</p>
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

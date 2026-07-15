import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const IGRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, padding: 36 };

function formatSlot(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kuala_Lumpur" });
  const time = d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
  return { date, time };
}

export default function InterviewBooking() {
  const { candidateId } = useParams();
  const [meta, setMeta] = useState(undefined); // undefined=loading, null=invalid
  const [picked, setPicked] = useState(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState(null);

  const load = () => axios.get(`/api/interview-booking/${candidateId}`).then((r) => { setMeta(r.data); setBooked(r.data.my_booking || null); }).catch(() => setMeta(null));
  useEffect(() => { load(); }, [candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmBooking() {
    if (!picked) return;
    setBooking(true); setError("");
    try {
      const { data } = await axios.post(`/api/interview-booking/${candidateId}/book`, { slot_id: picked });
      setBooked(data.slot);
    } catch (e) {
      setError(e.response?.data?.error || "Couldn't book that time. Please try again.");
      load(); // slot list may be stale (e.g. someone else took it)
    } finally {
      setBooking(false);
    }
  }

  if (meta === undefined) return <Centered>Loading…</Centered>;
  if (meta === null) return <Centered><div style={{ textAlign: "center" }}><h1 style={{ fontSize: 20, fontWeight: 700 }}>Link not valid</h1><p style={{ marginTop: 8, fontSize: 14, color: "#6B7280" }}>This booking link is invalid or has expired.</p></div></Centered>;

  const firstName = (meta.name || "there").split(" ")[0];

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FB" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #ECEDF2", padding: "20px 28px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", fontSize: 20, fontWeight: 800, letterSpacing: "-.3px" }}><span style={{ color: "#6D28D9" }}>PeopleQuest</span> <span style={{ color: "#9AA0AE", fontWeight: 700 }}>Careers</span></div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: 28 }}>

        {booked ? (
          <div style={{ ...cardBox, border: "1px solid #BBF7D0", padding: "52px 36px", textAlign: "center" }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", border: "3px solid #16A34A", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px" }}>✓</div>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 14px" }}>You're booked, {firstName}!</h1>
            {(() => { const { date, time } = formatSlot(booked.start); return (
              <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.6, margin: "0 auto 6px", maxWidth: 480 }}>
                Your interview for <b style={{ color: "#1F2430" }}>{meta.role_title}</b> is confirmed for<br />
                <b style={{ color: "#1F2430" }}>{date} at {time}</b>
              </p>
            ); })()}
            <p style={{ fontSize: 14, color: "#9AA0AE", marginTop: 14 }}>We've sent a confirmation to your WhatsApp. You may now close this window.</p>
          </div>
        ) : (
          <div style={cardBox}>
            <div style={{ fontSize: 14, color: "#6B7280", fontWeight: 600, marginBottom: 10 }}>Interview booking · {meta.role_title}{meta.company_name ? ` · ${meta.company_name}` : ""}</div>
            <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 14px" }}>Hi {firstName}, pick a time</h1>
            <p style={{ fontSize: 15, color: "#4B5563", lineHeight: 1.6, marginBottom: 22 }}>Choose whichever interview slot works best for you.</p>

            {meta.slots.length === 0 ? (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 18px", fontSize: 14, color: "#92400E" }}>
                No open times right now — please check back later, or reply to our WhatsApp message and we'll sort out a time directly.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {meta.slots.map((s) => {
                    const { date, time } = formatSlot(s.start);
                    const active = picked === s.slot_id;
                    return (
                      <div key={s.slot_id} onClick={() => setPicked(s.slot_id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${active ? "#7C3AED" : "#E2E4EC"}`, background: active ? "#F5F3FF" : "#fff", borderRadius: 12, padding: "14px 18px", cursor: "pointer" }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#1F2430" }}>{date}</div>
                          <div style={{ fontSize: 13.5, color: "#6B7280" }}>{time} · {s.duration_minutes} min</div>
                        </div>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${active ? "#7C3AED" : "#D6D8E3"}`, background: active ? "#7C3AED" : "#fff", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{active ? "✓" : ""}</div>
                      </div>
                    );
                  })}
                </div>
                {error && <p style={{ color: "#DC2626", fontSize: 14, marginTop: 16 }}>{error}</p>}
                <button onClick={confirmBooking} disabled={!picked || booking} style={{ width: "100%", marginTop: 22, padding: 15, background: IGRAD, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: picked && !booking ? 1 : 0.5 }}>{booking ? "Booking…" : "Confirm this time →"}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FB", padding: 24 }}>{children}</div>;
}

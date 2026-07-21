/**
 * Twilio WhatsApp inbound webhook (Session 10).
 *
 * Twilio POSTs form-encoded data to /webhook/whatsapp when a candidate replies.
 * We log the reply, match it to a candidate by phone, and auto-process simple
 * confirmations (YES / NO). Always returns 200 so Twilio doesn't retry.
 *
 * Configure in Twilio Console → Messaging → Sandbox settings → "When a message
 * comes in": https://<your-render-backend>.onrender.com/webhook/whatsapp
 */
import { Router } from "express";
import { phoneDigits, logMessage } from "../services/whatsappService.js";
import { readTable, writeTable, appendWhatsappReply } from "../services/store.js";

const router = Router();

const YES = ["YES", "YA", "OK", "OKAY", "CONFIRM", "SETUJU"];
const NO = ["NO", "TIDAK", "CANCEL", "RESCHEDULE"];

router.post("/whatsapp", async (req, res) => {
  try {
    const from = req.body?.From || ""; // "whatsapp:+60..."
    const body = (req.body?.Body || "").trim();
    const profileName = req.body?.ProfileName || "";
    const messageSid = req.body?.MessageSid || null;

    logMessage("inbound", from, body, "received", messageSid);

    const fromDigits = phoneDigits(from);

    // Match to a candidate by phone.
    const candidates = await readTable("candidates");
    const candidate = candidates.find(
      (c) => phoneDigits(c.profile?.contact?.phone) === fromDigits
    );

    const word = body.toUpperCase().replace(/[^A-Z]/g, "");
    let action = "manual_review";
    if (YES.includes(word)) action = "confirmed";
    else if (NO.includes(word)) action = "reschedule";

    // Log the reply.
    await appendWhatsappReply({
      phone: from,
      profile_name: profileName,
      body,
      candidate_id: candidate?.candidate_id || null,
      action,
      processed: action !== "manual_review",
      received_at: new Date().toISOString(),
    });

    // Update the matched candidate's invite state, if any.
    if (candidate && action !== "manual_review") {
      if (action === "confirmed") {
        candidate.whatsapp_invite = { ...(candidate.whatsapp_invite || {}), confirmed: true };
      } else if (action === "reschedule") {
        candidate.whatsapp_invite = {
          ...(candidate.whatsapp_invite || {}),
          confirmed: false,
          needs_reschedule: true,
        };
      }
      await writeTable("candidates", candidates);
    }

    // Reply inline via TwiML — the reliable way to respond in the sandbox.
    let reply = null;
    if (action === "confirmed") reply = "✅ Thank you — your interview is confirmed. See you then!";
    else if (action === "reschedule") reply = "No problem — our team will reach out to find a better time. 🙏";

    if (reply) logMessage("outbound", from, reply, "twiml-reply");

    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const twiml = reply
      ? `<Response><Message>${esc(reply)}</Message></Response>`
      : "<Response></Response>";
    res.set("Content-Type", "text/xml").status(200).send(twiml);
  } catch (err) {
    console.error("whatsapp webhook error:", err);
    res.status(200).send("<Response></Response>"); // never make Twilio retry
  }
});

export default router;

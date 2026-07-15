/**
 * WhatsApp messaging via Twilio (Session 10).
 *
 * Graceful by design: if Twilio credentials are not configured, messages are
 * logged to whatsapp-log.json with status "unconfigured" and nothing throws —
 * the rest of the app keeps working. Add credentials to backend/.env (or Render
 * env vars) to activate real sending.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. whatsapp:+14155238886)
 *   FRONTEND_URL (public Vercel URL, for portal links inside messages)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const LOG_PATH = path.join(DATA_DIR, "whatsapp-log.json");

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;

const client =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

export const whatsappConfigured = !!(client && TWILIO_WHATSAPP_FROM);

const readJSON = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
};
const writeJSON = (p, d) => {
  try {
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
  } catch {
    /* never block on logging */
  }
};

/**
 * Normalize a Malaysian phone number to Twilio WhatsApp format.
 *   "012-345 6789" -> "whatsapp:+60123456789"
 *   "+60123456789" -> "whatsapp:+60123456789"
 */
export function formatMalaysianPhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!d) return null;
  if (d.startsWith("60")) {
    // already country-coded
  } else if (d.startsWith("0")) {
    d = "60" + d.slice(1);
  } else {
    d = "60" + d; // local number without leading 0
  }
  return `whatsapp:+${d}`;
}

/** Bare digits (e.g. "60123456789") for matching across formats. */
export function phoneDigits(raw) {
  const f = formatMalaysianPhone(raw);
  return f ? f.replace(/\D/g, "") : null;
}

/** Append-only message log. */
export function logMessage(direction, phone, content, status, messageId = null) {
  const log = readJSON(LOG_PATH, []);
  log.push({
    direction, // "outbound" | "inbound"
    phone,
    content,
    status,
    message_id: messageId,
    timestamp: new Date().toISOString(),
  });
  writeJSON(LOG_PATH, log);
}

/** Read the whole message log (used by the conversation panel). */
export function readLog() {
  return readJSON(LOG_PATH, []);
}

const TEMPLATES = {
  application_received: (p) =>
    `Hi ${p.name || "there"}! 👋 We've received your application for *${p.role}* at ${p.company || "our team"}. ` +
    `Our recruiters will review it and be in touch. Thank you for applying!`,

  interview_invite: (p) =>
    `Hi ${p.name || "there"}! 🎉 You're invited to a *${p.interview_type || "interview"}* for the *${p.role}* role.\n\n` +
    `🗓 Date: ${p.date}\n⏰ Time: ${p.time}\n\n` +
    `Reply *YES* to confirm or *NO* if you need to reschedule.`,

  outcome_successful: (p) =>
    `Hi ${p.name || "there"}! 🎉 Great news — we'd like to offer you the *${p.role}* position. ` +
    `Our team will reach out shortly with the details. Congratulations!`,

  outcome_unsuccessful: (p) =>
    `Hi ${p.name || "there"}, thank you for your interest in the *${p.role}* role and for the time you spent with us. ` +
    `On this occasion we won't be moving forward, but we'll keep your details for future openings. We wish you all the best.`,

  hr_alert: (p) =>
    `⭐ Strong candidate alert: *${p.candidate}* scored ${p.score}% for *${p.role}*. ` +
    `Review them in PeopleQuest when you get a chance.`,

  portal_link: (p) =>
    `Hi ${p.name || "there"}! 👋 You're invited to apply for *${p.role}*. ` +
    `It takes about ${p.minutes || 8} minutes — CV upload + a short questionnaire.\n\n` +
    `Apply here: ${p.url}\n\n` +
    `Please complete it by ${p.expiry}.`,

  assessment_link: (p) =>
    `Hi ${p.name || "there"}! 👋 As part of your application for *${p.role}*, ` +
    `please complete a short personality questionnaire. It takes about ${p.minutes || 5} minutes — ` +
    `there are no right or wrong answers.\n\n` +
    `Complete it here: ${p.url}`,

  booking_link: (p) =>
    `Hi ${p.name || "there"}! 🎉 You're invited to interview for the *${p.role}* role. ` +
    `Pick a time that works for you:\n\n${p.url}`,

  booking_confirmed: (p) =>
    `Hi ${p.name || "there"}! ✅ Your *${p.role}* interview is confirmed for *${p.when}*. ` +
    `We look forward to speaking with you.`,
};

/** Build a message body from a template key + params. */
export function buildMessage(templateKey, params = {}) {
  const t = TEMPLATES[templateKey];
  return t ? t(params) : "";
}

/**
 * Send a WhatsApp message. Never throws — logs and returns a status object.
 */
export async function sendMessage(phone, body) {
  const to = formatMalaysianPhone(phone);
  if (!to) {
    logMessage("outbound", phone || "(none)", body, "no_phone");
    return { skipped: true, reason: "no_phone" };
  }
  if (!whatsappConfigured) {
    logMessage("outbound", to, body, "unconfigured");
    return { skipped: true, reason: "unconfigured" };
  }
  try {
    const msg = await client.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
    logMessage("outbound", to, body, msg.status || "sent", msg.sid);
    return { sid: msg.sid, status: msg.status };
  } catch (err) {
    logMessage("outbound", to, body, `failed: ${err.message}`);
    return { error: err.message };
  }
}

/** Convenience: build + send a templated message. */
export async function notify(phone, templateKey, params) {
  return sendMessage(phone, buildMessage(templateKey, params));
}

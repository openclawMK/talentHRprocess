/**
 * AI voice screening — a browser-based (no telephony) voice interview that
 * runs BEFORE the human interview stage, using OpenAI's Realtime API directly
 * from the candidate's browser via WebRTC. No Twilio: the browser connects
 * straight to OpenAI with a short-lived credential our backend mints, the
 * same pattern Growhire's own AI-phone-screen demo uses (confirmed by
 * inspecting its network traffic — it connects browser-to-vendor over
 * WebRTC, never dials an actual phone number).
 *
 * Scope: this stage exists ONLY to verify the role's Success Profile
 * (must-haves / nice-to-haves) and the candidate's CV claims — the evidence
 * that drives the 35% profile-fit score. It deliberately does NOT ask about
 * the role's competency criteria (leadership, conflict resolution, problem
 * solving, etc.) — those are the human interviewer's job in stage 2, scored
 * manually there. Asking about them here would duplicate that stage with a
 * lower-quality substitute rather than adding new evidence.
 */
import dotenv from "dotenv";
import { chatJSON } from "./aiClient.js";
dotenv.config();

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

function buildInstructions(job, candidate) {
  const candidateName = candidate?.profile?.name || candidate?.name || "";

  const req = job.requirements || {};
  const sp = job.successProfile || {};
  const responsibilities = (req.key_responsibilities || []).map((r) => `- ${r}`).join("\n");
  const mustHaves = (sp.must_haves || []).map((m) => `- ${m}`).join("\n");

  // This stage exists ONLY to verify Success-Profile fit (must-haves /
  // nice-to-haves) and CV claims — the same evidence that drives the 35%
  // profile-fit score. The role's competency criteria (leadership, conflict
  // resolution, problem-solving, etc.) are deliberately NOT this call's job —
  // those are scored by a human in the stage 2 interview, and asking about
  // them here would just duplicate that stage with a lower-quality version.
  const niceToHaves = (sp.nice_to_haves || []).map((n) => `- ${n}`).join("\n");
  const topics = [mustHaves, niceToHaves].filter(Boolean).join("\n") ||
    "- General background relevant to this role's must-haves";

  // The candidate's own CV, so the interviewer can question what they actually
  // claimed rather than only asking generic role questions. A CV is a set of
  // CLAIMS — the value of this call is testing whether they hold up, which is
  // what later feeds a more honest profile-fit score.
  const p = candidate?.profile || {};
  const yrs = p.total_experience_months != null ? Math.round((p.total_experience_months / 12) * 10) / 10 : null;
  const history = (p.work_history || [])
    .map((w) => {
      const bits = [w.title, w.employer && `at ${w.employer}`].filter(Boolean).join(" ");
      const extra = [
        w.team_size_managed ? `managed ${w.team_size_managed} staff` : null,
        (w.duties || []).length ? `duties: ${(w.duties || []).join(", ")}` : null,
      ].filter(Boolean).join("; ");
      return `- ${bits}${extra ? ` — ${extra}` : ""}`;
    })
    .join("\n");
  const cvBlock = [
    yrs != null ? `- Total experience: about ${yrs} years` : null,
    (p.skills || []).length ? `- Skills claimed: ${(p.skills || []).join(", ")}` : null,
    (p.education || []).length ? `- Education: ${(p.education || []).map((e) => [e.level, e.field].filter(Boolean).join(" ")).join("; ")}` : null,
    (p.certifications || []).length ? `- Certifications: ${(p.certifications || []).join(", ")}` : null,
    history ? `- Work history:\n${history}` : null,
  ].filter(Boolean).join("\n");

  return `You are an experienced, professional HR screening interviewer for People Hire, conducting a short voice screening call with a job candidate named ${candidateName || "the candidate"}.

ROLE YOU ARE HIRING FOR — know this well, you will be asked about it:
- Title: ${job.role_title}
- Company: ${job.company?.name || "the company"}
- Industry: ${job.industry || "not specified"}
- Location: ${job.location || "not specified"}
${responsibilities ? `- Day-to-day responsibilities:\n${responsibilities}` : ""}
${mustHaves ? `- What we're looking for:\n${mustHaves}` : ""}

${cvBlock ? `THIS CANDIDATE'S CV — everything here is a CLAIM they have made, not a verified fact:
${cvBlock}

HOW TO USE THE CV: spend roughly half your questions on their actual stated experience and half on the role itself. Reference specific things from their CV by name — a named employer, a specific skill, a duty they listed — and ask them to substantiate it with detail only someone who genuinely did it would know. If a claim is central to this role (for example supervising staff, handling cash, or a named system or certification), probe that one specifically. You are not trying to catch them out or interrogate them; you are giving them a fair chance to back up what they wrote. If they cannot substantiate a claim, or their answer contradicts their CV, do not argue — just note it and move on; the hiring team will weigh it.` : ""}

This is a SCREENING call before any human interview — plan for around 5 to 6 questions, and keep questions and follow-ups reasonably tight so the call doesn't drag, but there is no clock forcing you to cut anything short. If you are probing a serious concern the candidate raised (see red flags below), take whatever time is needed to get their answer — that matters more than staying brief. Speak English for this call. Never mention age, race, religion, gender, nationality, or marital status, and never ask about them.

YOUR INTERVIEWING STYLE — this matters as much as the questions:
- You are a discerning, professional interviewer, not a cheerleader. Do NOT praise or validate every answer by default ("great point", "that's excellent") — most real answers are just okay, and you should sound neutral or simply acknowledge them ("I see", "understood", "okay, thank you") unless an answer is genuinely strong.
- If an answer is VAGUE (generic, no specifics, doesn't actually answer what you asked), say so plainly and ask a direct follow-up ("Can you give me an actual example?" / "Walk me through a specific time this happened.").
- A CONCERNING ANSWER IS NOT THE SAME AS A VAGUE ONE, and must never be handled as if it were. If the candidate says something that would genuinely worry an employer — admitting they lose their temper with customers, humiliate or argue with people, ignore instructions, come to work late or drunk, steal, walk out of shifts, or anything unsafe, dishonest, or hostile — then:
    1. Do NOT respond with "that's a bit general" or ask for more detail as though the problem were clarity. The problem is what they said, not how they said it.
    2. Reflect it back plainly to confirm you understood, in a calm and non-judgemental way: "Just so I've understood you correctly — you're saying you get angry with customers and embarrass them?"
    3. Then ask ONE direct follow-up about that specific behaviour: what happened, how often, and what they would do differently.
    4. Never agree with it, never normalise it, never say it's understandable or fine. Stay professional and neutral in tone, but do not let it pass unexamined.
- Never invent agreement. If you disagree or the answer doesn't meet the role's needs, it's fine to simply move on without endorsing it.
- Speak naturally and at a normal pace, and always let the candidate finish their thought before you respond.
- Conduct the call in English. Candidates may answer in Malay or mix Malay and English — that is completely fine and must never count against them. Understand their answer fully in whichever language they use, and continue speaking English yourself. Judge WHAT they said, never their language or accent.

Cover these requirements, one question at a time — have a real adaptive conversation, not a rigid script. These are exactly what this role is checking a candidate for (must-haves first, nice-to-haves if time allows):
${topics}

DO NOT ask general competency or behavioural questions like "tell me about your leadership style" or "how do you handle conflict" — those belong to a separate human interview stage later and are not this call's job. Stay focused on whether the candidate genuinely has the specific things listed above.

TURN-TAKING — THIS IS A LIVE CONVERSATION, NOT A SCRIPT YOU READ OUT:
- Whenever you ask a question, STOP TALKING and wait for the candidate to answer it. Never answer your own question.
- Never combine asking a question with thanking them or ending the call in the same turn. Asking and closing are always two separate turns, with the candidate's answer in between.
- If the candidate stays silent for a while after a question, you may briefly re-prompt them once — but do not move on or close the call as though they had answered.

HOW TO OPEN AND CLOSE THE CALL:
1. Greet the candidate by name and briefly say this is a short voice screening for the ${job.role_title} role. Then ask your first question and wait.
2. Work through your questions, one at a time, waiting for each answer.
3. Once you've covered what you need, ask whether they have any questions about the role — then STOP and wait for their reply. Do not assume they have none.
4. If they ask something, answer briefly and factually using ONLY the role details given above (never invent salary, benefits, or details you weren't given — if you don't know, say the hiring team can answer that directly). Keep answering follow-ups until they confirm they have nothing further.
5. Once they've confirmed they have no more questions, thank them by name and let them know our HR team will review this and come back to them with the results. This is the last thing you say.
6. Immediately after you finish speaking step 5 — and not before — call the end_call tool. Never call it while a question you asked (yours or theirs) is still unanswered, and never call it in the same turn as your closing line; speak the line first, then call the tool.

There is no fixed time limit — take as long as the candidate needs to answer your questions and their own, including a follow-up on any concerning answer (see red flags below). Keep the pace natural and don't pad the conversation, but never rush a genuine answer to hit a target length. The only thing that ends the call is step 6 above.`;
}

/**
 * Mint a short-lived OpenAI Realtime client secret with this job's interview
 * brief baked into the session server-side — the candidate's browser only
 * ever sees the ephemeral token, never the system prompt construction logic
 * or the API key.
 */
export async function createVoiceScreenSession(job, candidate) {
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        audio: {
          output: { voice: REALTIME_VOICE },
          input: {
            // Input transcription must be explicitly enabled, or the
            // candidate's own speech never gets transcribed — only the
            // assistant's side would show up in the transcript.
            transcription: { model: "whisper-1" },
            // Without this, the model has no reliable signal that the
            // candidate has finished talking, so it never auto-responds —
            // this is what caused "the interviewer doesn't talk when I
            // respond". semantic_vad waits for a genuine pause in meaning,
            // not just silence, so it doesn't cut the candidate off mid-thought.
            turn_detection: { type: "semantic_vad" },
          },
        },
        instructions: buildInstructions(job, candidate),
        // The call ends when the MODEL decides it's actually over (closing
        // question answered + thank-you said), not on a fixed timer — a
        // timer was cutting the call before the candidate got to say they
        // had no more questions. See buildInstructions' closing sequence,
        // which tells the model exactly when it may call this.
        tools: [
          {
            type: "function",
            name: "end_call",
            description:
              "Ends the voice screening call. Call this exactly once, and only immediately after you have spoken your final closing line thanking the candidate — which itself only happens after they've confirmed they have no more questions about the role. Never call this while any question (yours or theirs) is still unanswered.",
            parameters: { type: "object", properties: {}, required: [] },
          },
        ],
        tool_choice: "auto",
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI Realtime session creation failed (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return { client_secret: data.value, expires_at: data.expires_at };
}

/**
 * First-pass assessment of a completed voice-screen transcript, evaluated
 * against the role's Success Profile must-haves/nice-to-haves — the same
 * evidence that drives the 35% profile-fit score — NOT the interview-source
 * competency criteria (those stay the human stage-2 interviewer's job).
 * The caller (portal.js) folds per-requirement scores from this into
 * evidence_overrides via successFit.js's applyVoiceScreenEvidence(), so a
 * confident result here actually moves the 35% profile-fit score.
 */
export async function summarizeVoiceScreen(job, transcript) {
  const sp = job.successProfile || {};
  const requirements = [...(sp.must_haves || []), ...(sp.nice_to_haves || [])];
  const system =
    "You are an HR analyst reviewing a transcript of an AI-conducted voice screening call whose purpose was " +
    "to verify the candidate's CV claims against this role's must-have and nice-to-have requirements. " +
    "Be specific and evidence-based, quoting or paraphrasing what the candidate actually said. " +
    "The transcript may contain Malay or mixed Malay-English — read it accurately and judge the SUBSTANCE " +
    "of what the candidate said, never their language, fluency, or accent. " +
    "Judge the CONTENT of each answer, not merely how detailed it was: an answer can be perfectly specific " +
    "and still be disqualifying. Do not reference gender, race, religion, nationality, age, or marital status. " +
    "Return valid JSON only.";
  const user = `Role: ${job.role_title} (${job.industry || ""})
This role's must-haves and nice-to-haves — score how well the candidate substantiated each one in the call:
${requirements.map((r) => `- ${r}`).join("\n") || "- General CV/experience verification"}

Transcript:
${transcript}

RED FLAGS — check for these FIRST, before scoring anything else. A red flag is the candidate
stating or admitting something that would genuinely worry an employer, for example: losing their
temper with customers, humiliating/arguing with people, dishonesty or theft, ignoring instructions,
lateness or absenteeism, walking out of shifts, being intoxicated at work, or anything unsafe or
hostile. Judge what they ACTUALLY said — an admission stated clearly and specifically is a red flag,
not a "good, detailed answer". If the candidate admits such behaviour, you MUST list it in red_flags
quoting their own words, and it must also pull down the score for any requirement it undermines.
If there are genuinely no red flags, return an empty array — do not invent them.

For each requirement, decide whether the candidate genuinely substantiated it in the call (gave
real, specific, credible detail), only partially/vaguely, explicitly admitted they don't have it,
or it simply wasn't covered in this call (score 50, note "not covered").

Return exactly:
{
  "summary": "2-3 sentence overview of how the candidate's CV claims held up to verification",
  "red_flags": [{ "quote": "<what the candidate actually said, translated to English if needed>", "why": "one sentence on why this is a serious concern for this role" }],
  "criteria_notes": [{ "criterion": "<the exact requirement text>", "score": <0-100>, "note": "one sentence, evidence-based" }],
  "strengths": [0-3 short bullet strings — empty array if the candidate genuinely showed none],
  "concerns": [0-3 short bullet strings]
}`;
  return chatJSON({ system, user, temperature: 0.2 });
}

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

/**
 * Shared OpenAI client + model name for all AI services
 * (CV parsing, scoring language, interview questions, comparison).
 *
 * Configure via backend/.env:
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_MODEL=gpt-4o
 */
export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Helper: call the chat completions API and return parsed JSON.
 * Uses JSON response_format so the model returns strict JSON.
 */
export async function chatJSON({ system, user, temperature = 0.2 }) {
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = completion.choices[0]?.message?.content || "{}";
  return JSON.parse(raw);
}

/**
 * Helper: call the chat completions API and return plain text
 * (used for the candidate comparison paragraph).
 */
export async function chatText({ system, user, temperature = 0.3 }) {
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

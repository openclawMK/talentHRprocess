import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { createRequire } from "module";
import { pdf as renderPdfPages } from "pdf-to-img";
import { openai, AI_MODEL } from "./aiClient.js";

// Import pdf-parse's inner lib directly to avoid the package's debug-mode
// behaviour (the index.js wrapper tries to read a bundled test PDF on import).
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const OCR_MAX_PAGES = 5;

/**
 * Fallback for scanned/image-only PDFs that have no text layer: rasterize
 * each page to an image and have the vision-capable model transcribe it.
 * Capped at OCR_MAX_PAGES so a huge scanned document can't balloon cost/time.
 */
async function ocrScannedPdf(filePath) {
  const pages = [];
  const doc = await renderPdfPages(filePath, { scale: 2.0 });
  for await (const page of doc) {
    pages.push(page);
    if (pages.length >= OCR_MAX_PAGES) break;
  }
  if (pages.length === 0) return "";

  const content = [
    {
      type: "text",
      text: "Transcribe ALL visible text from this scanned CV exactly as written, preserving line structure. Output plain text only, no commentary.",
    },
    ...pages.map((buf) => ({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${buf.toString("base64")}` },
    })),
  ];

  // The vision endpoint occasionally throws a transient 5xx (seen in
  // practice, unrelated to the input) — a plain retry clears it.
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: "user", content }],
      });
      return (completion.choices[0]?.message?.content || "")
        .trim()
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/\n?```$/, "")
        .trim();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/;

// pdf-parse's bundled legacy pdfjs build (v1.10.100) keeps shared
// module-level state that isn't cleanly torn down between calls — under
// load, two CVs parsed close together can corrupt each other and throw
// ("Illegal character: 41" / "bad XRef entry"), even though each PDF is
// perfectly valid on its own (confirmed: the same file re-parsed solo always
// succeeds). Serializing calls through this queue cuts the failure rate a
// lot but doesn't fully eliminate it — the corruption isn't a plain
// concurrent-access race, it's leftover state from the previous call. The
// real fix is swapping this library for one that isolates state per call;
// until then, retrying (below) converts the rare failure into a transparent
// retry instead of a user-facing error, since a retry always succeeds once
// the shared state has settled.
let pdfParseQueue = Promise.resolve();
function runPdfParseOnce(buffer) {
  const result = pdfParseQueue.then(() => pdfParse(buffer));
  pdfParseQueue = result.catch(() => {});
  return result;
}
async function runPdfParseSerialized(buffer, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await runPdfParseOnce(buffer);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Extract raw text from a CV file.
 *
 * @param {string} filePath - absolute or relative path to the uploaded file
 * @returns {Promise<{ text: string|null, confidence: number, unsupported?: boolean, message?: string }>}
 */
export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // Unsupported image formats — prototype only handles PDF/DOCX text.
  if ([".jpg", ".jpeg", ".png"].includes(ext)) {
    return {
      text: null,
      confidence: 0,
      unsupported: true,
      message:
        "Image CVs not supported in prototype — please upload PDF or DOCX",
    };
  }

  let text = "";

  if (ext === ".pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await runPdfParseSerialized(dataBuffer);
    text = data.text || "";
    text = text.trim();

    // No text layer at all — likely a scanned/image-only PDF. Fall back to
    // vision OCR rather than rejecting outright.
    if (text.length === 0) {
      try {
        text = await ocrScannedPdf(filePath);
      } catch (err) {
        console.error("OCR fallback failed:", err.message);
      }
    }
  } else if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    text = result.value || "";
  } else {
    return {
      text: null,
      confidence: 0,
      unsupported: true,
      message: "Unsupported file type — please upload a PDF or DOCX",
    };
  }

  text = text.trim();

  // Confidence heuristic. Zero extracted text means a scanned/image-only PDF
  // (or a genuinely empty file) — there's nothing for the AI to parse, so this
  // must fail the confidence gate outright rather than limp through at 70 and
  // produce a blank "Unnamed" candidate.
  let confidence = text.length === 0 ? 0 : 100;
  if (text.length > 0 && text.length < 200) confidence -= 20;
  if (text.length > 0 && !EMAIL_RE.test(text) && !PHONE_RE.test(text)) confidence -= 10;

  return { text, confidence };
}

import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import { createRequire } from "module";

// Import pdf-parse's inner lib directly to avoid the package's debug-mode
// behaviour (the index.js wrapper tries to read a bundled test PDF on import).
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

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

  // Confidence heuristic.
  let confidence = 100;
  if (text.length < 200) confidence -= 20;
  if (!EMAIL_RE.test(text) && !PHONE_RE.test(text)) confidence -= 10;

  return { text, confidence };
}

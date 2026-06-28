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
    const data = await pdfParse(dataBuffer);
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

/**
 * PDF candidate report (Session 12) — branded, shareable assessment document.
 * Clean flow layout: every block is measured before its background is drawn,
 * so nothing overflows its box and sections never overlap.
 */
import PDFDocument from "pdfkit";

const C = {
  primary: "#1E3A5F",
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
  grayBg: "#F9FAFB",
  line: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
};
const M = 48; // page margin

const recColor = (r) => (r === "HIRE" ? C.green : r === "REJECT" ? C.red : C.amber);
const scoreColor = (s) => (s == null ? C.muted : s >= 75 ? C.green : s >= 40 ? C.amber : C.red);
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const labelFor = (s) => (s == null ? "Pending" : s >= 75 ? "Strong" : s >= 60 ? "Good" : s >= 40 ? "Partial" : "Weak");

export function generateCandidateReport(candidate, job) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const p = candidate.profile || {};
      const s = candidate.score || {};
      const bd = candidate.score_breakdown || {};
      const rec = candidate.recommendation || null;
      const PW = doc.page.width;
      const W = PW - M * 2;
      const bottom = doc.page.height - M - 24;

      // ---- helpers ----
      const ensure = (need) => { if (doc.y + need > bottom) doc.addPage(); };
      const sectionTitle = (t) => {
        ensure(28);
        doc.fillColor(C.text).font("Helvetica-Bold").fontSize(13).text(t, M, doc.y);
        doc.moveDown(0.35);
      };
      const para = (t, opts = {}) => {
        const size = opts.size || 10;
        const color = opts.color || C.text;
        doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
        ensure(doc.heightOfString(t, { width: W }) + 4);
        doc.text(t, M, doc.y, { width: W });
      };
      const bullet = (t, color = C.text, dot = "•") => {
        doc.font("Helvetica").fontSize(9.5).fillColor(color);
        const h = doc.heightOfString(t, { width: W - 14 });
        ensure(h + 3);
        const y = doc.y;
        doc.fillColor(C.muted).text(dot, M, y, { width: 10 });
        doc.fillColor(C.text).text(t, M + 14, y, { width: W - 14 });
        doc.moveDown(0.15);
      };

      // ---- Header band ----
      doc.rect(0, 0, PW, 84).fill(C.primary);
      doc.circle(M + 17, 42, 17).fill("#FFFFFF");
      doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(13).text("PQ", M + 8, 35);
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(17).text("Candidate Assessment Report", M + 48, 28);
      doc.fillColor("#AFC3DA").font("Helvetica").fontSize(9).text("Confidential — For internal HR use only", M + 48, 52);
      doc.y = 104;

      // ---- Candidate info ----
      doc.fillColor(C.text).font("Helvetica-Bold").fontSize(19).text(p.name || "Candidate", M, doc.y, { width: W });
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(9.5).fillColor(C.muted);
      doc.text(`Applied for: ${job.role_title}  |  ${job.industry}`, { width: W });
      doc.text(`Application date: ${fmtDate(candidate.submitted_date)}      Report generated: ${fmtDate(new Date())}`, { width: W });
      doc.moveDown(0.8);

      // ---- Score summary box ----
      {
        const h = 58;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 8).fillAndStroke(C.grayBg, C.line);
        const combined = s.combined_score ?? 0;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.muted).text("COMBINED SCORE", M + 16, y + 12);
        doc.font("Helvetica-Bold").fontSize(24).fillColor(scoreColor(combined)).text(`${combined}%`, M + 16, y + 26);
        // mini bars on the right
        const rx = M + 150;
        const layers = [["CV Fit", bd.cv_fit?.score], ["Personality", bd.personality_fit?.score], ["Interview", bd.interview_result?.score]];
        let ly = y + 12;
        layers.forEach(([lbl, v]) => {
          doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(lbl, rx, ly, { width: 70, continued: false });
          const bw = W - 150 - 90;
          doc.roundedRect(rx + 80, ly + 2, bw, 6, 3).fill(C.line);
          if (v != null) doc.roundedRect(rx + 80, ly + 2, Math.max(2, (v / 100) * bw), 6, 3).fill(scoreColor(v));
          doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9).text(v != null ? `${v}%` : "Pending", rx + 80 + bw + 6, ly, { width: 60 });
          ly += 14;
        });
        doc.y = y + h + 14;
      }

      // ---- Recommendation box (measured) ----
      if (rec) {
        const rc = recColor(rec.recommendation);
        const innerW = W - 32;
        doc.font("Helvetica").fontSize(10);
        let bodyH = 0;
        const reasons = rec.reasons || [];
        const concerns = rec.concerns || [];
        bodyH += 14; // header line
        if (reasons.length) { bodyH += 14; reasons.forEach((r) => (bodyH += doc.heightOfString(`• ${r}`, { width: innerW }) + 2)); }
        if (concerns.length) { bodyH += 14; concerns.forEach((c) => (bodyH += doc.heightOfString(`• ${c}`, { width: innerW }) + 2)); }
        bodyH += 14 + doc.heightOfString(rec.next_action || "", { width: innerW });
        const h = bodyH + 28;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 10).lineWidth(1.5).fillAndStroke("#FFFFFF", rc);
        doc.lineWidth(1);
        let yy = y + 14;
        doc.font("Helvetica-Bold").fontSize(14).fillColor(rc).text(`RECOMMENDATION: ${rec.recommendation}`, M + 16, yy, { continued: true })
          .font("Helvetica").fontSize(10).fillColor(C.muted).text(`     Confidence: ${rec.confidence}`);
        yy += 24;
        if (reasons.length) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(C.text).text("Key reasons", M + 16, yy); yy += 13;
          reasons.forEach((r) => { doc.font("Helvetica").fontSize(9.5).fillColor(C.text).text(`• ${r}`, M + 16, yy, { width: innerW }); yy = doc.y + 2; });
        }
        if (concerns.length) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(C.amber).text("Concerns", M + 16, yy); yy += 13;
          concerns.forEach((c) => { doc.font("Helvetica").fontSize(9.5).fillColor(C.text).text(`• ${c}`, M + 16, yy, { width: innerW }); yy = doc.y + 2; });
        }
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#4338CA").text("Next action", M + 16, yy); yy += 13;
        doc.font("Helvetica").fontSize(9.5).fillColor(C.text).text(rec.next_action || "—", M + 16, yy, { width: innerW });
        doc.y = y + h + 16;
      }

      // ---- PAGE 2: Score breakdown ----
      doc.addPage();
      doc.y = M;
      sectionTitle("Score breakdown");
      const layer = (title, l) => {
        if (!l || l.status === "disabled") return;
        para(`${title} — ${l.score != null ? l.score + "% (" + (l.label || labelFor(l.score)) + ")" : "Pending"}`, { bold: true, color: scoreColor(l.score), size: 11 });
        doc.moveDown(0.1);
        (l.contributing_factors || []).forEach((f) => {
          const dot = f.impact === "positive" ? C.green : f.impact === "negative" ? C.red : f.impact === "partial" ? C.amber : C.muted;
          bullet(`${f.factor}: ${f.result}`, C.text, "");
          // colored impact dot
          doc.circle(M + 4, doc.y - 9, 2.2).fill(dot);
          doc.fillColor(C.text);
        });
        doc.moveDown(0.5);
      };
      layer("CV Fit", bd.cv_fit);
      layer("Personality Fit", bd.personality_fit);
      layer("Interview Result", bd.interview_result);

      // ---- Strengths / Risks / Missing (stacked, full-width) ----
      doc.moveDown(0.3);
      const block = (title, items, color, empty) => {
        sectionTitleColored(doc, title, color, W);
        if (!items || !items.length) { para(empty, { color: C.muted, size: 9 }); }
        else items.forEach((it) => bullet(it));
        doc.moveDown(0.4);
      };
      block("Strengths", bd.strengths, C.green, "None noted.");
      block("Risks", bd.risks, C.amber, "No major risks flagged.");
      block("Missing evidence", bd.missing_evidence, C.muted, "Nothing outstanding.");

      // ---- Candidate background ----
      doc.moveDown(0.2);
      sectionTitle("Candidate background");
      para("Work history", { bold: true, size: 10, color: C.muted });
      (p.work_history || []).forEach((w) => {
        const dur = w.duration_months ? ` (${Math.floor(w.duration_months / 12)}y ${w.duration_months % 12}m)` : "";
        bullet(`${w.title || ""} — ${w.employer || ""}${dur}`);
      });
      doc.moveDown(0.2);
      para("Education", { bold: true, size: 10, color: C.muted });
      (p.education || []).forEach((e) => bullet(`${e.level || ""}${e.institution ? " — " + e.institution : ""}${e.year ? " (" + e.year + ")" : ""}`));
      doc.moveDown(0.2);
      para("Key skills", { bold: true, size: 10, color: C.muted });
      para((p.skills || []).join(", ") || "—", { size: 9.5, color: C.text });

      // ---- Footer on every page ----
      // Writing in the bottom-margin area makes pdfkit auto-spawn blank pages,
      // so temporarily drop the bottom margin to 0 while drawing footers.
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const fy = doc.page.height - 30;
        doc.font("Helvetica").fontSize(8).fillColor(C.muted)
          .text("Generated by PeopleQuest Talent AI  |  Confidential", M, fy, { width: W / 2, lineBreak: false });
        doc.text(`Page ${i + 1} of ${range.count}`, M + W / 2, fy, { width: W / 2, align: "right", lineBreak: false });
        doc.page.margins.bottom = savedBottom;
      }

      doc.flushPages();
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sectionTitleColored(doc, t, color, W) {
  const M2 = 48;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(color).text(t, M2, doc.y, { width: W });
  doc.moveDown(0.2);
}

/**
 * PDF candidate report (Session 12) — branded, shareable assessment document.
 */
import PDFDocument from "pdfkit";

const C = {
  primary: "#1E3A5F",
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
  gray: "#F9FAFB",
  text: "#111827",
  muted: "#6B7280",
  line: "#E5E7EB",
};

const recColor = (rec) =>
  rec === "HIRE" ? C.green : rec === "REJECT" ? C.red : C.amber;
const scoreColor = (s) =>
  s == null ? C.muted : s >= 75 ? C.green : s >= 40 ? C.amber : C.red;

const M = 50; // page margin

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * @returns {Promise<Buffer>}
 */
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
      const W = doc.page.width - M * 2;

      // ---- Header band ----
      doc.rect(0, 0, doc.page.width, 90).fill(C.primary);
      doc.circle(M + 18, 45, 18).fill("#FFFFFF");
      doc.fillColor(C.primary).fontSize(14).font("Helvetica-Bold").text("PQ", M + 8, 38);
      doc.fillColor("#FFFFFF").fontSize(18).font("Helvetica-Bold").text("Candidate Assessment Report", M + 50, 30);
      doc.fillColor("#BFD3E6").fontSize(9).font("Helvetica").text("Confidential — For internal HR use only", M + 50, 54);
      doc.y = 110;
      doc.fillColor(C.text);

      // ---- Candidate info ----
      doc.fontSize(20).font("Helvetica-Bold").text(p.name || "Candidate", M, doc.y);
      doc.fontSize(10).font("Helvetica").fillColor(C.muted);
      doc.text(`Applied for: ${job.role_title}  |  ${job.industry}`);
      doc.text(`Application date: ${fmtDate(candidate.submitted_date)}     Report generated: ${fmtDate(new Date())}`);
      doc.moveDown(0.8);
      doc.fillColor(C.text);

      // ---- Score summary box ----
      const boxY = doc.y;
      doc.roundedRect(M, boxY, W, 56, 6).strokeColor(C.line).stroke();
      doc.fontSize(11).font("Helvetica-Bold").fillColor(C.text).text("Combined Score", M + 14, boxY + 10);
      const combined = s.combined_score ?? 0;
      doc.fontSize(22).fillColor(scoreColor(combined)).text(`${combined}%`, M + 14, boxY + 24);
      doc.fontSize(9).font("Helvetica").fillColor(C.muted).text(
        `CV Fit: ${bd.cv_fit?.score ?? "—"}%    Personality: ${bd.personality_fit?.score ?? "Pending"}${bd.personality_fit?.score != null ? "%" : ""}    Interview: ${bd.interview_result?.score ?? "Pending"}${bd.interview_result?.score != null ? "%" : ""}`,
        M + 160, boxY + 24, { width: W - 170 }
      );
      doc.y = boxY + 70;
      doc.fillColor(C.text);

      // ---- Recommendation box ----
      if (rec) {
        const ry = doc.y;
        const rc = recColor(rec.recommendation);
        const h = 24 + (rec.reasons?.length || 0) * 13 + (rec.concerns?.length || 0) * 13 + 40;
        doc.roundedRect(M, ry, W, h, 6).lineWidth(2).strokeColor(rc).stroke();
        doc.lineWidth(1);
        doc.fontSize(13).font("Helvetica-Bold").fillColor(rc).text(`RECOMMENDATION: ${rec.recommendation}`, M + 14, ry + 12);
        doc.fontSize(9).font("Helvetica").fillColor(C.muted).text(`Confidence: ${rec.confidence}`, M + 14, ry + 30);
        let yy = ry + 46;
        if (rec.reasons?.length) {
          doc.fontSize(9).font("Helvetica-Bold").fillColor(C.text).text("Key reasons:", M + 14, yy);
          yy += 13;
          rec.reasons.forEach((r) => {
            doc.font("Helvetica").fillColor(C.text).text(`• ${r}`, M + 20, yy, { width: W - 40 });
            yy = doc.y + 2;
          });
        }
        if (rec.concerns?.length) {
          doc.font("Helvetica-Bold").fillColor(C.amber).text("Concerns:", M + 14, yy);
          yy += 13;
          rec.concerns.forEach((c) => {
            doc.font("Helvetica").fillColor(C.text).text(`• ${c}`, M + 20, yy, { width: W - 40 });
            yy = doc.y + 2;
          });
        }
        doc.font("Helvetica-Bold").fillColor(C.text).text(`Next action: ${rec.next_action}`, M + 14, yy + 2, { width: W - 28 });
        doc.y = Math.max(doc.y, yy) + 16;
      }

      // ---- PAGE 2: breakdown ----
      doc.addPage();
      doc.fillColor(C.text).fontSize(14).font("Helvetica-Bold").text("Score Breakdown", M, doc.y);
      doc.moveDown(0.4);

      const layer = (title, l) => {
        if (!l) return;
        doc.fontSize(11).font("Helvetica-Bold").fillColor(scoreColor(l.score))
          .text(`${title} — ${l.score != null ? l.score + "% (" + l.label + ")" : l.label}`, M, doc.y);
        (l.contributing_factors || []).forEach((f) => {
          const dot = f.impact === "positive" ? C.green : f.impact === "negative" ? C.red : f.impact === "partial" ? C.amber : C.muted;
          doc.circle(M + 4, doc.y + 5, 2.5).fill(dot);
          doc.fontSize(9).font("Helvetica").fillColor(C.text).text(`${f.factor}: ${f.result}`, M + 14, doc.y, { width: W - 14 });
          doc.moveDown(0.2);
        });
        doc.moveDown(0.5);
      };
      layer("CV Fit", bd.cv_fit);
      layer("Personality Fit", bd.personality_fit);
      layer("Interview Result", bd.interview_result);

      // ---- Strengths / Risks / Missing ----
      doc.moveDown(0.3);
      const colW = (W - 20) / 3;
      const colY = doc.y;
      const drawCol = (x, title, items, color) => {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(color).text(title, x, colY, { width: colW });
        let yy = colY + 16;
        (items || []).forEach((it) => {
          doc.fontSize(8.5).font("Helvetica").fillColor(C.text).text(`• ${it}`, x, yy, { width: colW });
          yy = doc.y + 3;
        });
        return yy;
      };
      const e1 = drawCol(M, "STRENGTHS", bd.strengths, C.green);
      const e2 = drawCol(M + colW + 10, "RISKS", bd.risks, C.amber);
      const e3 = drawCol(M + (colW + 10) * 2, "MISSING EVIDENCE", bd.missing_evidence, C.muted);
      doc.y = Math.max(e1, e2, e3) + 12;

      // ---- Candidate background ----
      doc.fillColor(C.text).fontSize(12).font("Helvetica-Bold").text("Candidate Background", M, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(C.muted).text("Work History");
      (p.work_history || []).forEach((w) => {
        const dur = w.duration_months ? `${Math.floor(w.duration_months / 12)}y ${w.duration_months % 12}m` : "";
        doc.font("Helvetica").fillColor(C.text).fontSize(9).text(`• ${w.title || ""} — ${w.employer || ""} ${dur ? "(" + dur + ")" : ""}`, { width: W });
      });
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fillColor(C.muted).text("Education");
      (p.education || []).forEach((e) => {
        doc.font("Helvetica").fillColor(C.text).text(`• ${e.level || ""}${e.institution ? " — " + e.institution : ""}${e.year ? " (" + e.year + ")" : ""}`, { width: W });
      });
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fillColor(C.muted).text("Key Skills");
      doc.font("Helvetica").fillColor(C.text).text((p.skills || []).join(", ") || "—", { width: W });

      // ---- Footer on every page ----
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const fy = doc.page.height - 35;
        doc.fontSize(8).font("Helvetica").fillColor(C.muted)
          .text("Generated by PeopleQuest Talent AI  |  Confidential", M, fy, { width: W / 2 });
        doc.text(`Page ${i + 1} of ${range.count}`, M + W / 2, fy, { width: W / 2, align: "right" });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

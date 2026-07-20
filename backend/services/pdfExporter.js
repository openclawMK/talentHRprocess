/**
 * PDF candidate report — branded, shareable assessment document.
 * Clean flow layout: every block is measured before its background is drawn,
 * so nothing overflows its box and sections never overlap.
 *
 * Redesign goal: this used to only restate the three headline scores. It now
 * pulls in everything the app already computes for this candidate — Success
 * Profile checklist, OCEAN alignment, budget fit, pre-hire checks, HR notes —
 * so the PDF stands on its own as the actual evidence pack, not a summary of
 * one.
 */
import PDFDocument from "pdfkit";
import { computeSuccessFit } from "./successFit.js";
import { HIRE_THRESHOLD } from "./composite.js";

const C = {
  primary: "#1E3A5F",
  violet: "#7C3AED",
  blue: "#2563C9",
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

// Budget-fit and pre-hire-check lanes both use this palette — one mapping,
// reused everywhere a status needs a colour.
const LANE_COLOR = { green: C.green, blue: C.blue, amber: C.amber, red: C.red, neutral: C.muted };
const LANE_BG = { green: "#ECFDF5", blue: "#EFF6FF", amber: "#FFFBEB", red: "#FEF2F2", neutral: C.grayBg };
const CHECK_COLOR = { clear: C.green, flagged: C.red, pending: C.muted };
const CHECK_LABEL = { clear: "Clear", flagged: "Flagged", pending: "Pending" };

// Small inline pill — measures its own width so callers can place text after it.
function pillWidth(doc, label) {
  doc.font("Helvetica-Bold").fontSize(8.5);
  return doc.widthOfString(label) + 14;
}
function drawPill(doc, x, y, label, color, bg) {
  doc.font("Helvetica-Bold").fontSize(8.5);
  const w = doc.widthOfString(label) + 14;
  doc.roundedRect(x, y, w, 15, 7.5).fill(bg);
  doc.fillColor(color).text(label, x + 7, y + 3.5);
  return w;
}

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
      const fit = computeSuccessFit(candidate, job); // must-haves, nice-to-haves, dealbreakers, OCEAN alignment, budget fit
      const hireBar = job.thresholds?.green ?? HIRE_THRESHOLD;
      const PW = doc.page.width;
      const W = PW - M * 2;
      const bottom = doc.page.height - M - 24;

      // ---- helpers ----
      const ensure = (need) => { if (doc.y + need > bottom) doc.addPage(); };
      const sectionTitle = (t, color = C.text) => {
        ensure(28);
        doc.rect(M, doc.y + 1, 4, 13).fill(color);
        doc.fillColor(C.text).font("Helvetica-Bold").fontSize(13).text(t, M + 12, doc.y);
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
      // A met/not-met checklist line — for must-haves, nice-to-haves, benchmarks.
      // Uses a drawn dot rather than a ✓/✗ glyph: PDFKit's built-in Helvetica is
      // WinAnsi-only, so Unicode check/cross marks silently render as garbage
      // (this is why the rest of the file already signals status with colour +
      // drawn shapes, e.g. the contributing-factor dots below — same reasoning).
      const checkLine = (t, met) => {
        const color = met ? C.green : C.red;
        const h = doc.heightOfString(t, { width: W - 16 });
        ensure(h + 3);
        const y = doc.y;
        doc.circle(M + 5, y + 5, 4).fill(color);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(color).text(met ? "Met" : "Missing", M + 16, y, { continued: false, width: 60 });
        doc.font("Helvetica").fontSize(9.5).fillColor(C.text).text(t, M + 66, y, { width: W - 66 });
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
      const contactLine = [p.contact?.email, p.contact?.phone, p.contact?.location].filter(Boolean).join("  ·  ");
      if (contactLine) doc.text(contactLine, { width: W });
      doc.text(`Application date: ${fmtDate(candidate.submitted_date)}      Report generated: ${fmtDate(new Date())}`, { width: W });
      doc.moveDown(0.6);

      // ---- Low-confidence CV parse warning ----
      if (candidate.low_confidence_warning) {
        const msg = `This CV was hard to parse clearly (confidence ${candidate.parse_confidence_overall ?? "—"}%). Some fields below may be incomplete or approximate — worth a manual check against the original CV.`;
        doc.font("Helvetica").fontSize(9);
        const h = doc.heightOfString(msg, { width: W - 32 }) + 16;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 8).fillAndStroke("#FFFBEB", C.amber);
        doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(9).text("Low parse confidence", M + 14, y + 8);
        doc.fillColor(C.text).font("Helvetica").fontSize(9).text(msg, M + 14, y + 20, { width: W - 28 });
        doc.y = y + h + 14;
      }

      // ---- Score summary box (gauge + three layer bars) ----
      {
        const barX = M + 150, barW = W - 150 - 90;
        const h = 100;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 8).fillAndStroke(C.grayBg, C.line);

        const combined = s.combined_score ?? 0;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.muted).text("COMBINED SCORE", M + 16, y + 14);
        doc.font("Helvetica-Bold").fontSize(26).fillColor(scoreColor(combined)).text(`${combined}%`, M + 16, y + 28);

        // Gauge bar for the combined score, with a hire-bar tick mark.
        const gaugeY = y + 18, gaugeH = 13;
        doc.roundedRect(barX, gaugeY, barW, gaugeH, 6).fill(C.line);
        doc.roundedRect(barX, gaugeY, Math.max(4, (combined / 100) * barW), gaugeH, 6).fill(scoreColor(combined));
        const tickX = barX + (Math.min(100, hireBar) / 100) * barW;
        doc.moveTo(tickX, gaugeY - 3).lineTo(tickX, gaugeY + gaugeH + 3).lineWidth(1.5).strokeColor(C.text).stroke();
        doc.font("Helvetica").fontSize(7.5).fillColor(C.muted).text(`Hire bar ${hireBar}`, tickX - 24, gaugeY - 13, { width: 60, align: "center" });

        // Three layer bars underneath the gauge — label sits left of ITS OWN
        // bar (barX + a fixed offset), not under the big combined-score number
        // in the left column, so the two never overlap regardless of font
        // metrics.
        const miniBarX = barX + 80, miniBarW = barW - 80;
        const layers = [["CV Fit", bd.cv_fit?.score], ["Personality", bd.personality_fit?.score], ["Interview", bd.interview_result?.score]];
        let ly = y + 48;
        layers.forEach(([lbl, v]) => {
          doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(lbl, barX, ly, { width: 70 });
          doc.roundedRect(miniBarX, ly + 1, miniBarW, 6, 3).fill(C.line);
          if (v != null) doc.roundedRect(miniBarX, ly + 1, Math.max(2, (v / 100) * miniBarW), 6, 3).fill(scoreColor(v));
          doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9).text(v != null ? `${v}%` : "Pending", miniBarX + miniBarW + 6, ly, { width: 60 });
          ly += 14;
        });
        doc.y = y + h + 14;
      }

      // ---- Salary & budget fit ----
      if (fit?.budget && fit.budget.status !== "unknown") {
        const b = fit.budget;
        const lane = LANE_COLOR[b.lane] || C.muted;
        const h = 40;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 8).fillAndStroke("#FFFFFF", C.line);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(C.muted).text("SALARY & BUDGET FIT", M + 16, y + 10);
        const line = b.has_budget ? `Asking ${b.expected_label}  ·  Budget ${b.range_label}` : `Asking ${b.expected_label} — no budget set for this role`;
        doc.font("Helvetica").fontSize(10.5).fillColor(C.text).text(line, M + 16, y + 22, { width: W - 180 });
        const pw = pillWidth(doc, b.label);
        drawPill(doc, M + W - 16 - pw, y + 20, b.label, lane, LANE_BG[b.lane] || C.grayBg);
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

      // ---- Decision & sign-off ----
      // The AI advises; the hiring decision itself is made by a person. This
      // strip exists so a printed copy carries a place to record that.
      {
        const h = 46;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 8).dash(2, { space: 2 }).lineWidth(1).stroke(C.line).undash();
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.muted).text("DECISION & SIGN-OFF", M + 16, y + 10);
        doc.font("Helvetica").fontSize(9).fillColor(C.muted).text("Final hiring decision", M + 16, y + 26, { width: 130 });
        doc.moveTo(M + 150, y + 34).lineTo(M + 320, y + 34).strokeColor(C.line).stroke();
        doc.text("Decided by", M + 340, y + 26, { width: 80 });
        doc.moveTo(M + W - 90, y + 34).lineTo(M + W - 16, y + 34).strokeColor(C.line).stroke();
        doc.y = y + h + 14;
      }

      // ---- PAGE 2: Score breakdown ----
      doc.addPage();
      doc.y = M;
      sectionTitle("Score breakdown", C.violet);
      const layer = (title, l) => {
        if (!l || l.status === "disabled") return;
        para(`${title} — ${l.score != null ? l.score + "% (" + (l.label || labelFor(l.score)) + ")" : "Pending"}`, { bold: true, color: scoreColor(l.score), size: 11 });
        doc.moveDown(0.1);
        (l.contributing_factors || []).forEach((f) => {
          const dot = f.impact === "positive" ? C.green : f.impact === "negative" ? C.red : f.impact === "partial" ? C.amber : C.muted;
          bullet(`${f.factor}: ${f.result}`, C.text, "");
          doc.circle(M + 4, doc.y - 9, 2.2).fill(dot);
          doc.fillColor(C.text);
        });
        doc.moveDown(0.5);
      };
      layer("CV Fit", bd.cv_fit);

      // Success Profile checklist — what "meets the bar" actually meant for
      // this role, right where CV Fit is discussed.
      if (fit && (fit.must_haves.length || fit.nice_to_haves.length || fit.dealbreakers.length)) {
        para("Success Profile checklist", { bold: true, size: 9.5, color: C.muted });
        doc.moveDown(0.1);
        fit.must_haves.forEach((m) => checkLine(`Must-have: ${m.text}`, m.met));
        fit.nice_to_haves.forEach((n) => checkLine(`Nice-to-have: ${n.text}`, n.met));
        fit.dealbreakers.forEach((d) => {
          if (d.triggered) bullet(`Dealbreaker triggered: ${d.text}`, C.red);
        });
        doc.moveDown(0.4);
      }

      layer("Personality Fit", bd.personality_fit);

      // Raw OCEAN trait alignment, supplementing the summarised bullets above.
      if (fit?.ocean?.length) {
        para("OCEAN alignment (target for this role)", { bold: true, size: 9.5, color: C.muted });
        doc.moveDown(0.1);
        fit.ocean.forEach((o) => bullet(`${o.trait}: ${o.actual ?? "—"} (target: ${o.ideal}) — ${o.match ? "on target" : "off target"}`, o.match ? C.text : C.muted, ""));
        doc.moveDown(0.4);
      }

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

      // ---- Pre-hire checks ----
      const checks = candidate.pre_hire_checks || {};
      const checkKeys = Object.keys(checks).filter((k) => checks[k]?.status);
      if (checkKeys.length) {
        sectionTitle("Pre-hire checks", C.blue);
        checkKeys.forEach((k) => {
          const c = checks[k];
          const color = CHECK_COLOR[c.status] || C.muted;
          const label = k.charAt(0).toUpperCase() + k.slice(1);
          const line = `${label}: ${CHECK_LABEL[c.status] || c.status}${c.updated ? ` (updated ${fmtDate(c.updated)})` : ""}`;
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor(color);
          ensure(doc.heightOfString(line, { width: W }) + 4);
          doc.text(line, M, doc.y, { width: W });
          if (c.notes) para(c.notes, { size: 9, color: C.muted });
          doc.moveDown(0.25);
        });
        doc.moveDown(0.3);
      }

      // ---- HR notes ----
      if (candidate.hr_notes_list?.length) {
        sectionTitle("HR notes", C.text);
        candidate.hr_notes_list.forEach((n) => bullet(`${fmtDate(n.date)} — ${n.text}`));
        doc.moveDown(0.3);
      }

      // ---- Candidate background ----
      doc.moveDown(0.2);
      sectionTitle("Candidate background", C.green);
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
  doc.rect(M2, doc.y + 1, 4, 13).fill(color);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(color).text(t, M2 + 12, doc.y, { width: W - 12 });
  doc.moveDown(0.2);
}

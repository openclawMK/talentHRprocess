/**
 * PDF candidate report — branded, shareable assessment document.
 * Clean flow layout: every block is measured before its background is drawn,
 * so nothing overflows its box and sections never overlap.
 *
 * Visual design matches the client-approved mockup ("New report design"):
 * light-tinted colour blocks instead of a solid header band, a HIRE/HOLD/
 * REJECT pill, a combined-score gauge with a hire-bar tick, paired Key
 * Reasons / Concerns cards, and progress-bar style factor breakdowns on
 * page 2. Content strategy is unchanged from the prior redesign — Success
 * Profile checklist, OCEAN alignment, budget fit, pre-hire checks, HR notes
 * all still flow in — only the rendering changed.
 *
 * Font note: the mockup uses a rounded geometric sans (reads like Inter or
 * Poppins). This renders with PDFKit's built-in Helvetica family instead —
 * zero new dependencies and no font-encoding risk. Swapping in a real
 * embedded font later (doc.registerFont) is a contained follow-up if an
 * exact match is wanted.
 */
import PDFDocument from "pdfkit";
import { computeSuccessFit } from "./successFit.js";
import { HIRE_THRESHOLD } from "./composite.js";

const C = {
  ink: "#111827",
  navy: "#1E293B",
  muted: "#6B7280",
  mutedLight: "#9CA3AF",
  line: "#E5E7EB",
  blue: "#2563C9",
  teal: "#0D9488",
  amber: "#B45309",
  green: "#059669",
  red: "#DC2626",
  greenBg: "#EDF7F2", greenBorder: "#CFE8DA",
  amberBg: "#FDF3E3", amberBorder: "#F3DFB8",
  blueBg: "#EAF1FC", blueBorder: "#CFE0F7",
  redBg: "#FEF2F2", redBorder: "#FECACA",
  grayBg: "#F3F4F6",
};
const M = 48; // page margin

const recColor = (r) => (r === "HIRE" ? C.green : r === "REJECT" ? C.red : C.amber);
const recBg = (r) => (r === "HIRE" ? C.greenBg : r === "REJECT" ? C.redBg : C.amberBg);
const scoreColor = (s) => (s == null ? C.muted : s >= 75 ? C.green : s >= 40 ? C.amber : C.red);
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const labelFor = (s) => (s == null ? "Pending" : s >= 75 ? "Strong" : s >= 60 ? "Good" : s >= 40 ? "Partial" : "Weak");

// Illustrative fill for a contributing-factor bar. These bars communicate
// "how strong was this factor", not a parsed statistic — contributing_factors
// are free-form AI text with no structured ratio, so a fixed banding per
// impact tier is the honest, robust choice rather than regex-guessing a
// percentage out of arbitrary phrasing.
const IMPACT_FILL = { positive: 0.94, partial: 0.55, negative: 0.18, neutral: 0.5 };

// OCEAN bars are emphasised (teal) when the role's ideal for that trait is
// high/medium-high — i.e. traits the role actively wants more of — and muted
// (gray) when the ideal is medium/low, since those aren't meant to be
// maximised. Matches the approved mockup's colouring exactly.
const EMPHASISED_TARGETS = new Set(["high", "medium-high"]);

const LANE_COLOR = { green: C.green, blue: C.blue, amber: C.amber, red: C.red, neutral: C.muted };
const LANE_BG = { green: C.greenBg, blue: C.blueBg, amber: C.amberBg, red: C.redBg, neutral: C.grayBg };
const CHECK_COLOR = { clear: C.green, flagged: C.red, pending: C.muted };
const CHECK_LABEL = { clear: "Clear", flagged: "Flagged", pending: "Pending" };

// Rotating pastel palette for skill-tag pills.
const TAG_PALETTE = [
  { bg: C.blueBg, text: C.blue },
  { bg: C.greenBg, text: C.green },
  { bg: C.amberBg, text: C.amber },
  { bg: "#E6F7F5", text: C.teal },
  { bg: "#F3EAFB", text: "#7C3AED" },
];

function pillWidth(doc, label, fontSize = 8.5) {
  doc.font("Helvetica-Bold").fontSize(fontSize);
  return doc.widthOfString(label) + 16;
}
function drawPill(doc, x, y, label, color, bg, fontSize = 8.5) {
  doc.font("Helvetica-Bold").fontSize(fontSize);
  const w = doc.widthOfString(label) + 16;
  doc.roundedRect(x, y, w, 18, 9).fill(bg);
  doc.fillColor(color).text(label, x + 8, y + 5);
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
      const bottom = doc.page.height - M - 22;

      // ---- helpers ----
      const ensure = (need) => { if (doc.y + need > bottom) doc.addPage(); };
      const caps = (t, opts = {}) => {
        doc.font("Helvetica-Bold").fontSize(opts.size || 8.5).fillColor(opts.color || C.mutedLight);
        doc.text(t.toUpperCase(), M, doc.y, { width: W, characterSpacing: 0.4 });
      };
      const sectionTitle = (t) => {
        ensure(26);
        doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(15).text(t, M, doc.y, { width: W });
        doc.moveDown(0.4);
      };
      const para = (t, opts = {}) => {
        const size = opts.size || 10;
        const color = opts.color || C.ink;
        doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
        ensure(doc.heightOfString(t, { width: opts.width || W }) + 4);
        doc.text(t, M, doc.y, { width: opts.width || W });
      };
      const bullet = (t, color = C.ink, opts = {}) => {
        const width = opts.width || W - 14;
        doc.font("Helvetica").fontSize(9.5).fillColor(color);
        const h = doc.heightOfString(t, { width: width - 14 });
        ensure(h + 4);
        const y = doc.y;
        doc.circle(M + 4, y + 5, 1.6).fill(color === C.ink ? C.mutedLight : color);
        doc.fillColor(color).text(t, M + 14, y, { width: width - 14 });
        doc.moveDown(0.2);
      };
      // A met/not-met checklist line. Uses a filled-vs-outlined dot rather than
      // a ✓/✗ glyph: PDFKit's built-in Helvetica is WinAnsi-only, so Unicode
      // check/cross marks silently render as garbage. A filled dot reads as
      // "present", a hollow one as "missing" — same information, zero risk.
      const checkItem = (x, y, w, text, met) => {
        const color = met ? C.green : C.red;
        if (met) doc.circle(x + 4, y + 5, 4).fill(color);
        else doc.circle(x + 4, y + 5, 4).lineWidth(1.2).stroke(color);
        doc.font("Helvetica").fontSize(9.5).fillColor(C.ink).text(text, x + 14, y, { width: w - 14 });
      };
      // A horizontal progress bar with a label above and a value/context line
      // to the right of the label — the page-2 factor/trait bar pattern.
      const factorBar = (label, rightText, ratio, color) => {
        const h = 30;
        ensure(h + 4);
        const y = doc.y;
        doc.font("Helvetica").fontSize(9.5).fillColor(C.ink).text(label, M, y, { width: W * 0.5 });
        doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(rightText, M, y, { width: W, align: "right" });
        doc.roundedRect(M, y + 15, W, 6, 3).fill(C.line);
        doc.roundedRect(M, y + 15, Math.max(3, Math.min(1, ratio) * W), 6, 3).fill(color);
        doc.y = y + h;
      };

      // =========================================================
      // PAGE 1
      // =========================================================

      // ---- Header ----
      doc.y = M - 8;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.navy).text("PEOPLEQUEST TALENT AI", M, doc.y, { characterSpacing: 0.6 });
      const confLabel = "CONFIDENTIAL — INTERNAL HR USE ONLY";
      doc.font("Helvetica-Bold").fontSize(7.5);
      // widthOfString() doesn't account for characterSpacing, so pad extra
      // room for it here rather than measuring one width and rendering a
      // wider one — that mismatch is what wrapped this pill to two lines.
      const confW = doc.widthOfString(confLabel) + confLabel.length * 0.3 + 20;
      doc.roundedRect(M + W - confW, doc.y - 12, confW, 20, 10).lineWidth(1).stroke(C.line);
      doc.fillColor(C.muted).text(confLabel, M + W - confW + 10, doc.y - 7, { characterSpacing: 0.3, lineBreak: false });
      doc.moveDown(1.4);
      doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(1.5).strokeColor(C.navy).stroke();
      doc.moveDown(0.9);

      caps("Candidate Assessment Report");
      doc.moveDown(0.25);
      const nameY = doc.y;
      doc.font("Helvetica-Bold").fontSize(24).fillColor(C.ink).text(p.name || "Candidate", M, nameY);

      // Right-aligned mixed-weight line. PDFKit's `continued` chaining doesn't
      // combine reliably with `align` (each segment tries to align itself
      // independently, producing overlapping text) — so the block is measured
      // up front and drawn from a computed absolute start-x instead.
      const dateSegs = [
        ["Application date ", "Helvetica", C.muted], [fmtDate(candidate.submitted_date), "Helvetica-Bold", C.ink],
        ["   ·   Report generated ", "Helvetica", C.muted], [fmtDate(new Date()), "Helvetica-Bold", C.ink],
      ];
      doc.fontSize(9.5);
      const dateTotalW = dateSegs.reduce((sum, [t, f]) => sum + doc.font(f).widthOfString(t), 0);
      let dateX = M + W - dateTotalW;
      const dateY = nameY + 6;
      dateSegs.forEach(([t, f, color]) => {
        doc.font(f).fillColor(color).text(t, dateX, dateY, { lineBreak: false });
        dateX += doc.widthOfString(t);
      });
      doc.y = nameY + 30;
      doc.font("Helvetica").fontSize(10.5).fillColor(C.muted).text("Applied for: ", M, doc.y, { continued: true })
        .font("Helvetica-Bold").fillColor(C.ink).text(job.role_title, { continued: true })
        .font("Helvetica").fillColor(C.muted).text(`  ·  ${job.industry}`);
      const contactLine = [p.contact?.email, p.contact?.phone, p.contact?.location].filter(Boolean).join("   ·   ");
      if (contactLine) { doc.moveDown(0.15); doc.font("Helvetica").fontSize(9.5).fillColor(C.muted).text(contactLine, { width: W }); }
      doc.moveDown(0.7);

      // ---- Low-confidence CV parse warning ----
      if (candidate.low_confidence_warning) {
        const msg = `This CV was hard to parse clearly (confidence ${candidate.parse_confidence_overall ?? "—"}%). Some fields below may be incomplete or approximate — worth a manual check against the original CV.`;
        doc.font("Helvetica").fontSize(9);
        const h = doc.heightOfString(msg, { width: W - 32 }) + 16;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 10).fillAndStroke(C.amberBg, C.amberBorder);
        doc.fillColor(C.amber).font("Helvetica-Bold").fontSize(9).text("Low parse confidence", M + 16, y + 8);
        doc.fillColor(C.ink).font("Helvetica").fontSize(9).text(msg, M + 16, y + 20, { width: W - 28 });
        doc.y = y + h + 14;
      }

      // ---- Score card ----
      {
        const h = 168;
        ensure(h + 10);
        const y = doc.y;
        const rc = recColor(rec?.recommendation);
        doc.roundedRect(M, y, W, h, 12).fill(recBg(rec?.recommendation));

        const leftW = 130;
        // HIRE / HOLD / REJECT pill + confidence
        if (rec) {
          doc.font("Helvetica-Bold").fontSize(12);
          const pw = doc.widthOfString(rec.recommendation) + 28;
          const pillX = M + (leftW - pw) / 2 + 16;
          doc.roundedRect(pillX, y + 24, pw, 28, 14).fill(rc);
          doc.fillColor("#FFFFFF").text(rec.recommendation, pillX, y + 33, { width: pw, align: "center" });
          doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(`Confidence: ${rec.confidence}`, M + 16, y + 62, { width: leftW - 16, align: "center" });
        }
        doc.moveTo(M + leftW, y + 20).lineTo(M + leftW, y + 100).strokeColor(C.line).lineWidth(1).stroke();

        // Combined score, gauge, hire-bar tick
        const rx = M + leftW + 20;
        const rw = W - leftW - 36;
        const combined = s.combined_score ?? 0;
        doc.font("Helvetica-Bold").fontSize(34).fillColor(C.ink).text(`${combined}%`, rx, y + 18, { continued: true });
        doc.font("Helvetica").fontSize(10.5).fillColor(C.muted).text(`   Combined Score   ·   Hire bar ${hireBar}`, { baseline: "alphabetic" });

        const gaugeY = y + 62, gaugeH = 12;
        doc.roundedRect(rx, gaugeY, rw, gaugeH, 6).fill("#FFFFFF");
        doc.roundedRect(rx, gaugeY, Math.max(4, (combined / 100) * rw), gaugeH, 6).fill(scoreColor(combined));
        const tickX = rx + (Math.min(100, hireBar) / 100) * rw;
        doc.moveTo(tickX, gaugeY - 2).lineTo(tickX, gaugeY + gaugeH + 2).lineWidth(1.5).strokeColor(C.navy).stroke();

        // CV Fit / Personality / Interview — three equal columns
        const cols = [["CV FIT", bd.cv_fit?.score, C.blue], ["PERSONALITY", bd.personality_fit?.score, C.teal], ["INTERVIEW", bd.interview_result?.score, C.amber]];
        const colW = rw / 3;
        cols.forEach(([lbl, v, color], i) => {
          const cx = rx + i * colW;
          doc.font("Helvetica-Bold").fontSize(8).fillColor(C.mutedLight).text(lbl, cx, y + 96, { width: colW, characterSpacing: 0.3 });
          doc.font("Helvetica-Bold").fontSize(17).fillColor(v != null ? color : C.mutedLight).text(v != null ? `${v}%` : "—", cx, y + 108, { width: colW });
        });
        doc.y = y + h + 16;
      }

      // ---- Salary & budget fit ----
      if (fit?.budget && fit.budget.status !== "unknown") {
        const b = fit.budget;
        const lane = LANE_COLOR[b.lane] || C.muted;
        const h = 36;
        ensure(h + 8);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 8).fill(LANE_BG[b.lane] || C.grayBg);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.ink).text("Salary & Budget Fit", M + 16, y + 12, { continued: true });
        const line = b.has_budget ? `   ·   Asking ${b.expected_label}   ·   Budget ${b.range_label}` : `   ·   Asking ${b.expected_label} — no budget set for this role`;
        doc.font("Helvetica").fillColor(C.muted).text(line);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(lane).text(b.label.toUpperCase(), M, y + 12, { width: W - 16, align: "right", characterSpacing: 0.3 });
        doc.y = y + h + 16;
      }

      // ---- Key reasons / Concerns (side by side) ----
      if (rec) {
        const colW = (W - 16) / 2;
        const innerW = colW - 32;
        const reasons = rec.reasons || [];
        const concerns = rec.concerns || [];
        const bulletH = (items) => items.reduce((acc, t) => acc + doc.font("Helvetica").fontSize(9.5).heightOfString(t, { width: innerW - 14 }) + 8, 0);
        const hL = 46 + (reasons.length ? bulletH(reasons) : doc.heightOfString("None noted.", { width: innerW }));
        const hR = 46 + (concerns.length ? bulletH(concerns) : doc.heightOfString("No concerns noted.", { width: innerW }));
        const h = Math.max(hL, hR, 70);
        ensure(h + 10);
        const y = doc.y;

        const card = (x, title, color, bg, border, items, empty) => {
          doc.roundedRect(x, y, colW, h, 10).fillAndStroke(bg, border);
          doc.font("Helvetica-Bold").fontSize(10.5).fillColor(color).text(title, x + 16, y + 16, { characterSpacing: 0.3 });
          let iy = y + 38;
          if (!items.length) {
            doc.font("Helvetica").fontSize(9.5).fillColor(C.muted).text(empty, x + 16, iy, { width: innerW });
          } else {
            items.forEach((t) => {
              doc.circle(x + 20, iy + 5, 1.6).fill(C.mutedLight);
              doc.font("Helvetica").fontSize(9.5).fillColor(C.ink).text(t, x + 30, iy, { width: innerW - 14 });
              iy = doc.y + 8;
            });
          }
        };
        card(M, "Key Reasons", C.green, C.greenBg, C.greenBorder, reasons, "None noted.");
        card(M + colW + 16, "Concerns", C.amber, C.amberBg, C.amberBorder, concerns, "No concerns noted.");
        doc.y = y + h + 16;
      }

      // ---- Next action ----
      if (rec?.next_action) {
        const innerW = W - 32;
        const textH = doc.font("Helvetica-Bold").fontSize(10.5).heightOfString(rec.next_action, { width: innerW });
        const h = textH + 38;
        ensure(h + 10);
        const y = doc.y;
        doc.roundedRect(M, y, W, h, 8).fill(C.blueBg);
        doc.rect(M, y, 4, h).fill(C.navy);
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.muted).text("NEXT ACTION", M + 20, y + 14, { characterSpacing: 0.4 });
        doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.ink).text(rec.next_action, M + 20, y + 27, { width: innerW });
        doc.y = y + h + 18;
      }

      // ---- Decision & sign-off ----
      {
        ensure(60);
        doc.moveTo(M, doc.y).lineTo(M + W, doc.y).strokeColor(C.line).lineWidth(1).stroke();
        doc.moveDown(0.7);
        doc.font("Helvetica-Bold").fontSize(11).fillColor(C.ink).text("Decision & Sign-off", M, doc.y, { width: W });
        doc.moveDown(0.6);
        const y = doc.y;
        doc.font("Helvetica").fontSize(9).fillColor(C.mutedLight).text("Final hiring decision", M, y);
        doc.moveTo(M, y + 26).lineTo(M + W * 0.55, y + 26).strokeColor(C.ink).lineWidth(1).stroke();
        doc.text("Decided by", M + W * 0.62, y);
        doc.moveTo(M + W * 0.62, y + 26).lineTo(M + W, y + 26).strokeColor(C.ink).lineWidth(1).stroke();
        doc.y = y + 34;
      }

      // =========================================================
      // PAGE 2 — Score breakdown
      // =========================================================
      doc.addPage();
      doc.y = M;
      sectionTitle("Score breakdown");

      const layerHeader = (title, l, color) => {
        ensure(20);
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(12.5).fillColor(color).text(title, M, y, { width: W * 0.6 });
        const scoreText = l?.score != null ? `${l.score}% · ${l.label || labelFor(l.score)}` : "Pending";
        doc.font("Helvetica-Bold").fontSize(10.5).fillColor(color).text(scoreText, M, y + 1, { width: W, align: "right" });
        doc.y = y + 22;
      };

      // ---- CV Fit ----
      layerHeader("CV Fit", bd.cv_fit, C.blue);
      (bd.cv_fit?.contributing_factors || []).forEach((f) => {
        factorBar(f.factor, f.result, IMPACT_FILL[f.impact] ?? 0.5, C.blue);
      });

      if (fit && (fit.must_haves.length || fit.nice_to_haves.length || fit.dealbreakers.length)) {
        doc.moveDown(0.3);
        caps("Success Profile checklist");
        doc.moveDown(0.4);
        const items = [
          ...fit.must_haves.map((m) => ({ text: `Must-have: ${m.text}`, met: m.met })),
          ...fit.nice_to_haves.map((n) => ({ text: `Nice-to-have: ${n.text}`, met: n.met })),
        ];
        const colW = (W - 20) / 2;
        for (let i = 0; i < items.length; i += 2) {
          const rowH = 18;
          ensure(rowH + 2);
          const y = doc.y;
          checkItem(M, y, colW, items[i].text, items[i].met);
          if (items[i + 1]) checkItem(M + colW + 20, y, colW, items[i + 1].text, items[i + 1].met);
          doc.y = y + rowH;
        }
        const triggered = fit.dealbreakers.filter((d) => d.triggered);
        if (triggered.length) {
          doc.moveDown(0.3);
          triggered.forEach((d) => bullet(`Dealbreaker triggered: ${d.text}`, C.red));
        }
      }
      doc.moveDown(0.5);

      // ---- Personality Fit ----
      layerHeader("Personality Fit", bd.personality_fit, C.teal);
      (bd.personality_fit?.contributing_factors || []).forEach((f) => {
        bullet(`${f.factor}: ${f.result}`);
      });

      if (fit?.ocean?.length) {
        doc.moveDown(0.3);
        caps("OCEAN alignment (target for this role)");
        doc.moveDown(0.4);
        fit.ocean.forEach((o) => {
          const emphasise = EMPHASISED_TARGETS.has(o.ideal);
          const color = emphasise ? C.teal : C.mutedLight;
          const right = `${o.actual ?? "—"} · target: ${o.ideal}${o.match ? "" : "  ·  gap"}`;
          factorBar(o.trait, right, (o.actual ?? 0) / 100, color);
        });
      }
      doc.moveDown(0.4);

      // ---- Interview Result ----
      layerHeader("Interview Result", bd.interview_result, C.amber);
      (bd.interview_result?.contributing_factors || []).forEach((f) => {
        factorBar(f.factor, f.result, IMPACT_FILL[f.impact] ?? 0.5, C.amber);
      });
      doc.moveDown(0.3);

      // =========================================================
      // PAGE 3 — Strengths / Risks / Missing, background, notes
      // =========================================================
      doc.addPage();
      doc.y = M;

      // ---- Strengths / Risks / Missing evidence (three columns) ----
      {
        const gap = 14;
        const colW = (W - gap * 2) / 3;
        const cols = [
          { title: "Strengths", color: C.green, bg: C.greenBg, border: C.greenBorder, items: bd.strengths, empty: "None noted." },
          { title: "Risks", color: C.amber, bg: C.amberBg, border: C.amberBorder, items: bd.risks, empty: "No major risks flagged." },
          { title: "Missing evidence", color: C.blue, bg: C.blueBg, border: C.blueBorder, items: bd.missing_evidence, empty: "Nothing outstanding." },
        ];
        const heightFor = (items, empty) => {
          const list = items?.length ? items : [empty];
          return 38 + list.reduce((acc, t) => acc + doc.font("Helvetica").fontSize(9).heightOfString(t, { width: colW - 32 }) + 8, 0);
        };
        const h = Math.max(...cols.map((c) => heightFor(c.items, c.empty)), 90);
        ensure(h + 10);
        const y = doc.y;
        cols.forEach((c, i) => {
          const x = M + i * (colW + gap);
          doc.roundedRect(x, y, colW, h, 10).fillAndStroke(c.bg, c.border);
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor(c.color).text(c.title.toUpperCase(), x + 14, y + 14, { characterSpacing: 0.3 });
          let iy = y + 32;
          const list = c.items?.length ? c.items : null;
          if (!list) {
            doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(c.empty, x + 14, iy, { width: colW - 28 });
          } else {
            list.forEach((t) => {
              doc.circle(x + 18, iy + 4, 1.4).fill(C.mutedLight);
              doc.font("Helvetica").fontSize(9).fillColor(C.ink).text(t, x + 26, iy, { width: colW - 40 });
              iy = doc.y + 6;
            });
          }
        });
        doc.y = y + h + 20;
      }

      // ---- Pre-hire checks ----
      const checks = candidate.pre_hire_checks || {};
      const checkKeys = Object.keys(checks).filter((k) => checks[k]?.status);
      if (checkKeys.length) {
        caps("Pre-hire checks");
        doc.moveDown(0.4);
        checkKeys.forEach((k) => {
          const c = checks[k];
          const color = CHECK_COLOR[c.status] || C.muted;
          const label = k.charAt(0).toUpperCase() + k.slice(1);
          ensure(18);
          const y = doc.y;
          doc.font("Helvetica-Bold").fontSize(10).fillColor(C.ink).text(label, M, y, { continued: true });
          doc.font("Helvetica").fillColor(C.muted).text("  —  ", { continued: true });
          doc.font("Helvetica-Bold").fillColor(color).text(CHECK_LABEL[c.status] || c.status, { continued: !!c.updated });
          if (c.updated) doc.font("Helvetica").fillColor(C.muted).text(`   (updated ${fmtDate(c.updated)})`);
          if (c.notes) para(c.notes, { size: 9, color: C.muted });
          doc.moveDown(0.3);
        });
        doc.moveDown(0.3);
      }

      // ---- HR notes ----
      if (candidate.hr_notes_list?.length) {
        caps("HR notes");
        doc.moveDown(0.4);
        candidate.hr_notes_list.forEach((n) => bullet(`${fmtDate(n.date)} — ${n.text}`, C.ink));
        doc.moveDown(0.3);
      }

      // ---- Candidate background (two columns: history/education | skills) ----
      {
        ensure(30);
        doc.moveTo(M, doc.y).lineTo(M + W, doc.y).strokeColor(C.line).lineWidth(1).stroke();
        doc.moveDown(0.7);
        doc.font("Helvetica-Bold").fontSize(14).fillColor(C.ink).text("Candidate background", M, doc.y, { width: W });
        doc.moveDown(0.6);

        const leftW = W * 0.58, rightX = M + W * 0.6, rightW = W * 0.4;
        const startY = doc.y;

        // left column
        doc.y = startY;
        caps("Work history");
        doc.moveDown(0.3);
        (p.work_history || []).forEach((w) => {
          const dur = w.duration_months ? `${Math.floor(w.duration_months / 12)}y ${w.duration_months % 12}m` : "";
          ensure(16);
          const y = doc.y;
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.ink).text(w.title || "", M, y, { continued: true, width: leftW });
          doc.font("Helvetica").fillColor(C.muted).text(`  —  ${w.employer || ""}`, { width: leftW });
          if (dur) doc.font("Helvetica").fontSize(9).fillColor(C.mutedLight).text(dur, M, y, { width: leftW, align: "right" });
          doc.moveDown(0.25);
        });
        doc.moveDown(0.3);
        caps("Education");
        doc.moveDown(0.3);
        (p.education || []).forEach((e) => para(`${e.level || ""}${e.institution ? " — " + e.institution : ""}${e.year ? " (" + e.year + ")" : ""}`, { size: 9.5, width: leftW }));
        const leftEndY = doc.y;

        // right column — skill pills
        doc.y = startY;
        caps("Key skills");
        doc.moveDown(0.4);
        let px = rightX, py = doc.y;
        (p.skills || []).forEach((skill, i) => {
          const palette = TAG_PALETTE[i % TAG_PALETTE.length];
          const label = skill.charAt(0).toUpperCase() + skill.slice(1);
          const w = pillWidth(doc, label, 9);
          if (px + w > rightX + rightW) { px = rightX; py += 24; }
          drawPill(doc, px, py, label, palette.text, palette.bg, 9);
          px += w + 8;
        });
        const rightEndY = py + 24;

        doc.y = Math.max(leftEndY, rightEndY) + 10;
      }

      // ---- Footer on every page ----
      // Writing in the bottom-margin area makes pdfkit auto-spawn blank pages,
      // so temporarily drop the bottom margin to 0 while drawing footers.
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const fy = doc.page.height - 30;
        const footer = `Generated by PeopleQuest Talent AI  ·  Confidential  ·  Page ${i + 1} of ${range.count}`;
        doc.font("Helvetica").fontSize(8).fillColor(C.mutedLight).text(footer, M, fy, { width: W, align: "center", lineBreak: false });
        doc.page.margins.bottom = savedBottom;
      }

      doc.flushPages();
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

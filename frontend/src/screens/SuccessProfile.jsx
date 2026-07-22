import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { usePalette } from "../context/ThemeContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const OCEAN_LEVELS = ["low", "medium-low", "medium", "medium-high", "high"];
const LEVEL_PCT = { low: 20, "medium-low": 40, medium: 60, "medium-high": 80, high: 100 };
const TRAITS = [
  ["O", "Openness", "Curiosity and willingness to try new ideas or approaches"],
  ["C", "Conscientious.", "Reliability, organisation, and follow-through on tasks"],
  ["E", "Extraversion", "Energy and comfort in social or customer-facing situations"],
  ["A", "Agreeableness", "Cooperation, warmth, and ease working with others"],
  ["N", "Neuroticism", "Emotional sensitivity to stress — low = calmer under pressure"],
];
const PILL = {
  must: { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", head: "#047857", title: "✓ Must-haves", key: "must_haves" },
  nice: { color: "#4338CA", bg: "#EEF2FF", border: "#C7D2FE", head: "#6366F1", title: "＋ Nice-to-haves", key: "nice_to_haves" },
  deal: { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA", head: "#B91C1C", title: "✕ Dealbreakers", key: "dealbreakers" },
};

const EMPTY = {
  summary: "", must_haves: [], nice_to_haves: [], dealbreakers: [],
  ideal_ocean_profile: { O: "medium", C: "high", E: "medium", A: "high", N: "low" },
  benchmark_experience_years: 2, benchmark_team_size: 0, benchmark_education: "",
  salary_budget_min: 0, salary_budget_max: 0,
};

export default function SuccessProfile() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const D = usePalette();
  const card = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16, padding: 22 };
  const benchInput = { width: 90, padding: "6px 10px", border: `0.5px solid ${D.border}`, borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: "right", outline: "none", background: D.cardBg, color: D.text };
  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [aiBanner, setAiBanner] = useState(false);
  const [salLevel, setSalLevel] = useState("mid");
  const [salSuggesting, setSalSuggesting] = useState(false);
  const [salNote, setSalNote] = useState("");
  const [weights, setWeights] = useState({ profile: 35, ocean: 15, interview: 50 });
  const [motivationOn, setMotivationOn] = useState(false);
  const [critWeights, setCritWeights] = useState({}); // { criterion_id: pct } — every interview-source criterion
  const [critOrder, setCritOrder] = useState([]); // [{id, name}] for stable display order
  const [weightsSaving, setWeightsSaving] = useState(false);

  useEffect(() => {
    axios.get("/api/jobs").then((r) => {
      const j = r.data.find((x) => x.job_id === jobId) || null;
      setJob(j);
      if (j) {
        const w = j.score_weights || { profile: 0.35, ocean: 0.15, interview: 0.5 };
        setWeights({ profile: Math.round(w.profile * 100), ocean: Math.round(w.ocean * 100), interview: Math.round(w.interview * 100) });
        const interviewCrit = (j.criteria || []).filter((c) => c.source === "interview");
        setMotivationOn(interviewCrit.some((c) => c.id === "i_motivation"));
        setCritOrder(interviewCrit.map((c) => ({ id: c.id, name: c.name })));
        setCritWeights(Object.fromEntries(interviewCrit.map((c) => [c.id, Math.round(c.weight * 100)])));
      }
    });
    axios.get(`/api/jobs/${jobId}/success-profile`).then((r) => {
      const has = r.data && Object.keys(r.data).length;
      setProfile(has ? { ...EMPTY, ...r.data } : { ...EMPTY });
      // Auto-generated at role creation and never explicitly saved yet — flag for review.
      if (has && r.data.created_at && r.data.created_at === r.data.last_updated) setAiBanner(true);
    }).catch(() => setProfile({ ...EMPTY }));
  }, [jobId]);

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  async function generate() {
    setGenerating(true);
    try { setProfile({ ...EMPTY, ...(await axios.post(`/api/jobs/${jobId}/success-profile/generate`)).data }); setAiBanner(true); }
    catch { flash("Couldn't generate — please try again."); }
    finally { setGenerating(false); }
  }
  async function suggestSalaryFromMarket() {
    setSalSuggesting(true); setSalNote("");
    try {
      const r = await axios.get(`/api/jobs/${jobId}/suggest-salary?level=${salLevel}`);
      if (r.data?.available) {
        setProfile((p) => ({ ...p, salary_budget_min: r.data.min, salary_budget_max: r.data.max }));
        setSalNote(`Suggested ${r.data.min_label}–${r.data.max_label} for a ${salLevel} ${r.data.category} · ${r.data.source_short}${r.data.estimated ? " (indicative)" : ""}`);
      } else setSalNote("No market data for this role yet — set the budget manually.");
    } catch { setSalNote("Couldn't fetch market data."); }
    finally { setSalSuggesting(false); }
  }
  async function save() {
    setSaving(true);
    try { await axios.put(`/api/jobs/${jobId}/success-profile`, profile); setAiBanner(false); flash("Success profile saved"); }
    catch { flash("Save failed."); }
    finally { setSaving(false); }
  }
  function flash(m) { setToast(m); setTimeout(() => setToast(""), 2500); }

  const interviewCriteriaCount = (job?.criteria || []).filter((c) => c.source === "interview" && c.id !== "i_motivation").length;
  const weightsSum = weights.profile + weights.ocean + weights.interview;
  const critSum = critOrder.reduce((a, c) => a + (critWeights[c.id] || 0), 0);

  function toggleMotivation(checked) {
    setMotivationOn(checked);
    if (checked && !critWeights.i_motivation) {
      setCritOrder((o) => [...o, { id: "i_motivation", name: "Motivation & fit" }]);
      setCritWeights((w) => ({ ...w, i_motivation: 8 }));
    } else if (!checked) {
      setCritOrder((o) => o.filter((c) => c.id !== "i_motivation"));
      setCritWeights((w) => { const n = { ...w }; delete n.i_motivation; return n; });
    }
  }

  async function saveWeights() {
    setWeightsSaving(true);
    try {
      const body = {
        score_weights: { profile: weights.profile / 100, ocean: weights.ocean / 100, interview: weights.interview / 100 },
        motivation: { enabled: motivationOn, weight: (critWeights.i_motivation || 8) / 100 },
      };
      if (critOrder.length) {
        body.interview_weights = Object.fromEntries(critOrder.map((c) => [c.id, (critWeights[c.id] || 0) / 100]));
      }
      const r = await axios.patch(`/api/jobs/${jobId}/scoring-weights`, body);
      setJob(r.data.job);
      const interviewCrit = (r.data.job.criteria || []).filter((c) => c.source === "interview");
      setCritOrder(interviewCrit.map((c) => ({ id: c.id, name: c.name })));
      setCritWeights(Object.fromEntries(interviewCrit.map((c) => [c.id, Math.round(c.weight * 100)])));
      flash(r.data.rescored_candidates > 0 ? `Saved — ${r.data.rescored_candidates} candidate${r.data.rescored_candidates === 1 ? "" : "s"} re-scored at the new weights.` : "Scoring weights saved.");
    } catch (e) { flash(e.response?.data?.error || "Couldn't save scoring weights."); }
    finally { setWeightsSaving(false); }
  }

  if (!profile) return <div style={{ ...card, height: 280 }} className="animate-pulse" />;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }} className="pb-8">
      <div onClick={() => navigate(`/jobs/${jobId}/dashboard`)} style={{ fontSize: 14, color: D.blue, fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>← Back to candidates</div>

      {/* Banner */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,#F5F3FF,#EEF2FF)", border: "1px solid #E9E5FF", borderRadius: 16, padding: "18px 22px", marginBottom: 22 }} className="flex-wrap gap-3">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: GRAD, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✨</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#312E81" }}>Define the ideal candidate — {job?.role_title || ""}</div>
            <div style={{ fontSize: 13, color: "#6D5D9E" }}>Let AI pre-fill benchmarks from the role — edit anything before saving.</div>
          </div>
        </div>
        <button onClick={generate} disabled={generating} style={{ padding: "10px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", opacity: generating ? 0.7 : 1 }}>✨ {generating ? "Generating…" : "Generate with AI"}</button>
      </div>

      {aiBanner && <div style={{ background: "#F5F3FF", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#6D28D9" }}>AI-generated — please review before saving.</div>}
      {toast && <div style={{ background: "#ECFDF5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#047857" }}>{toast}</div>}

      {/* 2x2 grid */}
      <div className="grid gap-4 sm:grid-cols-2" style={{ marginBottom: 16 }}>
        {["must", "nice", "deal"].map((k) => <PillCard key={k} cfg={PILL[k]} items={profile[PILL[k].key]} onChange={(v) => set(PILL[k].key, v)} card={card} D={D} />)}
        {/* Benchmarks */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: D.text }}>Benchmarks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Bench label="Ideal experience (years)" D={D}><input type="number" min="0" value={profile.benchmark_experience_years} onChange={(e) => set("benchmark_experience_years", Number(e.target.value))} style={benchInput} /></Bench>
            <Bench label="Team size led" D={D}><input type="number" min="0" value={profile.benchmark_team_size} onChange={(e) => set("benchmark_team_size", Number(e.target.value))} style={benchInput} /></Bench>
            <Bench label="Education" D={D}><input value={profile.benchmark_education} onChange={(e) => set("benchmark_education", e.target.value)} placeholder="e.g. Diploma or above" style={{ ...benchInput, width: 200 }} /></Bench>
            <div style={{ height: 1, background: D.border, margin: "2px 0" }} />
            <Bench label="Salary budget — min (RM/mo)" D={D}><input type="number" min="0" value={profile.salary_budget_min} onChange={(e) => set("salary_budget_min", Number(e.target.value))} placeholder="e.g. 1800" style={benchInput} /></Bench>
            <Bench label="Salary budget — max (RM/mo)" D={D}><input type="number" min="0" value={profile.salary_budget_max} onChange={(e) => set("salary_budget_max", Number(e.target.value))} placeholder="e.g. 2800" style={benchInput} /></Bench>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: D.text3 }}>Suggest from market for a</span>
            <select value={salLevel} onChange={(e) => setSalLevel(e.target.value)} style={{ fontSize: 12.5, padding: "5px 8px", border: `0.5px solid ${D.border}`, borderRadius: 8, background: D.cardBg, color: D.text2 }}>
              <option value="junior">junior (0–2 yrs)</option>
              <option value="mid">mid (3–5 yrs)</option>
              <option value="senior">senior (6+ yrs)</option>
            </select>
            <button onClick={suggestSalaryFromMarket} disabled={salSuggesting} style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE", borderRadius: 8, cursor: "pointer" }}>✨ {salSuggesting ? "Fetching…" : "Suggest"}</button>
          </div>
          {salNote && <div style={{ fontSize: 12, color: "#047857", marginTop: 8 }}>{salNote}</div>}
          <div style={{ fontSize: 12, color: D.text4, marginTop: 8 }}>Salary now feeds the Profile-fit score (does their expected pay match their experience for this role?) — and still flags budget fit.</div>
        </div>
      </div>

      {/* Ideal OCEAN */}
      <div style={{ ...card, marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: D.text }}>Ideal OCEAN profile</div>
        <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>Target personality traits for top performers in this role</div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
          {TRAITS.map(([key, lbl, desc]) => {
            const val = profile.ideal_ocean_profile?.[key] || "medium";
            const idx = OCEAN_LEVELS.indexOf(val);
            return (
              <div key={key}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: D.text2 }}>{lbl}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", textTransform: "capitalize" }}>{val}</span>
                </div>
                <div style={{ fontSize: 11.5, color: D.text4, lineHeight: 1.4, marginBottom: 10, minHeight: 30 }}>{desc}</div>
                <div style={{ height: 8, background: D.inset, borderRadius: 5, overflow: "hidden", marginBottom: 8 }}><div style={{ height: "100%", width: `${LEVEL_PCT[val]}%`, background: "linear-gradient(90deg,#818CF8,#7C3AED)", borderRadius: 5 }} /></div>
                <input type="range" min="0" max="4" value={idx < 0 ? 2 : idx} onChange={(e) => set("ideal_ocean_profile", { ...profile.ideal_ocean_profile, [key]: OCEAN_LEVELS[Number(e.target.value)] })} className="w-full accent-violet-600" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Scoring weights */}
      <div style={{ ...card, marginBottom: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: D.text }}>Scoring weights</div>
        <div style={{ fontSize: 13, color: D.text4, marginBottom: 20 }}>How the three layers combine into the composite score. Saving re-scores every already-scored candidate for this role at the new weights — no re-interview needed.</div>

        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 10 }}>
          {[["profile", "Success Profile fit"], ["ocean", "Personality (OCEAN)"], ["interview", "Interview"]].map(([k, lbl]) => (
            <div key={k}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: D.text3, marginBottom: 6 }}>{lbl}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" min="0" max="100" value={weights[k]} onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))} style={{ ...benchInput, width: 70 }} />
                <span style={{ fontSize: 13, color: D.text4 }}>%</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: weightsSum === 100 ? D.text4 : "#B91C1C", marginBottom: 18 }}>
          Total: {weightsSum}% {weightsSum !== 100 && "— should sum to 100% (values will be auto-normalized either way)"}
        </div>

        <div style={{ height: 1, background: D.border, margin: "0 0 18px" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }} className="flex-wrap">
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: D.text2, marginBottom: 3 }}>Motivation & fit</div>
            <div style={{ fontSize: 12.5, color: D.text4, lineHeight: 1.5 }}>Score genuine interest and commitment to this specific role, as its own interview criterion — never scored as "culture fit" or affinity.</div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: interviewCriteriaCount > 0 ? "pointer" : "not-allowed", flexShrink: 0 }}>
            <input type="checkbox" checked={motivationOn} disabled={interviewCriteriaCount === 0} onChange={(e) => toggleMotivation(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#7C3AED", cursor: "inherit" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: D.text2 }}>Score it</span>
          </label>
        </div>
        {interviewCriteriaCount === 0 && <div style={{ fontSize: 12, color: D.text4, marginTop: 8 }}>This role has no interview criteria yet — generate criteria first.</div>}

        {critOrder.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: D.text3, marginBottom: 10 }}>How the {weights.interview}% Interview share splits across its criteria</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {critOrder.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: D.inset, borderRadius: 10, padding: "9px 13px" }}>
                  <span style={{ fontSize: 13.5, color: D.text2 }}>{c.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    <input type="number" min="0" max="100" value={critWeights[c.id] ?? 0} onChange={(e) => setCritWeights((w) => ({ ...w, [c.id]: Number(e.target.value) }))} style={{ ...benchInput, width: 60 }} />
                    <span style={{ fontSize: 13, color: D.text4 }}>%</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: Math.abs(critSum - weights.interview) <= 1 ? D.text4 : "#B91C1C", marginTop: 10 }}>
              Criteria total: {critSum}% {Math.abs(critSum - weights.interview) > 1 && `— must equal the Interview share (${weights.interview}%)`}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={saveWeights} disabled={weightsSaving} style={{ padding: "10px 18px", background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE", borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: weightsSaving ? 0.7 : 1 }}>{weightsSaving ? "Saving & re-scoring…" : "Save scoring weights"}</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => navigate(`/jobs/${jobId}/dashboard`)} style={{ padding: "11px 18px", background: D.cardBg, color: D.text3, border: `0.5px solid ${D.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: "11px 20px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save success profile"}</button>
      </div>
    </div>
  );
}

function Bench({ label, children, D }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span style={{ fontSize: 14, color: D.text3 }}>{label}</span>{children}</div>;
}

function PillCard({ cfg, items, onChange, card, D }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  function add() { const v = text.trim(); if (v) onChange([...(items || []), v]); setText(""); setAdding(false); }
  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: cfg.head, marginBottom: 14 }}>{cfg.title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(items || []).map((it, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, padding: "7px 12px", borderRadius: 9 }}>
            {it}<span onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ cursor: "pointer", opacity: 0.6 }}>✕</span>
          </span>
        ))}
        {adding ? (
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setText(""); setAdding(false); } }} onBlur={add} placeholder="Type & Enter" style={{ fontSize: 13, padding: "7px 12px", border: `0.5px solid ${D.border}`, borderRadius: 9, outline: "none", minWidth: 120, background: D.cardBg, color: D.text }} />
        ) : (
          <span onClick={() => setAdding(true)} style={{ fontSize: 13, fontWeight: 500, color: D.text4, background: D.cardBg, border: `1px dashed ${D.border}`, padding: "7px 12px", borderRadius: 9, cursor: "pointer" }}>＋ Add</span>
        )}
      </div>
    </div>
  );
}

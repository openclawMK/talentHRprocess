import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Check, X, AlertTriangle, ClipboardList, MessageSquare, Sparkles, Trash2, MessageCircle, Send, CalendarClock, RefreshCw } from "lucide-react";
import LaneBadge from "../components/LaneBadge.jsx";
import CriteriaRow from "../components/CriteriaRow.jsx";
import Modal from "../components/Modal.jsx";
import { monthsToDuration, round, barColor, LANE_META, candidateStatus, screeningScore, screeningVerdict } from "../lib/format.js";
import { candidateStages } from "../lib/pipeline.js";

export default function CandidateDetail() {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteResult, setNoteResult] = useState(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [invite, setInvite] = useState({ interview_type: "In-person interview", date: "", time: "" });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chat, setChat] = useState(null);
  const [outcomeSaving, setOutcomeSaving] = useState(false);

  async function loadChat() {
    setShowChat((v) => !v);
    if (chat === null) {
      try {
        const res = await axios.get(`/api/candidates/${jobId}/${candidateId}/whatsapp-history`);
        setChat(res.data);
      } catch {
        setChat({ configured: false, thread: [] });
      }
    }
  }

  async function sendInvite() {
    setInviteSending(true);
    setInviteResult(null);
    try {
      const res = await axios.post(`/api/candidates/${jobId}/${candidateId}/send-interview-invite`, invite);
      setInviteResult(res.data);
    } catch (e) {
      setInviteResult({ error: e.response?.data?.error || "Failed to send invite." });
    } finally {
      setInviteSending(false);
    }
  }

  async function setOutcome(outcome) {
    const verb = outcome === "offer" ? "send an OFFER message to" : "send a REJECTION message to";
    if (!window.confirm(`This will ${verb} the candidate via WhatsApp and mark them as ${outcome}. Continue?`)) return;
    setOutcomeSaving(true);
    try {
      const res = await axios.post(`/api/candidates/${jobId}/${candidateId}/outcome`, { outcome });
      setCandidate(res.data.candidate);
    } catch {
      /* ignore */
    } finally {
      setOutcomeSaving(false);
    }
  }

  useEffect(() => {
    axios
      .get(`/api/candidates/${jobId}/${candidateId}`)
      .then((res) => setCandidate(res.data))
      .catch(() => setCandidate(false));
    axios
      .get("/api/jobs")
      .then((res) => setJob(res.data.find((j) => j.job_id === jobId) || null));
  }, [jobId, candidateId]);

  if (candidate === false)
    return <div className="text-gray-500">Candidate not found.</div>;
  if (!candidate || !job)
    return (
      <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />
    );

  const p = candidate.profile;
  const s = candidate.score || {};
  const criteria = s.criteria_scores || [];
  const partial = s.full_score_available === false;
  const pending = s.pending_sources || [];
  const scoredWeight = criteria
    .filter((c) => c.scored)
    .reduce((a, c) => a + (c.weight || 0), 0);
  const coveragePct = Math.round(scoredWeight * 100);
  const traits = candidate.ocean_traits;

  // Interview record: scored interview criteria that captured questions/notes
  const interviewRecord = criteria.filter(
    (c) => c.source === "interview" && c.scored &&
      ((c.questions_asked && c.questions_asked.length) || c.hr_notes)
  );

  const interviewPending = pending.includes("interview");
  const savedNotesList = candidate.hr_notes_list || [];

  const status = candidateStatus(s);
  const screenScore = screeningScore(s);
  const screenV = status === "screening" ? screeningVerdict(screenScore) : null;

  // Session 11: hiring-intelligence layer
  const rec = candidate.recommendation || null;
  const bd = candidate.score_breakdown || null;

  async function regenerateRecommendation() {
    setRegenLoading(true);
    try {
      const res = await axios.post(`/api/candidates/${jobId}/${candidateId}/regenerate-recommendation`);
      setCandidate(res.data);
    } catch {
      /* ignore */
    } finally {
      setRegenLoading(false);
    }
  }

  const REC_STYLE = {
    HIRE: { bg: "#D1FAE5", text: "#065F46", border: "#059669" },
    HOLD: { bg: "#FEF3C7", text: "#92400E", border: "#D97706" },
    REJECT: { bg: "#FEE2E2", text: "#991B1B", border: "#DC2626" },
  };
  const CONF_STYLE = {
    High: { bg: "#DBEAFE", text: "#1D4ED8" },
    Medium: { bg: "#EDE9FE", text: "#6D28D9" },
    Low: { bg: "#F3F4F6", text: "#6B7280" },
  };
  const IMPACT_DOT = { positive: "#059669", partial: "#D97706", neutral: "#9CA3AF", negative: "#DC2626" };

  const haveSkills = (p.skills || []).map((x) => x.toLowerCase());
  const skillMatched = (req) =>
    haveSkills.some((h) => h.includes(req.toLowerCase()) || req.toLowerCase().includes(h));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={`/jobs/${jobId}/dashboard`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      {/* header */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold text-gray-900">{p.name}</h1>
        <div className="flex items-center gap-2">
          {status === "complete" ? (
            <>
              <LaneBadge lane={s.lane} />
              <span className="text-lg font-semibold">{round(s.combined_score)}%</span>
            </>
          ) : status === "screening" ? (
            <>
              <LaneBadge lane={screenV.lane} label={screenV.short} />
              <span className="text-lg font-semibold">{round(screenScore)}%</span>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                screening
              </span>
            </>
          ) : (
            <>
              <LaneBadge lane="in_progress" />
              <span className="text-lg font-semibold">{round(s.combined_score)}%</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                so far
              </span>
            </>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
        <span>Submitted {candidate.submitted_date}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">
          {candidate.source}
        </span>
        {p.age != null && <span>Age {p.age}</span>}
        {p.languages?.length > 0 && <span>{p.languages.join(", ")}</span>}
      </div>

      {candidate.low_confidence_warning && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">
          <AlertTriangle size={15} /> Low parse confidence — review the original CV
        </div>
      )}

      {/* AI Recommendation card (Session 11) */}
      {rec && (
        <section
          className="mt-4 rounded-lg border-2 p-5"
          style={{ borderColor: (REC_STYLE[rec.recommendation] || REC_STYLE.HOLD).border }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-gray-600" />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI Recommendation</h2>
            </div>
            <button
              onClick={regenerateRecommendation}
              disabled={regenLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              <RefreshCw size={13} className={regenLoading ? "animate-spin" : ""} />
              {regenLoading ? "Regenerating…" : "Regenerate"}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span
              className="rounded-md px-3 py-1 text-sm font-bold"
              style={{
                backgroundColor: (REC_STYLE[rec.recommendation] || REC_STYLE.HOLD).bg,
                color: (REC_STYLE[rec.recommendation] || REC_STYLE.HOLD).text,
              }}
            >
              {rec.recommendation}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: (CONF_STYLE[rec.confidence] || CONF_STYLE.Low).bg,
                color: (CONF_STYLE[rec.confidence] || CONF_STYLE.Low).text,
              }}
            >
              Confidence: {rec.confidence}
            </span>
          </div>

          {(rec.reasons || []).length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Key reasons</div>
              <ul className="mt-1 space-y-1">
                {rec.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-gray-300">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(rec.concerns || []).length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Concerns</div>
              <ul className="mt-1 space-y-1">
                {rec.concerns.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Next action</span>
            <div className="mt-0.5 font-medium text-gray-800">→ {rec.next_action}</div>
          </div>
        </section>
      )}

      {/* Screening gate result (CV + OCEAN done, interview pending) */}
      {status === "screening" && screenV && (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
          style={{ borderColor: LANE_META[screenV.lane].text + "33", backgroundColor: LANE_META[screenV.lane].bg + "66" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: LANE_META[screenV.lane].text }}>
                Screening result: {screenV.label}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-600">
              CV + OCEAN score <strong>{round(screenScore)}%</strong> of the pre-interview assessment.
              {screenV.key === "proceed" && " Clears the screening bar — proceed to interview to finalise."}
              {screenV.key === "borderline" && " Borderline — review the profile before deciding to interview."}
              {screenV.key === "screen_out" && " Below the screening bar — consider screening out without an interview."}
            </p>
          </div>
          <button
            onClick={() => navigate(`/jobs/${jobId}/candidate/${candidateId}/interview`)}
            className="shrink-0 rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#6D28D9" }}
          >
            Conduct interview →
          </button>
        </div>
      )}

      {/* Pipeline progress */}
      {(() => {
        const { stages } = candidateStages(candidate, job);
        return (
          <div className="mt-5 flex items-center gap-1">
            {stages.map((st, i) => (
              <div key={st.key} className="flex flex-1 items-center gap-1">
                <div className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs"
                    style={{
                      backgroundColor:
                        st.status === "done" ? "#6D28D9" : st.status === "current" ? "#EDE9FE" : "#F3F4F6",
                      color: st.status === "done" ? "#fff" : st.status === "current" ? "#6D28D9" : "#9CA3AF",
                      border: st.status === "current" ? "2px solid #6D28D9" : "none",
                    }}
                  >
                    {st.status === "done" ? "✓" : st.icon}
                  </div>
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: st.status === "upcoming" ? "#9CA3AF" : "#4B5563" }}
                  >
                    {st.label}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div
                    className="mb-4 h-0.5 flex-1"
                    style={{ backgroundColor: st.status === "done" ? "#6D28D9" : "#E5E7EB" }}
                  />
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Score stage buckets — pct reflects the active (redistributed) pipeline */}
      {(() => {
        const activeWeight = criteria
          .filter((c) => !c.not_applicable)
          .reduce((a, c) => a + (c.weight || 0), 0);
        const buckets = [
          { source: "cv",        label: "CV Assessment", color: "#1D4ED8", border: "#BFDBFE", bg: "#EFF6FF" },
          { source: "ocean",     label: "OCEAN Profile", color: "#065F46", border: "#A7F3D0", bg: "#F0FDF4" },
          { source: "interview", label: "Interview",     color: "#6D28D9", border: "#DDD6FE", bg: "#F5F3FF" },
        ];
        return (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {buckets.map(({ source, label, color, border, bg }) => {
              const src = criteria.filter((c) => c.source === source);
              const disabled = src.length > 0 && src.every((c) => c.not_applicable);
              const scored = src.filter((c) => c.scored && c.score != null && !c.not_applicable);
              const sw = scored.reduce((a, c) => a + c.weight, 0);
              const bucketScore = sw
                ? Math.round(scored.reduce((a, c) => a + c.score * c.weight, 0) / sw)
                : null;
              const activeSrcWeight = src.filter((c) => !c.not_applicable).reduce((a, c) => a + c.weight, 0);
              const pct = activeWeight > 0 ? Math.round((activeSrcWeight / activeWeight) * 100) : 0;
              const isPending = !disabled && src.length > 0 && scored.length === 0;
              return (
                <div
                  key={source}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: disabled ? "#E5E7EB" : border,
                    backgroundColor: disabled ? "#F9FAFB" : bg,
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: disabled ? "#9CA3AF" : color }}>
                    {label}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {disabled ? "—" : isPending ? "—" : bucketScore != null ? `${bucketScore}%` : "—"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {disabled ? "Stage disabled" : `${pct}% of final score`}
                  </div>
                  {disabled && <div className="mt-0.5 text-xs font-medium text-gray-400">Not applicable</div>}
                  {isPending && <div className="mt-0.5 text-xs font-medium" style={{ color }}>Pending</div>}
                  {!disabled && !isPending && bucketScore != null && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                      <div className="h-full rounded-full" style={{ width: `${bucketScore}%`, backgroundColor: color }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* criteria breakdown */}
      <section className="mt-4 rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-900">Criteria breakdown</h2>
          <span className="text-xs text-gray-400">score · weight</span>
        </div>
        <div className="mt-3">
          {criteria.map((c) => (
            <CriteriaRow key={c.criterion_id} criterion={c} />
          ))}
        </div>
        <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
          {partial ? (
            <>
              Current score is <strong>partial — {coveragePct}% of criteria scored</strong>{" "}
              (CV only). Full score available after screening call and OCEAN assessment.
              <span className="ml-1 text-xs text-gray-400">(* = estimated)</span>
            </>
          ) : (
            <>All criteria scored. Combined score: <strong>{round(s.combined_score)}%</strong>.</>
          )}
        </div>
      </section>

      {/* OCEAN trait results */}
      {traits && (
        <section className="mt-4 rounded-lg border border-green-200 bg-green-50/40 p-5">
          <h2 className="font-medium text-gray-900">OCEAN personality profile</h2>
          <div className="mt-3 space-y-1">
            {[
              ["Openness", traits.openness],
              ["Conscientiousness", traits.conscientiousness],
              ["Extraversion", traits.extraversion],
              ["Agreeableness", traits.agreeableness],
              ["Neuroticism", traits.neuroticism],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center gap-3 py-1">
                <div className="w-36 shrink-0 text-sm text-gray-600">{label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${val}%`, backgroundColor: "#059669" }}
                  />
                </div>
                <div className="w-10 shrink-0 text-right text-sm font-medium text-gray-700">
                  {val}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Emotional stability (inverse of Neuroticism): {traits.emotional_stability}
          </p>
        </section>
      )}

      {/* Interview record — questions asked + scores */}
      {interviewRecord.length > 0 && (
        <section className="mt-4 rounded-lg border border-purple-200 bg-purple-50/30 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-purple-600" />
              <h2 className="font-medium text-gray-900">Interview record</h2>
            </div>
            {candidate.interview_mode && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                {candidate.interview_mode === "manual" ? "Manual questions" : "AI-generated questions"}
              </span>
            )}
          </div>
          <div className="mt-3 space-y-4">
            {interviewRecord.map((c) => (
              <div key={c.criterion_id} className="rounded-md border border-purple-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">{c.criterion_name}</span>
                  <span
                    className="rounded px-2 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: barColor(c.score) }}
                  >
                    {round(c.score)}%
                  </span>
                </div>
                {(c.questions_asked || []).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.questions_asked.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-600">
                        <span className="mt-0.5 shrink-0 font-semibold text-purple-400">›</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                )}
                {c.hr_notes && (
                  <p className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-500">
                    <span className="text-gray-400">Notes: </span>{c.hr_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI summary */}
      {s.summary && (
        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
          {s.summary}
        </div>
      )}

      {/* Contributing factors — the "why" behind each layer */}
      {bd && (
        <section className="mt-6 rounded-lg border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900">Why this score</h2>
          <div className="mt-3 space-y-4">
            {[
              { key: "cv_fit", label: "CV Fit" },
              { key: "personality_fit", label: "Personality Fit" },
              { key: "interview_result", label: "Interview" },
            ].map(({ key, label }) => {
              const layer = bd[key] || {};
              const factors = layer.contributing_factors || [];
              if (layer.status === "disabled") return null;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className="text-xs text-gray-400">
                      {layer.score != null ? `${layer.score}% · ${layer.label}` : layer.label}
                    </span>
                  </div>
                  {factors.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {factors.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: IMPACT_DOT[f.impact] || "#9CA3AF" }}
                          />
                          <span>
                            <span className="text-gray-500">{f.factor}:</span> {f.result}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs italic text-gray-400">Not yet assessed.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Strengths / Risks / Missing Evidence */}
      {bd && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <section className="rounded-lg p-4" style={{ backgroundColor: "#F0FDF4" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#065F46" }}>Strengths</h3>
            <ul className="mt-2 space-y-2">
              {(bd.strengths || []).map((x, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-gray-700">
                  <Check size={13} className="mt-0.5 shrink-0 text-green-600" /> {x}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg p-4" style={{ backgroundColor: "#FFFBEB" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#92400E" }}>Risks</h3>
            <ul className="mt-2 space-y-2">
              {(bd.risks || []).map((x, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-gray-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" /> {x}
                </li>
              ))}
              {(bd.risks || []).length === 0 && <li className="text-xs italic text-gray-400">No major risks flagged.</li>}
            </ul>
          </section>
          <section className="rounded-lg p-4" style={{ backgroundColor: "#F9FAFB" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#374151" }}>Missing evidence</h3>
            <ul className="mt-2 space-y-2">
              {(bd.missing_evidence || []).map((x, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" /> {x}
                </li>
              ))}
              {(bd.missing_evidence || []).length === 0 && <li className="text-xs italic text-gray-400">Nothing outstanding.</li>}
            </ul>
          </section>
        </div>
      )}

      {/* gaps */}
      <section className="mt-5">
        <h2 className="font-medium text-gray-900">Areas to probe in interview</h2>
        <ul className="mt-2 space-y-1.5">
          {(s.gaps || []).map((g, i) => (
            <li key={i} className="text-sm text-gray-700">
              <span className="text-gray-400">→ </span>
              {g}
            </li>
          ))}
        </ul>
      </section>

      {/* work history */}
      <section className="mt-6">
        <h2 className="font-medium text-gray-900">Work history</h2>
        <div className="mt-2 space-y-3">
          {(p.work_history || []).map((w, i) => (
            <div key={i} className="border-l-2 border-gray-200 pl-3">
              <div className="text-sm font-medium text-gray-900">
                {w.title} · {w.employer}
              </div>
              <div className="text-sm text-gray-500">
                {monthsToDuration(w.duration_months)}
                {w.industry && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {w.industry}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* skills */}
      <section className="mt-6">
        <h2 className="font-medium text-gray-900">Required skills</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(job.requirements.required_skills || []).map((req) => {
            const ok = skillMatched(req);
            return (
              <span
                key={req}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                  ok
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {ok ? <Check size={12} /> : <X size={12} />}
                {req}
              </span>
            );
          })}
        </div>
      </section>

      {/* HR notes */}
      <section className="mt-6">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-orange-500" />
          <h2 className="font-medium text-gray-900">HR notes</h2>
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          Notes are saved and used in the final AI analysis after all three scoring stages are complete.
        </p>

        {/* Past notes */}
        {savedNotesList.length > 0 && (
          <div className="mt-2 space-y-2">
            {savedNotesList.map((n, i) => (
              <div
                key={i}
                className="rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-gray-700"
              >
                <span className="text-xs text-gray-400">{n.date} · </span>
                {n.text}
              </div>
            ))}
          </div>
        )}

        {/* Save confirmation */}
        {noteResult?.saved && (
          <div className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Notes saved {noteResult.date}. They will inform your interview scoring judgment.
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add context — interview impressions, attitude, red flags, anything the AI missed…"
          className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-gray-400 focus:outline-none"
          rows={3}
        />
        <button
          onClick={async () => {
            if (!note.trim()) return;
            setNoteSaving(true);
            setNoteResult(null);
            try {
              const res = await axios.post(
                `/api/candidates/${jobId}/${candidateId}/hr-notes`,
                { notes: note.trim() }
              );
              setCandidate(res.data.candidate);
              setNoteResult({ saved: true, date: res.data.date });
              setNote("");
            } catch {
              // keep note in textarea on error
            } finally {
              setNoteSaving(false);
            }
          }}
          disabled={noteSaving || !note.trim()}
          className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {noteSaving ? "Saving…" : "Save note"}
        </button>
      </section>

      {/* WhatsApp conversation */}
      <section className="mt-6">
        <button
          onClick={loadChat}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <MessageCircle size={15} className="text-green-600" />
          WhatsApp conversation
          <span className="text-xs text-gray-400">{showChat ? "▲" : "▼"}</span>
        </button>
        {showChat && (
          <div className="mt-2 rounded-lg border border-gray-200 p-4">
            {chat === null ? (
              <div className="text-sm text-gray-400">Loading…</div>
            ) : chat.thread.length === 0 ? (
              <div className="text-sm text-gray-400">
                No messages yet.
                {!chat.configured && " (WhatsApp isn't configured — messages will log here once Twilio is set up.)"}
              </div>
            ) : (
              <div className="space-y-2">
                {chat.thread.map((m, i) => (
                  <div key={i} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                        m.direction === "outbound"
                          ? "bg-green-100 text-gray-800"
                          : "border border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      {m.body}
                      <div className="mt-1 text-[10px] text-gray-400">
                        {new Date(m.at).toLocaleString()} · {m.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* outcome banner */}
      {candidate.outcome && (
        <div
          className={`mt-6 rounded-md px-4 py-2.5 text-sm font-medium ${
            candidate.outcome === "offer" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          Marked as {candidate.outcome === "offer" ? "OFFER" : "REJECTED"}
          {candidate.outcome_date ? ` on ${candidate.outcome_date}` : ""} — candidate notified via WhatsApp.
        </div>
      )}

      {/* actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3 pb-12">
        {interviewPending && (
          <button
            onClick={() =>
              navigate(`/jobs/${jobId}/candidate/${candidateId}/interview`)
            }
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#6D28D9" }}
          >
            <ClipboardList size={15} />
            Conduct interview scoring →
          </button>
        )}
        {(status === "screening" || interviewPending) && (
          <button
            onClick={() => { setInviteResult(null); setInviteModal(true); }}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={15} /> Send interview invite
          </button>
        )}
        {status === "complete" && !candidate.outcome && (
          <>
            <button
              onClick={() => setOutcome("offer")}
              disabled={outcomeSaving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Mark offer
            </button>
            <button
              onClick={() => setOutcome("rejected")}
              disabled={outcomeSaving}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Mark rejected
            </button>
          </>
        )}
        <Link
          to={`/jobs/${jobId}/dashboard`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to dashboard
        </Link>
        <button
          onClick={async () => {
            if (!window.confirm("Delete this candidate and their scores? This can't be undone.")) return;
            try {
              await axios.delete(`/api/candidates/${jobId}/${candidateId}`);
            } catch {
              /* demo candidates aren't stored server-side */
            }
            navigate(`/jobs/${jobId}/dashboard`);
          }}
          className="ml-auto flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 size={15} /> Delete candidate
        </button>
      </div>

      {/* Interview invite modal */}
      {inviteModal && (
        <Modal title="Send interview invite via WhatsApp" onClose={() => setInviteModal(false)}>
          {inviteResult?.ok ? (
            <div className="text-sm">
              <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">
                {inviteResult.skipped
                  ? "WhatsApp isn't configured yet — invite logged but not sent."
                  : "Invite sent! ✅ The candidate can reply YES to confirm."}
              </div>
              <button
                onClick={() => { setInviteModal(false); setChat(null); }}
                className="mt-4 w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Interview type</span>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  value={invite.interview_type}
                  onChange={(e) => setInvite({ ...invite, interview_type: e.target.value })}
                >
                  <option>In-person interview</option>
                  <option>Phone interview</option>
                  <option>Video interview</option>
                  <option>Walk-in interview</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Date</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    value={invite.date}
                    onChange={(e) => setInvite({ ...invite, date: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">Time</span>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    value={invite.time}
                    onChange={(e) => setInvite({ ...invite, time: e.target.value })}
                  />
                </label>
              </div>
              <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">
                <CalendarClock size={13} className="mb-1 inline text-gray-400" /> Preview: “You're invited to a{" "}
                {invite.interview_type.toLowerCase()} for {job.role_title} on {invite.date || "—"} at {invite.time || "—"}. Reply YES to confirm.”
              </div>
              {inviteResult?.error && <p className="text-sm text-red-600">{inviteResult.error}</p>}
              <button
                onClick={sendInvite}
                disabled={inviteSending || !invite.date || !invite.time}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#25D366" }}
              >
                <Send size={15} /> {inviteSending ? "Sending…" : "Send invite"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

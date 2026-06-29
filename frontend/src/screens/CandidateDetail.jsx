import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Check, X, AlertTriangle, ClipboardList, MessageSquare, Sparkles, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import LaneBadge from "../components/LaneBadge.jsx";
import CriteriaRow from "../components/CriteriaRow.jsx";
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
  const [finalAnalysis, setFinalAnalysis] = useState(null);
  const [generatingFinal, setGeneratingFinal] = useState(false);

  useEffect(() => {
    axios
      .get(`/api/candidates/${jobId}/${candidateId}`)
      .then((res) => {
        setCandidate(res.data);
        if (res.data.final_analysis) setFinalAnalysis(res.data.final_analysis);
      })
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

      {/* strengths + weaknesses side by side */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <section>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={15} className="text-green-600" />
            <h2 className="font-medium text-gray-900">Strengths</h2>
          </div>
          <ul className="mt-2 space-y-2">
            {(s.strengths || []).map((str, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <Check size={14} className="mt-0.5 shrink-0 text-green-500" />
                {str}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-1.5">
            <TrendingDown size={15} className="text-red-500" />
            <h2 className="font-medium text-gray-900">Weaknesses</h2>
          </div>
          <ul className="mt-2 space-y-2">
            {(s.weaknesses || []).map((w, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <X size={14} className="mt-0.5 shrink-0 text-red-400" />
                {w}
              </li>
            ))}
          </ul>
        </section>
      </div>

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

      {/* Final Analysis panel */}
      {finalAnalysis ? (
        <section className="mt-6 rounded-lg border-2 border-gray-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-gray-700" />
              <h2 className="font-semibold text-gray-900">Final Assessment</h2>
              <span className="text-xs text-gray-400">{finalAnalysis.generated_date}</span>
            </div>
            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{
                backgroundColor:
                  finalAnalysis.recommendation === "Hire" ? "#D1FAE5" :
                  finalAnalysis.recommendation === "Reject" ? "#FEE2E2" : "#FEF3C7",
                color:
                  finalAnalysis.recommendation === "Hire" ? "#065F46" :
                  finalAnalysis.recommendation === "Reject" ? "#991B1B" : "#92400E",
              }}
            >
              {finalAnalysis.recommendation}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{finalAnalysis.recommendation_reason}</p>

          <p className="mt-3 text-sm leading-relaxed text-gray-700">{finalAnalysis.summary}</p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700">
                <TrendingUp size={12} /> Strengths
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {finalAnalysis.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <Check size={13} className="mt-0.5 shrink-0 text-green-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600">
                <TrendingDown size={12} /> Weaknesses
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {finalAnalysis.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <X size={13} className="mt-0.5 shrink-0 text-red-400" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : !partial && (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-5 text-center">
          <Sparkles size={18} className="mx-auto text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700">All stages complete — generate a final analysis</p>
          <p className="mt-0.5 text-xs text-gray-400">AI will synthesise CV, OCEAN, interview scores, and HR notes into a Hire / Hold / Reject recommendation.</p>
          <button
            onClick={async () => {
              setGeneratingFinal(true);
              try {
                const res = await axios.post(`/api/candidates/${jobId}/${candidateId}/final-analysis`);
                setFinalAnalysis(res.data.final_analysis);
                setCandidate(res.data.candidate);
              } catch (e) {
                alert(e.response?.data?.error || "Failed to generate analysis.");
              } finally {
                setGeneratingFinal(false);
              }
            }}
            disabled={generatingFinal}
            className="mt-3 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#111827" }}
          >
            {generatingFinal ? (
              <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40" style={{ borderTopColor: "#fff" }} /> Analysing all data…</>
            ) : (
              <><Sparkles size={14} /> Generate final analysis →</>
            )}
          </button>
        </div>
      )}

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
    </div>
  );
}

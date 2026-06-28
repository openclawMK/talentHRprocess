import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Info, Check, X, AlertTriangle, ClipboardList, MessageSquare } from "lucide-react";
import LaneBadge from "../components/LaneBadge.jsx";
import CriteriaRow from "../components/CriteriaRow.jsx";
import { monthsToDuration, round } from "../lib/format.js";

export default function CandidateDetail() {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteResult, setNoteResult] = useState(null);

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

  const interviewPending = pending.includes("interview");
  const savedNotesList = candidate.hr_notes_list || [];

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
          <LaneBadge lane={s.lane} />
          <span className="text-lg font-semibold">{round(s.combined_score)}%</span>
          {partial && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              partial
            </span>
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

      {/* Score stage buckets */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { source: "cv",        label: "CV Assessment",  pct: job.role_level === "supervisory" ? 45 : 35, color: "#1D4ED8", border: "#BFDBFE", bg: "#EFF6FF" },
          { source: "ocean",     label: "OCEAN Profile",  pct: job.role_level === "supervisory" ? 10 : 15, color: "#065F46", border: "#A7F3D0", bg: "#F0FDF4" },
          { source: "interview", label: "Interview",       pct: job.role_level === "supervisory" ? 45 : 50, color: "#6D28D9", border: "#DDD6FE", bg: "#F5F3FF" },
        ].map(({ source, label, pct, color, border, bg }) => {
          const src = criteria.filter((c) => c.source === source);
          const scored = src.filter((c) => c.scored && c.score != null);
          const sw = scored.reduce((a, c) => a + c.weight, 0);
          const bucketScore = sw
            ? Math.round(scored.reduce((a, c) => a + c.score * c.weight, 0) / sw)
            : null;
          const isPending = src.length > 0 && scored.length === 0;
          return (
            <div
              key={source}
              className="rounded-lg border p-3"
              style={{ borderColor: border, backgroundColor: bg }}
            >
              <div className="text-xs font-semibold" style={{ color }}>{label}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {isPending ? "—" : bucketScore != null ? `${bucketScore}%` : "—"}
              </div>
              <div className="text-xs text-gray-400">{pct}% of final score</div>
              {isPending && (
                <div className="mt-0.5 text-xs font-medium" style={{ color }}>Pending</div>
              )}
              {!isPending && bucketScore != null && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                  <div className="h-full rounded-full" style={{ width: `${bucketScore}%`, backgroundColor: color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

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

      {/* AI summary */}
      {s.summary && (
        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
          {s.summary}
        </div>
      )}

      {/* strengths */}
      <section className="mt-6">
        <h2 className="font-medium text-gray-900">Strengths</h2>
        <ol className="mt-2 space-y-1.5">
          {(s.strengths || []).map((str, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="font-semibold text-gray-400">{i + 1}.</span>
              {str}
            </li>
          ))}
        </ol>
      </section>

      {/* gaps */}
      <section className="mt-5">
        <h2 className="font-medium text-gray-900">Areas to probe</h2>
        <ul className="mt-2 space-y-1.5">
          {(s.gaps || []).map((g, i) => (
            <li key={i} className="text-sm text-gray-700">
              <span className="text-gray-400">→ Probe in interview: </span>
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
          Notes are saved and AI-analyzed to produce an HR Assessment score that folds into the overall score.
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
          {noteSaving ? "Analyzing…" : "Save & score notes"}
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
        <button
          onClick={() =>
            navigate(`/jobs/${jobId}/candidate/${candidateId}/questions`)
          }
          className="rounded-md border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
        >
          Generate interview questions →
        </button>
        <Link
          to={`/jobs/${jobId}/dashboard`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

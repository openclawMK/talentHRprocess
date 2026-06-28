import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { barColor } from "../lib/format.js";

export default function InterviewScoring() {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();

  const [criteria, setCriteria] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [ratings, setRatings] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get(`/api/candidates/${jobId}/${candidateId}`)
      .then((r) => setCandidate(r.data))
      .catch(() => setCandidate(false));

    axios
      .get(`/api/candidates/${jobId}/${candidateId}/interview-prep`)
      .then((r) => {
        setCriteria(r.data.criteria);
        const init = {};
        r.data.criteria.forEach((c) => { init[c.id] = 70; });
        setRatings(init);
      })
      .catch(() => setCriteria([]));
  }, [jobId, candidateId]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const ratingPayload = criteria.map((c) => ({
        criterion_id: c.id,
        score: ratings[c.id] ?? 70,
        notes: notes[c.id] || null,
      }));
      await axios.post(
        `/api/candidates/${jobId}/${candidateId}/interview-scores`,
        { ratings: ratingPayload }
      );
      navigate(`/jobs/${jobId}/candidate/${candidateId}`);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to save scores.");
      setSaving(false);
    }
  }

  if (candidate === false)
    return <div className="text-gray-500">Candidate not found.</div>;
  if (!criteria || !candidate)
    return <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />;

  if (criteria.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to={`/jobs/${jobId}/candidate/${candidateId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="mt-12 text-center text-gray-500">
          No interview criteria defined for this role.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={`/jobs/${jobId}/candidate/${candidateId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to candidate
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <ClipboardList size={22} className="text-purple-600" />
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">Interview Scoring</h1>
          <p className="text-sm text-gray-500">{candidate.profile?.name}</p>
        </div>
      </div>

      <p className="mt-3 rounded-md bg-purple-50 px-4 py-2.5 text-sm text-purple-800">
        Use the questions below during or after the interview, then rate each criterion 0–100 and submit.
      </p>

      <div className="mt-5 space-y-6">
        {criteria.map((c, i) => {
          const rating = ratings[c.id] ?? 70;
          return (
            <div key={c.id} className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-purple-500">
                    Criterion {i + 1} of {criteria.length}
                  </span>
                  <h3 className="mt-0.5 font-medium text-gray-900">{c.name}</h3>
                  {c.description && (
                    <p className="mt-0.5 text-xs text-gray-400">{c.description}</p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-md px-2.5 py-1 text-sm font-bold text-white"
                  style={{ backgroundColor: barColor(rating) }}
                >
                  {rating}
                </span>
              </div>

              {/* AI-generated questions */}
              {(c.questions || []).length > 0 && (
                <div className="mt-3 space-y-1.5 rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Ask the candidate:</p>
                  {c.questions.map((q, qi) => (
                    <div key={qi} className="flex gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 shrink-0 font-semibold text-purple-400">›</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Scoring rubric */}
              {c.rubric && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                  <div className="rounded-md bg-red-50 p-2 text-red-700">
                    <div className="mb-0.5 font-bold">0 – 40</div>
                    {c.rubric.low}
                  </div>
                  <div className="rounded-md bg-amber-50 p-2 text-amber-700">
                    <div className="mb-0.5 font-bold">41 – 70</div>
                    {c.rubric.mid}
                  </div>
                  <div className="rounded-md bg-green-50 p-2 text-green-700">
                    <div className="mb-0.5 font-bold">71 – 100</div>
                    {c.rubric.high}
                  </div>
                </div>
              )}

              {/* Rating slider */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Rating</span>
                  <span className="font-medium">{rating} / 100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={rating}
                  onChange={(e) =>
                    setRatings((r) => ({ ...r, [c.id]: Number(e.target.value) }))
                  }
                  className="mt-1 w-full accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0 – Not demonstrated</span>
                  <span>50 – Adequate</span>
                  <span>100 – Excellent</span>
                </div>
              </div>

              {/* Per-criterion notes */}
              <textarea
                value={notes[c.id] || ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [c.id]: e.target.value }))
                }
                placeholder="Notes on candidate's answer (optional)…"
                rows={2}
                className="mt-3 w-full rounded border border-gray-200 p-2 text-sm text-gray-700 placeholder-gray-300 focus:border-gray-400 focus:outline-none"
              />
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 pb-12">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#6D28D9" }}
        >
          {saving ? "Saving…" : "Submit interview scores →"}
        </button>
        <Link
          to={`/jobs/${jobId}/candidate/${candidateId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import LaneBadge from "./LaneBadge.jsx";
import { experienceSummary, truncate, round } from "../lib/format.js";

export default function CandidateCard({
  candidate,
  job,
  selected,
  onToggleCompare,
}) {
  const score = candidate.score || {};
  const strength = (score.strengths || [])[0];
  const gap = (score.gaps || [])[0];
  const base = `/jobs/${candidate.job_id}`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-base font-medium text-gray-900">
          {candidate.profile?.name || "Unnamed candidate"}
        </div>
        <div className="flex items-center gap-2">
          <LaneBadge lane={score.lane} />
          <span
            className="text-base font-semibold text-gray-900"
            title={
              score.full_score_available === false
                ? "This score is based on CV only. Complete OCEAN + interview for full score."
                : undefined
            }
          >
            {round(score.combined_score)}%
            {score.full_score_available === false && (
              <span className="ml-1 text-xs font-normal text-gray-400">
                (partial)
              </span>
            )}
          </span>
        </div>
      </div>

      {candidate.low_confidence_warning && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-orange-600">
          <AlertTriangle size={14} />
          Low parse confidence — review original CV
        </div>
      )}

      {/* middle row */}
      <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
        <span>{experienceSummary(candidate, job)}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-500">
          {candidate.source || "upload"}
        </span>
      </div>

      {/* strengths / gaps */}
      {strength && (
        <div className="mt-3 text-sm">
          <span className="text-gray-400">Strengths: </span>
          <span className="text-gray-700">{truncate(strength)}</span>
        </div>
      )}
      {gap && (
        <div className="mt-1 text-sm">
          <span className="text-gray-400">Probe: </span>
          <span className="text-gray-700">{truncate(gap)}</span>
        </div>
      )}

      {/* actions */}
      <div className="mt-4 flex items-center gap-3">
        <Link
          to={`${base}/candidate/${candidate.candidate_id}`}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          View profile
        </Link>
        <Link
          to={`${base}/candidate/${candidate.candidate_id}/questions`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Interview questions
        </Link>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleCompare(candidate.candidate_id)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Compare
        </label>
      </div>
    </div>
  );
}

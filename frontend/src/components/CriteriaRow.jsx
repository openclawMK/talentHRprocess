import { barColor, round } from "../lib/format.js";
import SourceBadge from "./SourceBadge.jsx";

/**
 * One criterion row in a candidate's score breakdown.
 * Scored CV criteria show a colored bar; interview/ocean criteria show a
 * gray "Pending" bar until that data is collected.
 */
export default function CriteriaRow({ criterion }) {
  const { criterion_name, source, score, scored, weight, estimated, not_applicable } = criterion;
  return (
    <div className={`flex items-center gap-3 py-1.5 ${not_applicable ? "opacity-50" : ""}`}>
      <div className="flex w-52 shrink-0 items-center gap-2">
        <SourceBadge source={source} />
        <span className="truncate text-sm text-gray-600" title={criterion_name}>
          {criterion_name}
        </span>
      </div>

      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        {scored && !not_applicable ? (
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${round(score)}%`, backgroundColor: barColor(score) }}
          />
        ) : (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_6px,#f3f4f6_6px,#f3f4f6_12px)]" />
        )}
      </div>

      <div className="w-20 shrink-0 text-right text-sm">
        {not_applicable ? (
          <span className="text-xs italic text-gray-400">N/A</span>
        ) : scored ? (
          <span className="font-medium text-gray-700">
            {round(score)}%{estimated ? "*" : ""}
          </span>
        ) : (
          <span className="text-xs italic text-gray-400">Pending</span>
        )}
      </div>
      {weight != null && (
        <div className="w-10 shrink-0 text-right text-xs text-gray-400">
          {not_applicable ? "—" : `${Math.round(weight * 100)}%`}
        </div>
      )}
    </div>
  );
}

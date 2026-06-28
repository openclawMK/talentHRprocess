import { barColor, round } from "../lib/format.js";

/**
 * Horizontal score bar.
 * Optionally shows the dimension weight and its weighted contribution.
 */
export default function ScoreBar({ label, value, weight }) {
  const v = round(value);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 text-sm text-gray-500">{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${v}%`, backgroundColor: barColor(v) }}
        />
      </div>
      <div className="w-10 shrink-0 text-right text-sm font-medium text-gray-700">
        {v}%
      </div>
      {weight != null && (
        <div className="w-32 shrink-0 text-right text-xs text-gray-400">
          ×{Math.round(weight * 100)}% = {Math.round(v * weight)} pts
        </div>
      )}
    </div>
  );
}

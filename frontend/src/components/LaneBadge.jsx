import { LANE_META } from "../lib/format.js";

export default function LaneBadge({ lane, label }) {
  const meta = LANE_META[lane] || LANE_META.amber;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      {label || meta.label}
    </span>
  );
}

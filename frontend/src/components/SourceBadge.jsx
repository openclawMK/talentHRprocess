import { SOURCE_META } from "../lib/format.js";

export default function SourceBadge({ source }) {
  const m = SOURCE_META[source] || SOURCE_META.cv;
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: m.bg, color: m.text }}
    >
      {m.label}
    </span>
  );
}

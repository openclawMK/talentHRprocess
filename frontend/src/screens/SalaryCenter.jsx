import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const cardBox = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const SECTORS = [
  { key: "all", label: "All roles" },
  { key: "frontline", label: "Frontline / F&B / Retail" },
  { key: "professional", label: "Professional / Office" },
];
const SECTOR_BADGE = {
  frontline: { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  professional: { color: "#4338CA", bg: "#EEF2FF", border: "#C7D2FE" },
  other: { color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB" },
};
const SRC_BADGE = {
  "DOSM 2023": { color: "#047857", bg: "#ECFDF5" },
  "JobStreet 2026": { color: "#4338CA", bg: "#EEF2FF" },
  "Jobstore 2023": { color: "#6D28D9", bg: "#F5F3FF" },
  Market: { color: "#B45309", bg: "#FFF7ED" },
};

export default function SalaryCenter() {
  const [data, setData] = useState(null);
  const [region, setRegion] = useState("");
  const [sector, setSector] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    axios.get(`/api/salary-center${region ? `?region=${encodeURIComponent(region)}` : ""}`).then((r) => setData(r.data)).catch(() => setData(false));
  }, [region]);

  const rows = useMemo(() => {
    if (!data?.roles) return [];
    return data.roles.filter((r) =>
      (sector === "all" || r.sector === sector) &&
      (industry === "all" || r.industry === industry) &&
      (!q || r.category.toLowerCase().includes(q.toLowerCase()))
    );
  }, [data, sector, industry, q]);
  const scaleMax = useMemo(() => Math.max(1, ...rows.map((r) => r.max)), [rows]);

  if (data === false) return <div className="text-gray-500">Couldn't load the salary center.</div>;

  return (
    <div className="pb-8">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", margin: 0 }}>💰 Salary Center</h1>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 6, maxWidth: 620 }}>Malaysian market pay benchmarks — cross-validated across official statistics and live market data. {data ? `Showing ${data.region}.` : ""}</div>
        </div>
        {data && (
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ padding: "10px 14px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#374151", background: "#fff", cursor: "pointer" }}>
            {data.regions?.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }} className="flex-wrap">
        <div style={{ display: "flex", gap: 6 }} className="flex-wrap">
          {SECTORS.map((s) => {
            const on = sector === s.key;
            return <span key={s.key} onClick={() => setSector(s.key)} style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 14px", borderRadius: 8, color: on ? "#fff" : "#374151", background: on ? "linear-gradient(135deg,#6366F1,#7C3AED)" : "#F3F4F8" }}>{s.label}</span>;
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }} className="flex-wrap">
          {data?.industries?.length > 0 && (
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ padding: "9px 12px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: "#374151", background: "#fff", cursor: "pointer" }}>
              <option value="all">All industries</option>
              {data.industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a role…" style={{ padding: "9px 14px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 14, minWidth: 180, outline: "none" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardBox, overflow: "hidden" }}>
        <div className="hidden md:grid" style={{ gridTemplateColumns: "1.4fr 2fr 150px", gap: 16, padding: "13px 22px", background: "#FAFAFC", borderBottom: "1px solid #ECEDF2", fontSize: 12, fontWeight: 700, color: "#9AA0AE", letterSpacing: ".4px", textTransform: "uppercase" }}>
          <div>Role</div><div>Monthly range (min · median · max)</div><div>Sources</div>
        </div>
        {!data ? (
          <div style={{ padding: 40 }} className="animate-pulse">Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9AA0AE" }}>No roles match.</div>
        ) : rows.map((r, i) => {
          const sb = SECTOR_BADGE[r.sector] || SECTOR_BADGE.other;
          const left = (r.min / scaleMax) * 100, width = ((r.max - r.min) / scaleMax) * 100, med = (r.median / scaleMax) * 100;
          return (
            <div key={i} className="grid items-center md:!grid-cols-[1.4fr_2fr_150px]" style={{ gridTemplateColumns: "1fr", gap: 16, padding: "15px 22px", borderBottom: "1px solid #F1F2F6" }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1F2430" }}>{r.category}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sb.color, background: sb.bg, border: `1px solid ${sb.border}`, padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>{r.sector}</span>
                  {r.industry && <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", padding: "2px 8px", borderRadius: 6 }}>{r.industry}</span>}
                  {r.estimated && <span style={{ fontSize: 11, fontWeight: 600, color: "#B45309" }}>indicative estimate</span>}
                </div>
              </div>
              <div>
                <div style={{ position: "relative", height: 10, background: "#F1F2F6", borderRadius: 6, overflow: "visible", marginBottom: 6 }}>
                  <div style={{ position: "absolute", left: `${left}%`, width: `${Math.max(width, 1.5)}%`, top: 0, bottom: 0, background: "linear-gradient(90deg,#A78BFA,#7C3AED)", borderRadius: 6 }} />
                  <div style={{ position: "absolute", left: `${med}%`, top: -3, width: 3, height: 16, background: "#4338CA", borderRadius: 2, transform: "translateX(-50%)" }} title="median" />
                </div>
                <div style={{ fontSize: 12.5, color: "#4B5563" }}><b style={{ color: "#111827" }}>{r.median_label}</b> median · {r.min_label}–{r.max_label}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {r.sources.map((s) => { const c = SRC_BADGE[s] || SRC_BADGE.Market; return <span key={s} style={{ fontSize: 10.5, fontWeight: 700, color: c.color, background: c.bg, padding: "3px 7px", borderRadius: 6 }}>{s}</span>; })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Source footnote */}
      {data && (
        <div style={{ ...cardBox, padding: "16px 20px", marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Sources & method</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
            {data.meta?.sources?.map((s) => (
              <div key={s.id} style={{ fontSize: 12.5, color: "#4B5563" }}>• <b>{s.name}</b> <span style={{ color: "#9AA0AE", textTransform: "capitalize" }}>({s.type})</span></div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#9AA0AE", lineHeight: 1.55 }}>{data.meta?.note}</div>
        </div>
      )}
    </div>
  );
}

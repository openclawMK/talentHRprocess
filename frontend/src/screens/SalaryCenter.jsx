import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { usePalette } from "../context/ThemeContext.jsx";

const SECTORS = [
  { key: "all", label: "All roles" },
  { key: "frontline", label: "Frontline / F&B / Retail" },
  { key: "professional", label: "Professional / Office" },
];
const PAGE_SIZE = 25;

export default function SalaryCenter() {
  const D = usePalette();
  const cardBox = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16 };
  const SECTOR_BADGE = {
    frontline: { color: D.amber, bg: D.amberBg, border: D.amberBorder },
    professional: { color: D.blue, bg: D.blueBg, border: D.blueBorder },
    other: { color: D.text3, bg: D.pillBg, border: D.border },
  };
  const SRC_BADGE = {
    "DOSM 2023": { color: D.green, bg: D.greenBg },
    "JobStreet 2026": { color: D.blue, bg: D.blueBg },
    "Jobstore 2023": { color: "#8B5CF6", bg: "rgba(139,92,246,0.16)" },
    Market: { color: D.amber, bg: D.amberBg },
  };
  const [data, setData] = useState(null);
  const [region, setRegion] = useState("");
  const [sector, setSector] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    axios.get(`/api/salary-center${region ? `?region=${encodeURIComponent(region)}` : ""}`).then((r) => setData(r.data)).catch(() => setData(false));
  }, [region]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => { setPage(1); }, [sector, industry, q]);

  const filtered = useMemo(() => {
    if (!data?.roles) return [];
    return data.roles.filter((r) =>
      (sector === "all" || r.sector === sector) &&
      (industry === "all" || r.industry === industry) &&
      (!q || r.category.toLowerCase().includes(q.toLowerCase()))
    );
  }, [data, sector, industry, q]);

  const industryCounts = useMemo(() => {
    const c = {};
    (data?.roles || []).forEach((r) => { c[r.industry] = (c[r.industry] || 0) + 1; });
    return c;
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const rows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const scaleMax = useMemo(() => Math.max(1, ...filtered.map((r) => r.max)), [filtered]);

  if (data === false) return <div style={{ color: D.text3 }}>Couldn't load the salary center.</div>;

  return (
    <div className="pb-8">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", margin: 0, color: D.text }}>💰 Salary Center</h1>
          <div style={{ fontSize: 14, color: D.text3, marginTop: 6, maxWidth: 620 }}>Malaysian market pay benchmarks — cross-validated across official statistics and live market data. {data ? `Showing ${data.region}.` : ""}</div>
        </div>
        {data && (
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ padding: "10px 14px", border: `0.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, color: D.text2, background: D.cardBg, cursor: "pointer" }}>
            {data.regions?.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }} className="flex-wrap">
        <div style={{ display: "flex", gap: 6 }} className="flex-wrap">
          {SECTORS.map((s) => {
            const on = sector === s.key;
            return <span key={s.key} onClick={() => setSector(s.key)} style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 14px", borderRadius: 8, color: on ? "#fff" : D.text2, background: on ? "linear-gradient(135deg,#6366F1,#7C3AED)" : D.pillBg }}>{s.label}</span>;
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }} className="flex-wrap">
          {data?.industries?.length > 0 && (
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ padding: "9px 12px", border: `0.5px solid ${D.border}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: D.text2, background: D.cardBg, cursor: "pointer" }}>
              <option value="all">All industries ({data.roles?.length ?? 0})</option>
              {data.industries.map((i) => <option key={i} value={i}>{i} ({industryCounts[i] || 0})</option>)}
            </select>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a role…" style={{ padding: "9px 14px", border: `0.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, minWidth: 180, outline: "none", background: D.cardBg, color: D.text }} />
        </div>
      </div>

      {/* Data freshness — state it plainly rather than implying live data */}
      {data?.meta?.last_verified && (() => {
        const fmt = (d) => new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
        const overdue = data.meta.next_review && new Date(data.meta.next_review) < new Date();
        return (
          <div style={{ ...cardBox, padding: "12px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: overdue ? D.amber : D.green, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, color: D.text2 }}>
                Sources verified <b style={{ color: D.text }}>{fmt(data.meta.last_verified)}</b>
                {data.meta.next_review && (
                  <span style={{ color: overdue ? D.amber : D.text4 }}>
                    {" · "}{overdue ? "review overdue" : `next review ${fmt(data.meta.next_review)}`}
                  </span>
                )}
              </div>
              {data.meta.freshness_note && <div style={{ fontSize: 11.5, color: D.text4, marginTop: 2, lineHeight: 1.45 }}>{data.meta.freshness_note}</div>}
            </div>
            {data.meta.review_cadence && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: D.text3, background: D.pillBg, border: `0.5px solid ${D.border}`, padding: "3px 9px", borderRadius: 20, textTransform: "capitalize", whiteSpace: "nowrap" }}>{data.meta.review_cadence} review</span>
            )}
          </div>
        );
      })()}

      {/* Result count */}
      {data && (
        <div style={{ fontSize: 13, color: D.text4, marginBottom: 10 }}>
          {filtered.length === 0 ? "No roles match" : `Showing ${(pageSafe - 1) * PAGE_SIZE + 1}–${Math.min(pageSafe * PAGE_SIZE, filtered.length)} of ${filtered.length} role${filtered.length === 1 ? "" : "s"}`}
        </div>
      )}

      {/* Table */}
      <div style={{ ...cardBox, overflow: "hidden" }}>
        <div className="hidden md:grid" style={{ gridTemplateColumns: "1.4fr 2fr 150px", gap: 16, padding: "13px 22px", background: D.inset, borderBottom: `0.5px solid ${D.border}`, fontSize: 12, fontWeight: 700, color: D.text4, letterSpacing: ".4px", textTransform: "uppercase" }}>
          <div>Role</div><div>Monthly range (min · median · max)</div><div>Sources</div>
        </div>
        {!data ? (
          <div style={{ padding: 40, color: D.text3 }} className="animate-pulse">Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: D.text4 }}>No roles match.</div>
        ) : rows.map((r, i) => {
          const sb = SECTOR_BADGE[r.sector] || SECTOR_BADGE.other;
          const left = (r.min / scaleMax) * 100, width = ((r.max - r.min) / scaleMax) * 100, med = (r.median / scaleMax) * 100;
          return (
            <div key={i} className="grid items-center md:!grid-cols-[1.4fr_2fr_150px]" style={{ gridTemplateColumns: "1fr", gap: 16, padding: "15px 22px", borderBottom: `0.5px solid ${D.hair}` }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: D.text }}>{r.category}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sb.color, background: sb.bg, border: `1px solid ${sb.border}`, padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>{r.sector}</span>
                  {r.industry && <span style={{ fontSize: 11, fontWeight: 600, color: D.text3, background: D.pillBg, padding: "2px 8px", borderRadius: 6 }}>{r.industry}</span>}
                  {r.source_year && <span title="Newest source year behind this figure" style={{ fontSize: 10.5, color: D.text4 }}>as of {r.source_year}</span>}
                  {r.estimated && <span style={{ fontSize: 11, fontWeight: 600, color: D.amber }}>indicative estimate</span>}
                </div>
              </div>
              <div>
                <div style={{ position: "relative", height: 10, background: D.inset, borderRadius: 6, overflow: "visible", marginBottom: 6 }}>
                  <div style={{ position: "absolute", left: `${left}%`, width: `${Math.max(width, 1.5)}%`, top: 0, bottom: 0, background: "linear-gradient(90deg,#A78BFA,#7C3AED)", borderRadius: 6 }} />
                  <div style={{ position: "absolute", left: `${med}%`, top: -3, width: 3, height: 16, background: D.blue, borderRadius: 2, transform: "translateX(-50%)" }} title="median" />
                </div>
                <div style={{ fontSize: 12.5, color: D.text3 }}><b style={{ color: D.text }}>{r.median_label}</b> median · {r.min_label}–{r.max_label}</div>

                {r.tiers && (
                  <div style={{ marginTop: 9 }}>
                    <div style={{ fontSize: 10, color: D.text5, marginBottom: 4 }} title="Derived from this row's own min/median/max, not a separately-sourced figure per tier">By experience (indicative)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {r.tiers.map((t) => {
                        const tLeft = (t.min / scaleMax) * 100, tWidth = ((t.max - t.min) / scaleMax) * 100;
                        const tColor = t.tier === "junior" ? "rgba(124,58,237,0.35)" : t.tier === "mid" ? "rgba(124,58,237,0.65)" : "rgba(124,58,237,0.95)";
                        return (
                          <div key={t.tier} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 42, fontSize: 10, fontWeight: 700, color: D.text4, textTransform: "capitalize", flexShrink: 0 }}>{t.tier}</span>
                            <div style={{ position: "relative", flex: 1, height: 5, background: D.inset, borderRadius: 4 }}>
                              <div style={{ position: "absolute", left: `${tLeft}%`, width: `${Math.max(tWidth, 1)}%`, top: 0, bottom: 0, background: tColor, borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 10.5, color: D.text4, whiteSpace: "nowrap", flexShrink: 0 }}>{t.min_label}–{t.max_label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {r.live_asking_rate && r.live_asking_rate.confidence !== "insufficient" && (
                  <div style={{ fontSize: 12, color: D.green, marginTop: 5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.green, flexShrink: 0 }} />
                    <span>Live asking rate: <b>{r.live_asking_rate.median_label}</b> median · n={r.live_asking_rate.count}</span>
                    {r.live_asking_rate.confidence === "early" && (
                      <span title="Small sample — directional, not confirmed" style={{ fontSize: 10, fontWeight: 700, color: D.amber, background: D.amberBg, border: `0.5px solid ${D.amberBorder}`, padding: "1px 6px", borderRadius: 20 }}>early signal</span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {r.sources.map((s) => { const c = SRC_BADGE[s] || SRC_BADGE.Market; return <span key={s} style={{ fontSize: 10.5, fontWeight: 700, color: c.color, background: c.bg, padding: "3px 7px", borderRadius: 6 }}>{s}</span>; })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1} style={{ padding: "8px 14px", border: `0.5px solid ${D.border}`, borderRadius: 9, background: D.cardBg, fontSize: 13, fontWeight: 600, color: D.text2, cursor: pageSafe === 1 ? "default" : "pointer", opacity: pageSafe === 1 ? 0.4 : 1 }}>← Prev</button>
          <span style={{ fontSize: 13, color: D.text3, padding: "0 6px" }}>Page {pageSafe} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages} style={{ padding: "8px 14px", border: `0.5px solid ${D.border}`, borderRadius: 9, background: D.cardBg, fontSize: 13, fontWeight: 600, color: D.text2, cursor: pageSafe === totalPages ? "default" : "pointer", opacity: pageSafe === totalPages ? 0.4 : 1 }}>Next →</button>
        </div>
      )}

      {/* Source footnote */}
      {data && (
        <div style={{ ...cardBox, padding: "16px 20px", marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: D.text3, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Sources & method</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
            {data.meta?.sources?.map((s) => (
              <div key={s.id} style={{ fontSize: 12.5, color: D.text3 }}>• <b>{s.name}</b> <span style={{ color: D.text4, textTransform: "capitalize" }}>({s.type})</span></div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: D.text4, lineHeight: 1.55 }}>{data.meta?.note}</div>
        </div>
      )}
    </div>
  );
}

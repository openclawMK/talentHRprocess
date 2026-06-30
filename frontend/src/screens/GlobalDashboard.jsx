import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Users, Gauge, CheckCircle2, Clock, UploadCloud, Plus, MessageCircle, Download, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const STAGES = [
  { key: "cv_submission", label: "CV" },
  { key: "ocean_assessment", label: "OCEAN" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
];

const QUICK = [
  { icon: UploadCloud, title: "Upload & score CV", sub: "Parse a PDF or DOCX CV and auto-score it", to: "/upload" },
  { icon: Plus, title: "Create job role", sub: "Draft scoring criteria automatically with AI", to: "/jobs/new" },
  { icon: MessageCircle, title: "Send OCEAN link", sub: "WhatsApp a candidate their assessment", to: "/jobs" },
  { icon: Download, title: "Export reports", sub: "Download candidate assessments as PDF", to: "/jobs" },
];

export default function GlobalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [a, setA] = useState(null);

  useEffect(() => {
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(false));
  }, []);

  const firstName = (user?.name || "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (a === null) return <div className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white" />;

  const stats = [
    { label: "Total applicants", value: a?.total_applicants ?? 0, icon: Users, bg: "#EEF2FF", sub: `${a?.open_roles ?? 0} open roles` },
    { label: "Average score", value: a?.avg_score ?? 0, suffix: "/100", icon: Gauge, bg: "#F5F3FF", sub: "Across all open roles" },
    { label: "Green candidates", value: a?.green_count ?? 0, icon: CheckCircle2, bg: "#ECFDF5", sub: "Ready to advance" },
    { label: "In interview", value: a?.in_interview ?? 0, icon: Clock, bg: "#FFFBEB", sub: `${a?.offers_pending ?? 0} offers pending` },
  ];
  const funMax = Math.max(1, ...STAGES.map((s) => a?.by_stage?.[s.key] ?? 0));
  const lanes = a?.lane_breakdown || {};

  return (
    <div>
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening across your {a?.open_roles ?? 0} open role{a?.open_roles === 1 ? "" : "s"} today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/upload")} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <UploadCloud size={16} /> Upload CV
          </button>
          <button onClick={() => navigate("/jobs/new")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>
            <Plus size={16} /> Create job
          </button>
        </div>
      </div>

      {/* quick tools */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <button key={q.title} onClick={() => navigate(q.to)} className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: "#EEF2FF", color: "#6366F1" }}>
                <Icon size={18} />
              </div>
              <div className="mt-2.5 text-sm font-semibold text-gray-900">{q.title}</div>
              <div className="text-xs text-gray-500">{q.sub}</div>
            </button>
          );
        })}
      </div>

      {/* stale alert */}
      {a?.stale_top && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: "#FDE68A", backgroundColor: "#FFFBEB" }}>
          <div className="flex items-center gap-2.5 text-sm text-amber-900">
            <AlertTriangle size={18} className="text-amber-500" />
            <span>
              <strong>{a.stale_top.name}</strong> has been waiting in {a.stale_top.current_stage.replace("_", " ")} for {a.stale_top.days_waiting} days.
              {a.stale_count > 1 && ` ${a.stale_count} candidates across your roles are going stale.`}
            </span>
          </div>
          <button onClick={() => navigate("/jobs")} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">
            Review now
          </button>
        </div>
      )}

      {/* stat cards */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-gray-500">{s.label}</span>
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ backgroundColor: s.bg }}>
                  <Icon size={16} className="text-gray-700" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold text-gray-900">
                {s.value}<span className="text-base font-medium text-gray-400">{s.suffix || ""}</span>
              </div>
              <div className="mt-1 text-xs text-gray-400">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* funnel + lane breakdown */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Pipeline funnel</h2>
          <p className="text-xs text-gray-400">Candidates by current stage</p>
          <div className="mt-4 space-y-3">
            {STAGES.map((s) => {
              const n = a?.by_stage?.[s.key] ?? 0;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-20 shrink-0 text-sm text-gray-600">{s.label}</div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${(n / funMax) * 100}%`, background: "linear-gradient(90deg,#6366F1,#7C3AED)" }} />
                  </div>
                  <div className="w-8 shrink-0 text-right text-sm font-semibold text-gray-700">{n}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Lane breakdown</h2>
          <p className="text-xs text-gray-400">AI fit across all candidates</p>
          <div className="mt-4 space-y-3">
            {[
              { k: "green", label: "Green · strong fit", color: "#059669" },
              { k: "amber", label: "Amber · review", color: "#D97706" },
              { k: "red", label: "Red · likely no", color: "#DC2626" },
            ].map((l) => {
              const d = lanes[l.k] || { count: 0, pct: 0 };
              return (
                <div key={l.k}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{l.label}</span>
                    <span className="font-medium text-gray-700">{d.count} <span className="text-gray-400">· {d.pct}%</span></span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${d.pct}%`, backgroundColor: l.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* active job roles */}
      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Active job roles</h2>
          <button onClick={() => navigate("/jobs")} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
            View all <ArrowRight size={13} />
          </button>
        </div>
        <div className="mt-3 divide-y divide-gray-100">
          {(a?.roles || []).map((j) => (
            <button key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left hover:bg-gray-50">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{j.title}</div>
                <div className="text-xs text-gray-400">{j.dept} · {j.location}{j.stale > 0 ? ` · ⚠ ${j.stale} stale` : ""}</div>
              </div>
              <div className="flex items-center gap-5 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{j.applicants}</div>
                  <div className="text-[11px] text-gray-400">applicants</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{j.avg}</div>
                  <div className="text-[11px] text-gray-400">avg score</div>
                </div>
                <div className="hidden items-center gap-2 text-xs sm:flex">
                  <span className="text-green-600">🟢 {j.g}</span>
                  <span className="text-amber-600">🟡 {j.a}</span>
                  <span className="text-red-600">🔴 {j.r}</span>
                </div>
              </div>
            </button>
          ))}
          {(a?.roles || []).length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">No roles yet — create one to get started.</div>
          )}
        </div>
      </section>
    </div>
  );
}

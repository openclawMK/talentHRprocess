import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Sparkles, Plus, X, Save } from "lucide-react";

const OCEAN_LEVELS = ["low", "medium-low", "medium", "medium-high", "high"];
const TRAITS = [
  ["O", "Openness"],
  ["C", "Conscientiousness"],
  ["E", "Extraversion"],
  ["A", "Agreeableness"],
  ["N", "Neuroticism (low = better)"],
];

const EMPTY = {
  summary: "",
  must_haves: [],
  nice_to_haves: [],
  dealbreakers: [],
  ideal_ocean_profile: { O: "medium", C: "high", E: "medium", A: "high", N: "low" },
  benchmark_experience_years: 2,
  benchmark_team_size: 0,
};

export default function SuccessProfile() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [aiBanner, setAiBanner] = useState(false);

  useEffect(() => {
    axios.get("/api/jobs").then((r) => setJob(r.data.find((j) => j.job_id === jobId) || null));
    axios
      .get(`/api/jobs/${jobId}/success-profile`)
      .then((r) => setProfile(r.data && Object.keys(r.data).length ? { ...EMPTY, ...r.data } : { ...EMPTY }))
      .catch(() => setProfile({ ...EMPTY }));
  }, [jobId]);

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  async function generate() {
    setGenerating(true);
    try {
      const r = await axios.post(`/api/jobs/${jobId}/success-profile/generate`);
      setProfile({ ...EMPTY, ...r.data });
      setAiBanner(true);
    } catch {
      setToast("Couldn't generate — please try again.");
      setTimeout(() => setToast(""), 2500);
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await axios.put(`/api/jobs/${jobId}/success-profile`, profile);
      setAiBanner(false);
      setToast("Success profile saved");
      setTimeout(() => setToast(""), 2500);
    } catch {
      setToast("Save failed — please try again.");
      setTimeout(() => setToast(""), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />;

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <Link to={`/jobs/${jobId}/dashboard`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">Role Success Profile</h1>
          <p className="text-sm text-gray-500">{job?.role_title || "Role"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
          >
            <Sparkles size={15} /> {generating ? "Generating…" : "Generate with AI"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "#6D28D9" }}
          >
            <Save size={15} /> {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>

      {aiBanner && (
        <div className="mt-3 rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-800">
          AI-generated — please review before saving.
        </div>
      )}
      {toast && (
        <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{toast}</div>
      )}

      {/* Summary */}
      <section className="mt-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Summary</span>
          <textarea
            rows={3}
            value={profile.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="What does a great hire for this role look like?"
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
      </section>

      {/* Must / Nice */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TagEditor label="Must-Haves" items={profile.must_haves} onChange={(v) => set("must_haves", v)} accent="#065F46" bg="#F0FDF4" />
        <TagEditor label="Nice-to-Haves" items={profile.nice_to_haves} onChange={(v) => set("nice_to_haves", v)} accent="#1D4ED8" bg="#EFF6FF" />
      </div>

      {/* Dealbreakers */}
      <div className="mt-4">
        <TagEditor label="Dealbreakers ⛔" items={profile.dealbreakers} onChange={(v) => set("dealbreakers", v)} accent="#991B1B" bg="#FEF2F2" />
      </div>

      {/* OCEAN */}
      <section className="mt-5 rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium text-gray-900">Ideal OCEAN Profile</h2>
        <div className="mt-3 space-y-3">
          {TRAITS.map(([key, label]) => {
            const val = profile.ideal_ocean_profile?.[key] || "medium";
            const idx = OCEAN_LEVELS.indexOf(val);
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-52 shrink-0 text-sm text-gray-600">
                  <span className="font-semibold text-gray-700">{key}</span> {label}
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={idx < 0 ? 2 : idx}
                  onChange={(e) =>
                    set("ideal_ocean_profile", { ...profile.ideal_ocean_profile, [key]: OCEAN_LEVELS[Number(e.target.value)] })
                  }
                  className="flex-1 accent-purple-600"
                />
                <div className="w-24 shrink-0 text-right text-xs font-medium capitalize text-gray-600">{val}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Benchmarks */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Experience benchmark (years)</span>
          <input
            type="number"
            min="0"
            value={profile.benchmark_experience_years}
            onChange={(e) => set("benchmark_experience_years", Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Team size benchmark (people)</span>
          <input
            type="number"
            min="0"
            value={profile.benchmark_team_size}
            onChange={(e) => set("benchmark_team_size", Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

function TagEditor({ label, items, onChange, accent, bg }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  function add() {
    const v = text.trim();
    if (v) onChange([...(items || []), v]);
    setText("");
    setAdding(false);
  }

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700">{label}</h3>
      <div className="mt-2 space-y-1.5">
        {(items || []).map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm" style={{ backgroundColor: bg, color: accent }}>
            <span>{it}</span>
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setText(""); setAdding(false); } }}
          onBlur={add}
          placeholder="Type and press Enter…"
          className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
        />
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
          <Plus size={13} /> Add item
        </button>
      )}
    </section>
  );
}

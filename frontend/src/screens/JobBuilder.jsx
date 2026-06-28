import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Sparkles, Trash2, Plus, RotateCcw, X } from "lucide-react";
import SourceBadge from "../components/SourceBadge.jsx";

const INDUSTRIES = [
  "F&B",
  "Hospitality",
  "Retail",
  "Manufacturing & Production",
  "Logistics & Warehouse",
  "Early Childhood Education",
  "Other",
];
const EDUCATION = ["SPM", "Diploma", "Degree", "Any"];
const SOURCES = ["cv", "interview", "ocean"];

const ROLE_LEVELS = [
  { value: "entry",       label: "Entry-level",             hint: "CV 35% · OCEAN 15% · Interview 50%" },
  { value: "supervisory", label: "Supervisory / Management", hint: "CV 45% · OCEAN 10% · Interview 45%" },
];

export default function JobBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    role_title: "",
    industry: "F&B",
    location: "Kuala Lumpur",
    role_level: "entry",
    experience_years_min: 1,
    education_level_min: "SPM",
    key_responsibilities: "",
  });
  const [criteria, setCriteria] = useState([]);
  const [original, setOriginal] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newC, setNewC] = useState({ name: "", source: "cv", weight: 10 });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const total = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);
  const totalPct = Math.round(total * 100);
  const valid = Math.abs(total - 1) <= 0.01;

  const responsibilitiesList = () =>
    form.key_responsibilities
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  async function generate() {
    if (!form.role_title.trim()) {
      setError("Please enter a role title.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const res = await axios.post("/api/generate-criteria", {
        industry: form.industry,
        role_title: form.role_title,
        role_level: form.role_level,
        key_responsibilities: responsibilitiesList(),
      });
      const c = res.data.criteria || [];
      setCriteria(c);
      setOriginal(c);
      setStep(2);
    } catch {
      setError("Couldn't generate criteria. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function updateWeight(id, pct) {
    setCriteria((cs) =>
      cs.map((c) => (c.id === id ? { ...c, weight: pct / 100 } : c))
    );
  }
  function remove(id) {
    setCriteria((cs) => cs.filter((c) => c.id !== id));
  }
  function addCriterion() {
    if (!newC.name.trim()) return;
    setCriteria((cs) => [
      ...cs,
      {
        id: `c${cs.length + 1}_${Date.now()}`,
        name: newC.name.trim(),
        source: newC.source,
        weight: newC.weight / 100,
        description: "",
      },
    ]);
    setNewC({ name: "", source: "cv", weight: 10 });
    setShowAdd(false);
  }
  function reset() {
    setCriteria(original);
  }

  async function save() {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const res = await axios.post("/api/jobs", {
        role_title: form.role_title,
        industry: form.industry,
        location: form.location,
        role_level: form.role_level,
        requirements: {
          experience_years_min: Number(form.experience_years_min) || 0,
          education_level_min: form.education_level_min,
        },
        key_responsibilities: responsibilitiesList(),
        criteria: criteria.map((c, i) => ({
          id: `c${i + 1}`,
          name: c.name,
          weight: c.weight,
          source: c.source,
          description: c.description || "",
        })),
      });
      navigate(`/jobs/${res.data.job_id}/upload`);
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't create the role.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to roles
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900">
        Create a new role
      </h1>

      {/* STEP 1 — role details */}
      {step === 1 && (
        <div className="mt-6 space-y-4">
          <Field label="Role title">
            <input
              className="input"
              value={form.role_title}
              onChange={(e) => set("role_title", e.target.value)}
              placeholder="e.g. Restaurant Manager"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Industry">
              <select
                className="input"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              >
                {INDUSTRIES.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input
                className="input"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Role level">
            <div className="mt-1 grid grid-cols-2 gap-3">
              {ROLE_LEVELS.map((rl) => (
                <button
                  key={rl.value}
                  type="button"
                  onClick={() => set("role_level", rl.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    form.role_level === rl.value
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`text-sm font-medium ${form.role_level === rl.value ? "text-purple-700" : "text-gray-800"}`}>
                    {rl.label}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">{rl.hint}</div>
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min experience (years)">
              <input
                type="number"
                min="0"
                className="input"
                value={form.experience_years_min}
                onChange={(e) => set("experience_years_min", e.target.value)}
              />
            </Field>
            <Field label="Minimum education">
              <select
                className="input"
                value={form.education_level_min}
                onChange={(e) => set("education_level_min", e.target.value)}
              >
                {EDUCATION.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Key responsibilities (one per line)">
            <textarea
              className="input"
              rows={4}
              value={form.key_responsibilities}
              onChange={(e) => set("key_responsibilities", e.target.value)}
              placeholder={"Manage daily operations\nLead a team of 15 staff\nOwn P&L and cost control"}
            />
          </Field>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: "#6D28D9" }}
          >
            {generating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40" style={{ borderTopColor: "#fff" }} />
                Generating criteria for {form.role_title || "role"}...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate criteria →
              </>
            )}
          </button>
        </div>
      )}

      {/* STEP 2 — criteria review */}
      {step === 2 && (
        <div className="mt-6">
          <p className="text-sm text-gray-500">
            AI-generated criteria for <strong>{form.role_title}</strong>. Adjust
            weights, add or remove criteria, then save.
          </p>

          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Criterion</th>
                  <th className="px-3 py-2 w-56">Weight</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{c.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={Math.round(c.weight * 100)}
                          onChange={(e) => updateWeight(c.id, Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="w-9 text-right text-xs font-medium text-gray-600">
                          {Math.round(c.weight * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <SourceBadge source={c.source} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => remove(c.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div
              className={`text-sm font-medium ${valid ? "text-green-700" : "text-red-600"}`}
            >
              Total: {totalPct}%{valid ? " ✓" : " — adjust to reach 100%"}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <Plus size={15} /> Add criterion
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <RotateCcw size={14} /> Reset to AI suggestion
              </button>
            </div>
          </div>

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={save}
              disabled={!valid || saving}
              className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#6D28D9" }}
            >
              {saving ? "Creating role..." : "Save & create role →"}
            </button>
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to details
            </button>
          </div>
        </div>
      )}

      {/* Add criterion modal */}
      {showAdd && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Add criterion</h3>
              <button onClick={() => setShowAdd(false)}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                className="input"
                placeholder="Criterion name"
                value={newC.name}
                onChange={(e) => setNewC({ ...newC, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="input"
                  value={newC.source}
                  onChange={(e) => setNewC({ ...newC, source: e.target.value })}
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="50"
                    className="input"
                    value={newC.weight}
                    onChange={(e) => setNewC({ ...newC, weight: Number(e.target.value) })}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
            <button
              onClick={addCriterion}
              className="mt-4 w-full rounded-md px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#6D28D9" }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

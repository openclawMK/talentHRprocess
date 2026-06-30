import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Link2, Check, SlidersHorizontal, MessageCircle, Send } from "lucide-react";
import CandidateCard from "../components/CandidateCard.jsx";
import Modal from "../components/Modal.jsx";
import { displayLane } from "../lib/format.js";

const TABS = ["all", "green", "amber", "red"];

export default function Dashboard() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState(null);
  const [job, setJob] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [copied, setCopied] = useState(false);
  const [pipeline, setPipeline] = useState(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [savingStage, setSavingStage] = useState(null);
  const [waModal, setWaModal] = useState(false);
  const [waForm, setWaForm] = useState({ candidate_name: "", phone: "" });
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState(null);
  const [hrAlerts, setHrAlerts] = useState(false);
  const [hrPhone, setHrPhone] = useState("");
  const [hrSaved, setHrSaved] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  async function saveHrAlerts(alerts = hrAlerts, phone = hrPhone) {
    try {
      await axios.patch(`/api/jobs/${jobId}/whatsapp-settings`, {
        hr_whatsapp_alerts: alerts,
        hr_contact_phone: phone,
      });
      setHrSaved(true);
      setTimeout(() => setHrSaved(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function sendPortalLink() {
    if (!waForm.phone.trim()) return;
    setWaSending(true);
    setWaResult(null);
    try {
      const res = await axios.post(`/api/jobs/${jobId}/send-portal-link`, waForm);
      setWaResult(res.data);
    } catch (e) {
      setWaResult({ error: e.response?.data?.error || "Failed to send." });
    } finally {
      setWaSending(false);
    }
  }

  function copyLink() {
    if (!job?.portal_token) return;
    const url = `${window.location.origin}/apply/${job.portal_token}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => window.prompt("Copy this application link:", url)
    );
  }

  const load = useCallback(() => {
    axios
      .get(`/api/candidates/${jobId}`)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]));
  }, [jobId]);

  useEffect(() => {
    axios.get("/api/jobs").then((res) => {
      const j = res.data.find((x) => x.job_id === jobId) || null;
      setJob(j);
      if (j) {
        setHrAlerts(!!j.hr_whatsapp_alerts);
        setHrPhone(j.hr_contact_phone || "");
      }
    });
    axios
      .get(`/api/jobs/${jobId}/pipeline`)
      .then((res) => setPipeline(res.data))
      .catch(() => setPipeline(null));
  }, [jobId]);

  const loadAnalytics = useCallback(() => {
    axios
      .get(`/api/jobs/${jobId}/analytics`)
      .then((res) => setAnalytics(res.data?.empty ? null : res.data))
      .catch(() => setAnalytics(null));
  }, [jobId]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  async function toggleStage(key) {
    if (!pipeline) return;
    const stage = pipeline.stages.find((s) => s.key === key);
    if (!stage || stage.locked) return;
    setSavingStage(key);
    try {
      const res = await axios.patch(`/api/jobs/${jobId}/pipeline`, {
        stages: { [key]: !stage.enabled },
      });
      setPipeline(res.data);
      load(); // candidate scores were reconciled server-side
    } catch {
      /* ignore */
    } finally {
      setSavingStage(null);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // poll for new applications
    return () => clearInterval(t);
  }, [load]);

  async function deleteCandidate(id) {
    if (!window.confirm("Delete this candidate and their scores? This can't be undone.")) return;
    setCandidates((prev) => (prev || []).filter((c) => c.candidate_id !== id));
    setSelected((prev) => prev.filter((x) => x !== id));
    try {
      await axios.delete(`/api/candidates/${jobId}/${id}`);
      loadAnalytics();
    } catch {
      /* ignore */
    }
  }

  function toggleCompare(id) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
        ? [...prev, id]
        : prev
    );
  }

  // sort candidates by score, highest first
  const merged = [...(candidates || [])].sort(
    (x, y) => (y.score?.combined_score ?? -1) - (x.score?.combined_score ?? -1)
  );

  const visible = merged.filter(
    (c) => filter === "all" || displayLane(c.score) === filter
  );

  return (
    <div className="pb-20">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            {job?.role_title || "Candidates"}
          </h1>
          {candidates && (
            <span className="text-sm text-gray-400">
              {merged.length} candidate{merged.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWaResult(null); setWaModal(true); }}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={16} /> Send via WhatsApp
          </button>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#6D28D9" }}
          >
            {copied ? (
              <><Check size={16} /> Link copied</>
            ) : (
              <><Link2 size={16} /> Copy application link</>
            )}
          </button>
        </div>
      </div>

      {/* Send portal link via WhatsApp */}
      {waModal && (
        <Modal title="Send application link via WhatsApp" onClose={() => setWaModal(false)}>
          {waResult?.ok ? (
            <div className="text-sm">
              <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">
                {waResult.skipped
                  ? "WhatsApp isn't configured yet — message logged but not sent."
                  : "Message sent! ✅"}
              </div>
              <p className="mt-3 break-all text-xs text-gray-500">Link: {waResult.portal_url}</p>
              <button
                onClick={() => setWaModal(false)}
                className="mt-4 w-full rounded-md bg-gray-900 py-2 text-sm font-medium text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Candidate name</span>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  value={waForm.candidate_name}
                  onChange={(e) => setWaForm({ ...waForm, candidate_name: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Phone (Malaysian)</span>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  value={waForm.phone}
                  onChange={(e) => setWaForm({ ...waForm, phone: e.target.value })}
                  placeholder="012-345 6789"
                />
              </label>
              {waResult?.error && <p className="text-sm text-red-600">{waResult.error}</p>}
              <button
                onClick={sendPortalLink}
                disabled={waSending || !waForm.phone.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#25D366" }}
              >
                <Send size={15} /> {waSending ? "Sending…" : "Send link"}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Analytics panel (Session 11) */}
      {analytics && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Applicants", value: analytics.total_applicants, sub: null, color: "#111827" },
              { label: "Strong", value: analytics.by_lane?.green ?? 0, sub: "green", color: "#059669" },
              { label: "Review", value: analytics.by_lane?.amber ?? 0, sub: "amber", color: "#D97706" },
              { label: "Gaps", value: analytics.by_lane?.red ?? 0, sub: "red", color: "#DC2626" },
              { label: "Avg score", value: `${analytics.avg_score}%`, sub: null, color: "#6D28D9" },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-400">{c.label}</div>
                <div className="mt-0.5 text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Pipeline funnel */}
          {(() => {
            const stages = [
              { key: "applications", label: "Applications", n: analytics.total_applicants },
              { key: "cv_submission", label: "CV", n: analytics.by_stage?.cv_submission ?? 0 },
              { key: "ocean_assessment", label: "OCEAN", n: analytics.by_stage?.ocean_assessment ?? 0 },
              { key: "interview", label: "Interview", n: analytics.by_stage?.interview ?? 0 },
              { key: "offer", label: "Offer", n: analytics.by_stage?.offer ?? 0 },
            ];
            const maxStage = Math.max(...stages.slice(1).map((s) => s.n));
            return (
              <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3">
                {stages.map((st, i) => {
                  const bottleneck = i > 0 && st.n === maxStage && maxStage > 0;
                  return (
                    <div key={st.key} className="flex items-center gap-1">
                      <div
                        className="rounded-md px-2.5 py-1 text-center"
                        style={{ backgroundColor: bottleneck ? "#FEF3C7" : "#F9FAFB" }}
                      >
                        <div className="text-sm font-bold text-gray-900">{st.n}</div>
                        <div className="text-[10px] text-gray-500">{st.label}</div>
                      </div>
                      {i < stages.length - 1 && <span className="text-gray-300">→</span>}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Oldest pending alert */}
          {analytics.oldest_pending_candidate?.days_waiting > 5 && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠ {analytics.oldest_pending_candidate.name} has been waiting{" "}
              {analytics.oldest_pending_candidate.days_waiting} days at{" "}
              {analytics.oldest_pending_candidate.current_stage.replace("_", " ")} — consider following up
            </div>
          )}
        </div>
      )}

      {/* Pipeline configurator */}
      {pipeline && (
        <div className="mt-4 rounded-lg border border-gray-200">
          <button
            onClick={() => setShowPipeline((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <SlidersHorizontal size={15} className="text-purple-600" /> Pipeline setup
            </span>
            <span className="flex items-center gap-2 text-xs text-gray-400">
              {Object.entries(pipeline.source_shares || {}).map(([k, v]) => (
                <span key={k} className="uppercase">{k} {Math.round(v * 100)}%</span>
              ))}
              <span className="text-gray-300">{showPipeline ? "▲" : "▼"}</span>
            </span>
          </button>

          {showPipeline && (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">
                Turn stages on or off for this role. Disabled stages drop out of scoring and their
                weight is redistributed across the remaining stages.
              </p>
              <div className="mt-3 space-y-2">
                {pipeline.stages.map((s) => {
                  const meta = { cv_submission: "CV submission", ocean_assessment: "OCEAN assessment", interview: "Interview", offer: "Offer" }[s.key];
                  return (
                    <div key={s.key} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                      <span className="text-sm text-gray-700">
                        {meta}
                        {s.locked && <span className="ml-2 text-xs text-gray-400">(always on)</span>}
                      </span>
                      <button
                        onClick={() => toggleStage(s.key)}
                        disabled={s.locked || savingStage === s.key}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          s.enabled ? "bg-purple-600" : "bg-gray-300"
                        } ${s.locked ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                            s.enabled ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* WhatsApp HR alerts */}
              <div className="mt-4 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <MessageCircle size={14} className="text-green-600" /> WhatsApp HR alerts
                  </span>
                  <button
                    onClick={() => { const v = !hrAlerts; setHrAlerts(v); saveHrAlerts(v, hrPhone); }}
                    className={`relative h-5 w-9 rounded-full transition-colors ${hrAlerts ? "bg-green-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${hrAlerts ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Get a WhatsApp ping when a strong candidate (score ≥ green threshold) applies.
                </p>
                {hrAlerts && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={hrPhone}
                      onChange={(e) => setHrPhone(e.target.value)}
                      placeholder="Your phone e.g. 012-345 6789"
                      className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
                    />
                    <button
                      onClick={() => saveHrAlerts()}
                      className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
                    >
                      {hrSaved ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* filter tabs */}
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              filter === t
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {candidates === null ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-lg border border-gray-200 bg-gray-50"
            />
          ))
        ) : visible.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-500">
            {merged.length === 0 ? (
              <>
                No candidates yet.{" "}
                <button
                  onClick={copyLink}
                  className="font-medium text-gray-900 underline"
                >
                  Copy the application link to share with candidates →
                </button>
              </>
            ) : (
              "No candidates in this lane."
            )}
          </div>
        ) : (
          visible.map((c) => (
            <CandidateCard
              key={c.candidate_id}
              candidate={c}
              job={job}
              selected={selected.includes(c.candidate_id)}
              onToggleCompare={toggleCompare}
              onDelete={deleteCandidate}
            />
          ))
        )}
      </div>

      {/* sticky compare bar */}
      {selected.length === 2 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <span className="text-sm text-gray-600">2 candidates selected</span>
            <button
              onClick={() =>
                navigate(
                  `/jobs/${jobId}/compare?ids=${selected[0]},${selected[1]}`
                )
              }
              className="rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#6D28D9" }}
            >
              Compare 2 candidates →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

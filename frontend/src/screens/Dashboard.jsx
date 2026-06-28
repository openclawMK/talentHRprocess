import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Plus, Database } from "lucide-react";
import CandidateCard from "../components/CandidateCard.jsx";

const TABS = ["all", "green", "amber", "red"];

export default function Dashboard() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState(null);
  const [job, setJob] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [demo, setDemo] = useState([]);
  const [demoLoaded, setDemoLoaded] = useState(false);

  function loadDemo() {
    axios
      .get("/api/demo-candidates")
      .then((res) => {
        // Demo candidates are sample data — show them regardless of the
        // current role so the button always populates the dashboard.
        setDemo(res.data || []);
        setDemoLoaded(true);
      })
      .catch(() => {
        setDemo([]);
        setDemoLoaded(true);
      });
  }

  const load = useCallback(() => {
    axios
      .get(`/api/candidates/${jobId}`)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]));
  }, [jobId]);

  useEffect(() => {
    axios.get("/api/jobs").then((res) => {
      setJob(res.data.find((j) => j.job_id === jobId) || null);
    });
  }, [jobId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // poll for new uploads during demo
    return () => clearInterval(t);
  }, [load]);

  function toggleCompare(id) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 2
        ? [...prev, id]
        : prev
    );
  }

  // merge live candidates with any loaded demo data (dedupe by id), sort by score
  const merged = [...(candidates || []), ...demo].filter(
    (c, i, arr) => arr.findIndex((x) => x.candidate_id === c.candidate_id) === i
  );
  merged.sort(
    (x, y) => (y.score?.combined_score ?? -1) - (x.score?.combined_score ?? -1)
  );

  const visible = merged.filter(
    (c) => filter === "all" || c.score?.lane === filter
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
          {!demoLoaded && (
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Database size={16} /> Load demo data
            </button>
          )}
          <Link
            to={`/jobs/${jobId}/upload`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#6D28D9" }}
          >
            <Plus size={16} /> Upload another CV
          </Link>
        </div>
      </div>

      {demoLoaded && (
        <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700">
          Demo data loaded — showing sample candidates
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
                <Link
                  to={`/jobs/${jobId}/upload`}
                  className="font-medium text-gray-900 underline"
                >
                  Upload a CV to get started →
                </Link>
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

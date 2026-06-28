import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import LaneBadge from "../components/LaneBadge.jsx";
import CriteriaRow from "../components/CriteriaRow.jsx";
import { round } from "../lib/format.js";

function Column({ candidate }) {
  const p = candidate.profile;
  const s = candidate.score || {};
  const criteria = s.criteria_scores || [];
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium text-gray-900">{p.name}</div>
        <div className="flex items-center gap-2">
          <LaneBadge lane={s.lane} />
          <span className="font-semibold">
            {round(s.combined_score)}%
            {s.full_score_available === false && (
              <span className="ml-1 text-xs font-normal text-gray-400">(partial)</span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-3">
        {criteria.map((c) => (
          <CriteriaRow key={c.criterion_id} criterion={c} />
        ))}
      </div>

      <div className="mt-3 text-sm">
        <div className="text-gray-400">Strengths</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-700">
          {(s.strengths || []).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="mt-3 text-sm">
        <div className="text-gray-400">Gaps</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-700">
          {(s.gaps || []).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="mt-3 text-sm">
        <div className="text-gray-400">Recent roles</div>
        <ul className="mt-1 space-y-0.5 text-gray-700">
          {(p.work_history || []).slice(0, 2).map((w, i) => (
            <li key={i}>
              {w.title} · {w.employer}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function CompareView() {
  const { jobId } = useParams();
  const [params] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);
  const [cands, setCands] = useState(null);
  const [comparison, setComparison] = useState("");
  const [busy, setBusy] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (ids.length !== 2) return;
    Promise.all(
      ids.map((id) => axios.get(`/api/candidates/${jobId}/${id}`).then((r) => r.data))
    ).then((list) => {
      setCands(list);
      axios
        .post("/api/compare-candidates", {
          candidate_id_1: ids[0],
          candidate_id_2: ids[1],
          job_id: jobId,
        })
        .then((r) => setComparison(r.data.comparison_text))
        .catch(() => setComparison("Comparison unavailable."))
        .finally(() => setBusy(false));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, params.get("ids")]);

  function fakeInvite() {
    setToast("Invite feature coming in Phase 2");
    setTimeout(() => setToast(""), 1800);
  }

  if (ids.length !== 2)
    return <div className="text-gray-500">Select two candidates to compare.</div>;
  if (!cands)
    return (
      <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />
    );

  const [a, b] = cands;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={`/jobs/${jobId}/dashboard`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-gray-900">
        Comparing {a.profile.name} vs {b.profile.name}
      </h1>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Column candidate={a} />
        <Column candidate={b} />
      </div>

      <div className="mt-5 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-purple-700">
          AI comparison
        </div>
        <div className="mt-2 text-sm leading-relaxed text-gray-700">
          {busy ? "Analysing both candidates…" : comparison}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={fakeInvite}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Interview {a.profile.name.split(" ")[0]}
        </button>
        <button
          onClick={fakeInvite}
          className="rounded-md px-3 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#6D28D9" }}
        >
          Interview both
        </button>
        <button
          onClick={fakeInvite}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Interview {b.profile.name.split(" ")[0]}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

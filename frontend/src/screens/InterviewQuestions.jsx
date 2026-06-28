import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Copy, Check } from "lucide-react";

const TYPE_STYLE = {
  behavioural: "bg-blue-50 text-blue-700",
  situational: "bg-purple-50 text-purple-700",
  competency: "bg-teal-50 text-teal-700",
};

export default function InterviewQuestions() {
  const { jobId, candidateId } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`/api/candidates/${jobId}/${candidateId}`)
      .then((res) => setCandidate(res.data));
    axios
      .get("/api/jobs")
      .then((res) => setJob(res.data.find((j) => j.job_id === jobId) || null));
  }, [jobId, candidateId]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await axios.post("/api/interview-questions", {
        candidate_id: candidateId,
        job_id: jobId,
      });
      setQuestions(res.data.questions || []);
    } catch {
      setError("Couldn't generate questions. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyAll() {
    const text = (questions || [])
      .map((q, i) => `${i + 1}. ${q.question}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // group by targets_gap (null => general)
  const groups = {};
  (questions || []).forEach((q) => {
    const key = q.targets_gap || "__general__";
    (groups[key] = groups[key] || []).push(q);
  });
  const gapKeys = Object.keys(groups).filter((k) => k !== "__general__");

  const QCard = (q, i) => (
    <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-sm text-gray-800">{q.question}</div>
      <span
        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${
          TYPE_STYLE[q.type] || "bg-gray-100 text-gray-600"
        }`}
      >
        {q.type}
      </span>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={`/jobs/${jobId}/candidate/${candidateId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to candidate
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-gray-900">
        Interview questions — {candidate?.profile?.name || "…"}
      </h1>
      <div className="text-sm text-gray-500">Role: {job?.role_title || "…"}</div>
      <div className="mt-1 text-xs text-gray-400">
        Generated based on profile gaps and role requirements
      </div>

      {!questions && (
        <button
          onClick={generate}
          disabled={busy}
          className="mt-6 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "#6D28D9" }}
        >
          {busy && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40"
              style={{ borderTopColor: "#fff" }}
            />
          )}
          {busy
            ? `Generating tailored questions for ${candidate?.profile?.name || "candidate"}...`
            : "Generate questions"}
        </button>
      )}

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {questions && (
        <div className="mt-6 space-y-6">
          {gapKeys.map((gap) => (
            <div key={gap}>
              <h2 className="mb-2 border-l-4 border-purple-400 pl-2 text-sm font-medium text-gray-700">
                Targeting: {gap}
              </h2>
              <div className="space-y-2">{groups[gap].map(QCard)}</div>
            </div>
          ))}

          {groups.__general__ && (
            <div>
              <h2 className="mb-2 border-l-4 border-gray-300 pl-2 text-sm font-medium text-gray-700">
                General — role fit
              </h2>
              <div className="space-y-2">{groups.__general__.map(QCard)}</div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy all questions"}
            </button>
            <Link
              to={`/jobs/${jobId}/candidate/${candidateId}`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to candidate
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

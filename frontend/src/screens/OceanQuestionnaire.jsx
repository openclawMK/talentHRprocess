import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Brain } from "lucide-react";

const SCALE = [
  { v: 1, label: "Disagree strongly" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Agree strongly" },
];

export default function OceanQuestionnaire() {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("/api/ocean-questions")
      .then((res) => setItems(res.data.items || []))
      .catch(() => setItems([]));
  }, []);

  const answeredCount = Object.keys(answers).length;
  const complete = items && answeredCount === items.length;

  async function submit() {
    if (!complete) return;
    setSubmitting(true);
    setError("");
    try {
      await axios.post("/api/ocean-assessment", {
        candidate_id: candidateId,
        responses: answers,
      });
      navigate(`/jobs/${jobId}/dashboard`);
    } catch {
      setError("Couldn't submit the assessment. Please try again.");
      setSubmitting(false);
    }
  }

  if (!items)
    return <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <Brain size={22} style={{ color: "#6D28D9" }} />
        <h1 className="text-2xl font-semibold text-gray-900">
          Personality assessment (OCEAN)
        </h1>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        This short Big Five questionnaire scores the personality-based criteria
        for the role. Required to complete the candidate's profile. Rate how much
        each statement applies.
      </p>
      <p className="mt-1 text-xs font-medium text-gray-400">
        I see myself as someone who…
      </p>

      <div className="mt-6 space-y-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="text-sm font-medium text-gray-800">
              {i + 1}. …{item.text}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCALE.map((s) => {
                const active = answers[item.id] === s.v;
                return (
                  <button
                    key={s.v}
                    onClick={() => setAnswers((a) => ({ ...a, [item.id]: s.v }))}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-transparent text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    style={active ? { backgroundColor: "#6D28D9" } : undefined}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <div className="sticky bottom-0 mt-6 flex items-center justify-between border-t border-gray-200 bg-white/95 py-3 backdrop-blur">
        <span className="text-sm text-gray-500">
          {answeredCount} / {items.length} answered
        </span>
        <button
          onClick={submit}
          disabled={!complete || submitting}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#6D28D9" }}
        >
          {submitting ? "Scoring..." : "Submit & view dashboard →"}
        </button>
      </div>
    </div>
  );
}

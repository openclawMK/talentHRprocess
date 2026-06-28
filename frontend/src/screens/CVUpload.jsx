import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, UploadCloud, FileText } from "lucide-react";

const STEPS = [
  "Uploading CV...",
  "Reading document...",
  "Extracting profile...",
  "Scoring candidate...",
];

export default function CVUpload() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  function pick(f) {
    setError("");
    if (!f) return;
    const ok = /\.(pdf|docx)$/i.test(f.name);
    if (!ok) {
      setError("Please upload a PDF or DOCX file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File is too large. Please upload a CV under 5MB");
      return;
    }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    setStep(0);
    // advance through the friendly step messages
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      900
    );
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("jobId", jobId);
      const res = await axios.post("/api/upload-cv", fd);
      clearInterval(timer);
      // OCEAN questionnaire is required before the candidate is fully scored.
      navigate(`/jobs/${jobId}/candidate/${res.data.candidate_id}/ocean`);
    } catch (err) {
      clearInterval(timer);
      setBusy(false);
      const msg =
        err?.response?.data?.error ||
        "We had trouble reading this CV. Try uploading a cleaner PDF version";
      setError(msg);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to roles
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-gray-900">Upload a CV</h1>

      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) pick(e.dataTransfer.files?.[0]);
        }}
        className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center hover:border-gray-400"
      >
        <UploadCloud size={36} className="text-gray-400" />
        <div className="mt-3 font-medium text-gray-700">
          Drop a CV here or browse
        </div>
        <div className="mt-1 text-sm text-gray-400">PDF or DOCX only</div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {file && !busy && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FileText size={18} className="text-gray-400" />
            {file.name}
            <span className="text-gray-400">
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            onClick={upload}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#6D28D9" }}
          >
            Upload and analyse
          </button>
        </div>
      )}

      {busy && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200"
            style={{ borderTopColor: "#6D28D9" }}
          />
          <span className="text-sm font-medium text-gray-700">
            {STEPS[step]}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

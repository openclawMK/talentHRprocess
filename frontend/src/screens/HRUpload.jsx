import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { UploadCloud, FileText, Loader2 } from "lucide-react";

const STEPS = ["Uploading CV…", "Reading document…", "Extracting profile…", "Scoring candidate…"];

export default function HRUpload() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inputRef = useRef(null);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(params.get("jobId") || "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get("/api/jobs").then((r) => {
      setJobs(r.data);
      if (!jobId && r.data[0]) setJobId(r.data[0].job_id);
    });
  }, []); // eslint-disable-line

  function pick(f) {
    setError("");
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) return setError("Please upload a PDF or DOCX file.");
    if (f.size > 5 * 1024 * 1024) return setError("File too large — keep it under 5MB.");
    setFile(f);
  }

  async function upload() {
    if (!file || !jobId) return;
    setBusy(true);
    setError("");
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("jobId", jobId);
      const res = await axios.post("/api/upload-cv", fd);
      clearInterval(timer);
      navigate(`/jobs/${jobId}/candidate/${res.data.candidate_id}`);
    } catch (err) {
      clearInterval(timer);
      setBusy(false);
      setError(err?.response?.data?.error || "We couldn't read this CV. Try a cleaner PDF.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Upload a CV</h1>
      <p className="mt-1 text-sm text-gray-500">
        AI parses, scores and slots the candidate into the selected role automatically.
      </p>

      <label className="mt-5 block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Role</span>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
        >
          {jobs.map((j) => (
            <option key={j.job_id} value={j.job_id}>{j.role_title} — {j.industry}</option>
          ))}
        </select>
      </label>

      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!busy) pick(e.dataTransfer.files?.[0]); }}
        className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-12 text-center hover:border-indigo-300"
      >
        {file ? (
          <div className="flex items-center gap-2 text-sm text-gray-700"><FileText size={18} className="text-indigo-500" /> {file.name}</div>
        ) : (
          <>
            <UploadCloud size={34} className="text-gray-400" />
            <div className="mt-2 font-medium text-gray-700">Drag &amp; drop a CV here</div>
            <div className="text-sm text-gray-400">or click to browse · PDF or DOCX, max 5MB</div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      {file && !busy && (
        <button onClick={upload} className="mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>
          Upload &amp; score →
        </button>
      )}

      {busy && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <Loader2 size={18} className="animate-spin text-indigo-500" />
          <span className="text-sm font-medium text-gray-700">{STEPS[step]}</span>
        </div>
      )}

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}

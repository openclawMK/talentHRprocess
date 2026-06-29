import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { UploadCloud, FileText, CheckCircle2, Briefcase, MapPin, Loader2 } from "lucide-react";

const SCALE = [
  { v: 1, label: "Strongly disagree" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Strongly agree" },
];
const PER_PAGE = 5;

export default function CandidatePortal() {
  const { token } = useParams();

  const [job, setJob] = useState(undefined); // undefined=loading, null=invalid
  const [step, setStep] = useState("landing"); // landing | details | assessment | review | confirm

  // landing
  const [consent, setConsent] = useState(false);

  // details
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);
  const [applying, setApplying] = useState(false);
  const [candidateId, setCandidateId] = useState(null);
  const [parsed, setParsed] = useState(null);

  // assessment
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [page, setPage] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`/api/portal/${token}`)
      .then((res) => setJob(res.data))
      .catch(() => setJob(null));
  }, [token]);

  // Load + randomise OCEAN items once
  useEffect(() => {
    if (step === "assessment" && items.length === 0) {
      axios.get("/api/ocean-questions").then((res) => {
        const shuffled = [...(res.data.items || [])].sort(() => Math.random() - 0.5);
        setItems(shuffled);
      });
    }
  }, [step, items.length]);

  const totalPages = Math.ceil(items.length / PER_PAGE);
  const pageItems = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const allAnswered = items.length > 0 && Object.keys(answers).length === items.length;
  const pageAnswered = pageItems.every((it) => answers[it.id]);

  function pickFile(f) {
    setError("");
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) return setError("Please upload a PDF or DOCX file.");
    if (f.size > 5 * 1024 * 1024) return setError("File too large — please keep it under 5MB.");
    setFile(f);
  }

  async function submitApplication() {
    if (!form.name.trim() || !form.email.trim() || !file) {
      setError("Please fill in your name, email, and attach your CV.");
      return;
    }
    setApplying(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      const res = await axios.post(`/api/portal/${token}/apply`, fd);
      setCandidateId(res.data.candidate_id);
      setParsed(res.data.parsed);
      setStep("assessment");
    } catch (e) {
      setError(e.response?.data?.error || "We couldn't process your CV. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  async function submitFinal() {
    setSubmitting(true);
    setError("");
    try {
      await axios.post(`/api/portal/${token}/ocean`, {
        candidate_id: candidateId,
        responses: answers,
      });
      setStep("confirm");
    } catch (e) {
      setError(e.response?.data?.error || "Couldn't submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- render states ----
  if (job === undefined)
    return <Centered><Loader2 className="animate-spin text-gray-400" /></Centered>;

  if (job === null)
    return (
      <Centered>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Link not valid</h1>
          <p className="mt-2 text-sm text-gray-500">
            This application link is invalid or has expired. Please check with the recruiter.
          </p>
        </div>
      </Centered>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* portal header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-1.5 px-6 py-4">
          <span className="text-lg font-semibold" style={{ color: "#6D28D9" }}>PeopleQuest</span>
          <span className="text-lg font-medium text-gray-500">Careers</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <StepBar step={step} />

        {/* LANDING */}
        {step === "landing" && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Briefcase size={15} /> {job.industry}
              <span className="text-gray-300">·</span>
              <MapPin size={15} /> {job.location}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">{job.role_title}</h1>

            {job.key_responsibilities?.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-medium text-gray-700">What you'll do</h2>
                <ul className="mt-2 space-y-1.5">
                  {job.key_responsibilities.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600">
                      <span className="text-purple-400">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 rounded-lg bg-purple-50 p-4 text-sm text-purple-900">
              <p className="font-medium">How it works</p>
              <p className="mt-1 text-purple-700">
                1. Share your details and upload your CV &nbsp;·&nbsp; 2. Complete a short
                personality questionnaire &nbsp;·&nbsp; 3. Submit. Takes about 5 minutes.
              </p>
            </div>

            {/* PDPA consent */}
            <label className="mt-5 flex items-start gap-2.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-purple-600"
              />
              <span>
                I consent to PeopleQuest collecting and processing my personal data and CV for
                recruitment purposes, in line with Malaysia's Personal Data Protection Act 2010 (PDPA).
              </span>
            </label>

            <button
              onClick={() => setStep("details")}
              disabled={!consent}
              className="mt-5 w-full rounded-md py-2.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#6D28D9" }}
            >
              Start application →
            </button>
          </div>
        )}

        {/* DETAILS */}
        {step === "details" && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h1 className="text-xl font-semibold text-gray-900">Your details</h1>
            <div className="mt-4 space-y-3">
              <Input label="Full name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="As per IC" />
              <Input label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@email.com" />
              <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="01X-XXXXXXX" />
            </div>

            <div className="mt-4">
              <span className="mb-1 block text-sm font-medium text-gray-700">CV / Resume *</span>
              <div
                onClick={() => !applying && inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (!applying) pickFile(e.dataTransfer.files?.[0]); }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center hover:border-gray-400"
              >
                {file ? (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FileText size={18} className="text-purple-500" /> {file.name}
                  </div>
                ) : (
                  <>
                    <UploadCloud size={28} className="text-gray-400" />
                    <div className="mt-2 text-sm font-medium text-gray-600">Drop your CV or browse</div>
                    <div className="text-xs text-gray-400">PDF or DOCX, max 5MB</div>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => setStep("landing")} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
              <button
                onClick={submitApplication}
                disabled={applying}
                className="ml-auto inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: "#6D28D9" }}
              >
                {applying ? (<><Loader2 size={15} className="animate-spin" /> Reading your CV…</>) : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ASSESSMENT */}
        {step === "assessment" && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h1 className="text-xl font-semibold text-gray-900">Personality questionnaire</h1>
            <p className="mt-1 text-sm text-gray-500">
              There are no right or wrong answers. Rate how much each statement describes you.
              <span className="mt-1 block text-xs font-medium text-gray-400">I see myself as someone who…</span>
            </p>

            {items.length === 0 ? (
              <div className="mt-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
            ) : (
              <>
                <div className="mt-5 space-y-4">
                  {pageItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="text-sm font-medium text-gray-800">…{item.text}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SCALE.map((s) => {
                          const active = answers[item.id] === s.v;
                          return (
                            <button
                              key={s.v}
                              onClick={() => setAnswers((a) => ({ ...a, [item.id]: s.v }))}
                              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-transparent text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
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

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    {page > 0 && (
                      <button onClick={() => setPage((p) => p - 1)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
                    )}
                    {page < totalPages - 1 ? (
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!pageAnswered}
                        className="rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: "#6D28D9" }}
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        onClick={() => setStep("review")}
                        disabled={!allAnswered}
                        className="rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: "#6D28D9" }}
                      >
                        Review →
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* REVIEW */}
        {step === "review" && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h1 className="text-xl font-semibold text-gray-900">Review &amp; submit</h1>
            <p className="mt-1 text-sm text-gray-500">Please confirm everything looks right before submitting.</p>

            <dl className="mt-4 divide-y divide-gray-100 text-sm">
              <Row k="Applying for" v={job.role_title} />
              <Row k="Name" v={form.name} />
              <Row k="Email" v={form.email} />
              {form.phone && <Row k="Phone" v={form.phone} />}
              <Row k="CV" v={file?.name} />
              {parsed?.latest_role && <Row k="Most recent role" v={parsed.latest_role} />}
              <Row k="Questionnaire" v={`${Object.keys(answers).length} / ${items.length} answered`} />
            </dl>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => setStep("assessment")} className="text-sm text-gray-500 hover:text-gray-700">← Edit answers</button>
              <button
                onClick={submitFinal}
                disabled={submitting}
                className="ml-auto inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: "#6D28D9" }}
              >
                {submitting ? (<><Loader2 size={15} className="animate-spin" /> Submitting…</>) : "Submit application"}
              </button>
            </div>
          </div>
        )}

        {/* CONFIRM */}
        {step === "confirm" && (
          <div className="mt-6 rounded-xl border border-green-200 bg-white p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-500" />
            <h1 className="mt-4 text-2xl font-semibold text-gray-900">Application received</h1>
            <p className="mt-2 text-sm text-gray-600">
              Thank you, {form.name.split(" ")[0]}. Your application for <strong>{job.role_title}</strong> has
              been submitted. Our recruitment team will review it and be in touch if there's a match.
            </p>
            <p className="mt-4 text-xs text-gray-400">You may now close this window.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function StepBar({ step }) {
  const steps = ["landing", "details", "assessment", "review", "confirm"];
  const labels = { landing: "Role", details: "Details", assessment: "Questionnaire", review: "Review", confirm: "Done" };
  const current = steps.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-1.5">
          <div
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i <= current ? "#6D28D9" : "#E5E7EB" }}
          />
        </div>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
      />
    </label>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-right font-medium text-gray-800">{v}</dd>
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">{children}</div>;
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowRight, MapPin, Plus, Link2, Check } from "lucide-react";

export default function JobSelector() {
  const [jobs, setJobs] = useState(null);
  const [copied, setCopied] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("/api/jobs")
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]));
  }, []);

  function copyLink(job) {
    const url = `${window.location.origin}/apply/${job.portal_token}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(job.job_id);
        setTimeout(() => setCopied(null), 2000);
      },
      () => {
        // Clipboard blocked — show the URL so HR can copy manually.
        window.prompt("Copy this application link:", url);
      }
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Roles</h1>
      <p className="mt-1 text-sm text-gray-500">
        Share an application link with candidates, or open a role's dashboard to review applicants.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-lg border border-gray-200 bg-gray-50"
              />
            ))
          : jobs.map((job) => (
              <div
                key={job.job_id}
                className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="text-lg font-medium text-gray-900">
                  {job.role_title}
                </div>
                <span className="mt-2 inline-flex w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  {job.industry}
                </span>
                <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                  <MapPin size={14} />
                  {job.location}
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={() => navigate(`/jobs/${job.job_id}/dashboard`)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    style={{ backgroundColor: "#6D28D9" }}
                  >
                    View dashboard <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => copyLink(job)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {copied === job.job_id ? (
                      <><Check size={15} className="text-green-600" /> Link copied</>
                    ) : (
                      <><Link2 size={15} /> Copy application link</>
                    )}
                  </button>
                </div>
              </div>
            ))}

        {/* Create new role card */}
        {jobs !== null && (
          <button
            onClick={() => navigate("/jobs/new")}
            className="flex min-h-[13rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-gray-500 hover:border-purple-300 hover:text-purple-700"
          >
            <Plus size={24} />
            <span className="mt-2 text-sm font-medium">Create new role</span>
            <span className="mt-1 text-xs text-gray-400">
              AI-generated scoring criteria
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

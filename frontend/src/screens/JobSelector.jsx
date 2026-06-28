import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowRight, MapPin, Plus } from "lucide-react";

export default function JobSelector() {
  const [jobs, setJobs] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("/api/jobs")
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Select a role</h1>
      <p className="mt-1 text-sm text-gray-500">
        Choose a position to start screening candidates.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-lg border border-gray-200 bg-gray-50"
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
                <button
                  onClick={() => navigate(`/jobs/${job.job_id}/upload`)}
                  className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: "#6D28D9" }}
                >
                  Start hiring <ArrowRight size={16} />
                </button>
              </div>
            ))}

        {/* Create new role card */}
        {jobs !== null && (
          <button
            onClick={() => navigate("/jobs/new")}
            className="flex min-h-[11rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-gray-500 hover:border-purple-300 hover:text-purple-700"
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

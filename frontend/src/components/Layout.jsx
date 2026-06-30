import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Shared shell: PeopleQuest logo (top left), current role name (top right).
 * The role name is derived from the :jobId segment in the current path and,
 * once the /api/jobs endpoint is live (Session 3), resolved to a role title.
 */
export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [roleTitle, setRoleTitle] = useState("");

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  const jobIdMatch = location.pathname.match(/\/jobs\/([^/]+)/);
  const jobId = jobIdMatch ? jobIdMatch[1] : null;

  useEffect(() => {
    if (!jobId) {
      setRoleTitle("");
      return;
    }
    let cancelled = false;
    axios
      .get("/api/jobs")
      .then((res) => {
        if (cancelled) return;
        const job = Array.isArray(res.data)
          ? res.data.find((j) => j.job_id === jobId)
          : null;
        setRoleTitle(job ? job.role_title : "");
      })
      .catch(() => {
        // Endpoint not implemented yet (Session 1) — fall back silently.
        if (!cancelled) setRoleTitle("");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/jobs" className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold" style={{ color: "#6D28D9" }}>
              PeopleQuest
            </span>
            <span className="text-lg font-medium text-gray-500">Talent AI</span>
          </Link>
          <div className="flex items-center gap-4">
            {roleTitle && (
              <span className="text-sm font-medium text-gray-600">{roleTitle}</span>
            )}
            {user && (
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                <span className="text-sm text-gray-500">{user.name}</span>
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
                  title="Sign out"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main key={location.pathname} className="route-fade mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}

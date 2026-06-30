import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  LayoutGrid, Briefcase, UploadCloud, Plus, Power, Search, Bell, Menu, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, section: "WORKSPACE", match: (p) => p === "/" },
  { to: "/jobs", label: "Job roles", icon: Briefcase, match: (p) => p.startsWith("/jobs") && p !== "/jobs/new" },
  { to: "/upload", label: "Upload CV", icon: UploadCloud, match: (p) => p.startsWith("/upload") },
  { to: "/jobs/new", label: "Create job", icon: Plus, match: (p) => p === "/jobs/new" },
];

export default function WorkspaceLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  const initials = (user?.name || "HR")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Shared sidebar body — rendered in the fixed desktop rail and the mobile drawer.
  const SidebarBody = ({ withClose }) => (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-6 pt-1">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[15px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}
        >
          PQ
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-white">PeopleQuest</div>
          <div className="text-[11px] tracking-wide" style={{ color: "#847FA6" }}>Talent AI</div>
        </div>
        {withClose && (
          <button onClick={() => setMenuOpen(false)} title="Close menu" className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="px-3 pb-2 text-[11px] font-bold tracking-[1px]" style={{ color: "#6E6A8C" }}>WORKSPACE</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.match(location.pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: active ? "#fff" : "#A7A3C4",
                background: active ? "linear-gradient(90deg,#6366F1,#7C3AED)" : "transparent",
              }}
            >
              <Icon size={17} /> {item.label}
            </Link>
          );
        })}
      </nav>

      {/* user footer */}
      <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2.5 py-2.5" style={{ backgroundColor: "#2A3040" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{user?.name || "HR Manager"}</div>
          <div className="text-[11px]" style={{ color: "#847FA6" }}>{user?.role === "admin" ? "HR Manager" : user?.role}</div>
        </div>
        <button onClick={signOut} title="Sign out" style={{ color: "#847FA6" }} className="hover:text-white">
          <Power size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#F3F4F8" }}>
      {/* Desktop sidebar (unchanged ≥ lg) */}
      <aside
        className="fixed inset-y-0 left-0 hidden w-60 flex-col px-3 py-4 lg:flex"
        style={{ backgroundColor: "#1F2430" }}
      >
        <SidebarBody />
      </aside>

      {/* Mobile drawer + backdrop (only < lg) */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col px-3 py-4 shadow-xl transition-transform duration-200 lg:hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "#1F2430" }}
      >
        <SidebarBody withClose />
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-60">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          {/* mobile menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            title="Open menu"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          >
            <Menu size={20} />
          </button>
          {/* mobile logo */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>PQ</div>
          </Link>
          <div className="relative ml-auto w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-gray-300 focus:bg-white focus:outline-none"
            />
          </div>
          <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Bell size={18} />
          </button>
        </header>

        <main key={location.pathname} className="route-fade mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

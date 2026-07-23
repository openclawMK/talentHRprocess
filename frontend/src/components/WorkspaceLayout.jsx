import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import {
  LayoutGrid, Briefcase, UploadCloud, Plus, Power, Search, Bell, Menu, X, Wallet, Sun, Moon, Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import AskAssistant from "./AskAssistant.jsx";

const NAV = [
  { to: "/", label: "Home", fullLabel: "Dashboard", icon: LayoutGrid, section: "WORKSPACE", match: (p) => p === "/" },
  { to: "/companies", label: "Firms", fullLabel: "Companies", icon: Briefcase, match: (p) => p.startsWith("/companies") || (p.startsWith("/jobs") && p !== "/jobs/new") },
  { to: "/upload", label: "Upload", fullLabel: "Upload CV", icon: UploadCloud, match: (p) => p.startsWith("/upload") },
  { to: "/jobs/new", label: "Create", fullLabel: "Create job", icon: Plus, match: (p) => p === "/jobs/new" },
  { to: "/salary-center", label: "Salary", fullLabel: "Salary Center", icon: Wallet, match: (p) => p.startsWith("/salary-center") },
  { to: "/settings", label: "Settings", fullLabel: "Settings", icon: SettingsIcon, match: (p) => p.startsWith("/settings") },
];

export default function WorkspaceLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, palette: D, toggle: toggleTheme } = useTheme();
  // A client login only manages its own company's roles — role/CV creation
  // and the cross-company "Companies" list don't apply to them; they land
  // straight on their own company's roles page instead.
  const isPlatformAdmin = user?.role === "admin" && !user?.company_id;
  const navItems = NAV
    .filter((item) => isPlatformAdmin || !["/upload", "/jobs/new", "/settings"].includes(item.to))
    .map((item) => (item.to === "/companies" && !isPlatformAdmin && user?.company_id
      ? { ...item, to: `/companies/${user.company_id}`, label: "Firm", fullLabel: "My Company" }
      : item));
  const LANE_DOT = { green: D.green, amber: D.amber, red: D.red };
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const searchBoxRef = useRef(null);
  const alertsBoxRef = useRef(null);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); setAlertsOpen(false); }, [location.pathname]);
  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Live global candidate search — debounced.
  useEffect(() => {
    const q = search.trim();
    if (!q) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      axios.get(`/api/candidates-search?q=${encodeURIComponent(q)}`).then((r) => setSearchResults(r.data?.results || [])).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Real alerts (stale candidates + flagged pre-hire checks), refreshed periodically.
  useEffect(() => {
    const load = () => axios.get("/api/alerts").then((r) => setAlerts(r.data?.alerts || [])).catch(() => setAlerts([]));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  // Close dropdowns on outside click.
  useEffect(() => {
    function onDocClick(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setSearchOpen(false);
      if (alertsBoxRef.current && !alertsBoxRef.current.contains(e.target)) setAlertsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function goToCandidate(r) {
    setSearch(""); setSearchOpen(false);
    navigate(`/jobs/${r.job_id}/candidate/${r.candidate_id}`);
  }

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

  const currentLabel = navItems.find((n) => n.match(location.pathname))?.fullLabel || "Dashboard";

  // Mobile drawer body — full labels, dark palette matching the rail.
  const MobileSidebarBody = () => (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-6 pt-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[15px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>PQ</div>
        <div className="flex-1">
          <div className="text-[15px] font-bold" style={{ color: D.text }}>PeopleQuest</div>
          <div className="text-[11px] tracking-wide" style={{ color: D.text4 }}>Talent AI</div>
        </div>
        <button onClick={() => setMenuOpen(false)} title="Close menu" style={{ color: D.text4 }}>
          <X size={20} />
        </button>
      </div>

      <div className="px-3 pb-2 text-[11px] font-bold tracking-[1px]" style={{ color: D.text5 }}>WORKSPACE</div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = item.match(location.pathname);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{ color: active ? D.text : D.text4, background: active ? D.railActive : "transparent" }}>
              <Icon size={17} /> {item.fullLabel}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2.5 py-2.5" style={{ backgroundColor: D.cardBg, border: `0.5px solid ${D.border}` }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" style={{ color: D.text }}>{user?.name || "HR Manager"}</div>
          <div className="text-[11px]" style={{ color: D.text4 }}>{isPlatformAdmin ? "HR Manager" : "Client account"}</div>
        </div>
        <button onClick={signOut} title="Sign out" style={{ color: D.text4 }}>
          <Power size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: D.page, color: D.text, fontFamily: D.font }}>
      {/* Desktop icon rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-[72px] flex-col items-center py-[18px] lg:flex" style={{ backgroundColor: D.page, borderRight: `0.5px solid ${D.hair}` }}>
        <Link to="/" className="mb-4 flex h-9 w-9 items-center justify-center rounded-[11px] text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>PQ</Link>
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const active = item.match(location.pathname);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} title={item.fullLabel}
                className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-[13px] transition-colors"
                style={{ color: active ? D.text : D.text5, background: active ? D.railActive : "transparent" }}>
                <Icon size={17} />
                <span style={{ fontSize: 8, fontWeight: 600 }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} title="Sign out" className="mt-auto flex h-11 w-11 items-center justify-center rounded-[13px]" style={{ color: D.text5 }}>
          <Power size={17} />
        </button>
      </aside>

      {/* Mobile drawer + backdrop (only < lg) */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col px-3 py-4 shadow-xl transition-transform duration-200 lg:hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: D.page }}
      >
        <MobileSidebarBody />
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-[72px]">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-[15px] sm:px-6" style={{ backgroundColor: D.page, borderBottom: `0.5px solid ${D.hair}` }}>
          {/* mobile menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            title="Open menu"
            className="rounded-lg p-2 lg:hidden"
            style={{ color: D.text4 }}
          >
            <Menu size={20} />
          </button>
          {/* mobile logo */}
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>PQ</div>
          </Link>

          <div className="hidden text-[17px] font-bold lg:block" style={{ color: D.text }}>{currentLabel}</div>

          <div ref={searchBoxRef} className="relative ml-auto w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: D.text4 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search candidates, roles…"
              className="w-full rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none"
              style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, color: D.text2 }}
            />
            {searchOpen && search.trim() && (
              <div className="absolute right-0 top-full mt-1.5 w-80 overflow-hidden rounded-xl shadow-lg" style={{ background: D.cardBg, border: `0.5px solid ${D.border}` }}>
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm" style={{ color: D.text4 }}>No candidates match "{search.trim()}"</div>
                ) : searchResults.map((r) => (
                  <div key={r.job_id + r.candidate_id} onClick={() => goToCandidate(r)} className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm" style={{ borderTop: `0.5px solid ${D.hair}` }}>
                    {r.lane && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: LANE_DOT[r.lane] || "#8A8B92" }} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" style={{ color: D.text }}>{r.name}</div>
                      <div className="truncate text-xs" style={{ color: D.text4 }}>{r.role_title}{r.company_name ? ` · ${r.company_name}` : ""}</div>
                    </div>
                    {r.score != null && <div className="flex-shrink-0 text-xs font-bold" style={{ color: D.text3 }}>{r.score}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div ref={alertsBoxRef} className="relative">
            <button onClick={() => setAlertsOpen((v) => !v)} className="relative flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, color: D.text3 }}>
              <Bell size={16} />
              {alerts.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{alerts.length > 9 ? "9+" : alerts.length}</span>
              )}
            </button>
            {alertsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 overflow-hidden rounded-xl shadow-lg" style={{ background: D.cardBg, border: `0.5px solid ${D.border}` }}>
                <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: D.text4, borderBottom: `0.5px solid ${D.hair}` }}>{alerts.length ? `${alerts.length} need attention` : "All caught up"}</div>
                <div className="max-h-96 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm" style={{ color: D.text4 }}>No stale candidates or flagged checks right now.</div>
                  ) : alerts.map((a, i) => (
                    <div key={i} onClick={() => { setAlertsOpen(false); navigate(`/jobs/${a.job_id}/candidate/${a.candidate_id}`); }} className="flex cursor-pointer items-start gap-2.5 px-4 py-3 text-sm" style={{ borderTop: `0.5px solid ${D.hair}` }}>
                      <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: a.severity === "high" ? "#E5654C" : "#E0A33A" }} />
                      <div className="min-w-0">
                        <div style={{ color: D.text2 }}>{a.message}</div>
                        <div className="mt-0.5 text-xs" style={{ color: D.text4 }}>{a.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light" : "Switch to dark"} className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, color: D.text3 }}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button onClick={signOut} title="Sign out" className="flex items-center gap-2.5 rounded-[11px] py-1 pl-2 pr-1" style={{ color: D.text4 }}>
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)" }}>
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-[13px] font-semibold" style={{ color: D.text }}>{user?.name || "HR Manager"}</div>
              <div className="text-[11px]" style={{ color: D.text4 }}>{isPlatformAdmin ? "HR Manager" : "Client account"}</div>
            </div>
          </button>
        </header>

        <main key={location.pathname} className="route-fade mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      {/* Grounded hiring assistant — available on every screen */}
      <AskAssistant />
    </div>
  );
}

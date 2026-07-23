import { useEffect, useState } from "react";
import axios from "axios";
import { usePalette } from "../context/ThemeContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";

const PERMISSION_LABELS = {
  create_job: "Create job vacancies",
  edit_job: "Edit job vacancies they created",
  view_all_jobs: "View all jobs (off = only ones they created)",
  view_all_candidates: "View all candidates (off = only within their jobs)",
  review_cv: "Review candidate CVs",
  add_comment: "Add comments, notes and recommendations",
  approve_reject_cv: "Approve or reject candidates (final decision)",
  export_data: "Export candidate data (PDF reports)",
  view_reports: "View reports and analytics",
  view_contact_info: "See candidate contact details (phone/email)",
};

// A company's own Level 1 user manages their Level 2 (Manager/Supervisor)
// team here — separate from PeopleQuest staff's Settings page, which only
// ever creates the first (Level 1) account per company.
export default function Team() {
  const D = usePalette();
  const cardBox = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16, padding: 22 };

  const [users, setUsers] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [permissions, setPermissions] = useState(null);
  const [permKeys, setPermKeys] = useState([]);
  const [permSaving, setPermSaving] = useState(false);

  const [log, setLog] = useState(null);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    loadUsers();
    axios.get("/api/team/permissions").then((r) => { setPermissions(r.data.permissions); setPermKeys(r.data.keys); }).catch(() => {});
  }, []);

  function loadUsers() {
    axios.get("/api/team/users").then((r) => setUsers(r.data)).catch(() => setUsers([]));
  }
  async function createLevel2() {
    setError("");
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setError("Name, email and an 8+ character password are required.");
      return;
    }
    setBusy(true);
    try {
      await axios.post("/api/team/users", form);
      setForm({ name: "", email: "", password: "" });
      loadUsers();
    } catch (e) { setError(e.response?.data?.error || "Couldn't create this login."); }
    finally { setBusy(false); }
  }
  async function removeUser(userId) {
    if (!window.confirm("Remove this team member? They'll no longer be able to sign in.")) return;
    try { await axios.delete(`/api/team/users/${userId}`); loadUsers(); }
    catch (e) { window.alert(e.response?.data?.error || "Couldn't remove this user."); }
  }
  async function togglePermission(key) {
    const next = { ...permissions, [key]: !permissions[key] };
    setPermissions(next); // optimistic
    setPermSaving(true);
    try {
      const res = await axios.put("/api/team/permissions", { permissions: { [key]: next[key] } });
      setPermissions(res.data.permissions);
    } catch {
      setPermissions((p) => ({ ...p, [key]: !next[key] })); // revert on failure
    } finally { setPermSaving(false); }
  }
  function loadLog() {
    axios.get("/api/audit-log?limit=50").then((r) => setLog(r.data)).catch(() => setLog([]));
  }

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 5px", color: D.text }}>Team</h1>
      <p style={{ fontSize: 15, color: D.text3, margin: "0 0 22px" }}>Manage your Managers/Supervisors and what they're allowed to do. Adding another Level 1 account still goes through PeopleQuest.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Team members */}
        <div style={cardBox}>
          <div style={{ fontSize: 15, fontWeight: 700, color: D.text, marginBottom: 4 }}>Team members</div>
          <div style={{ fontSize: 13, color: D.text4, marginBottom: 16 }}>Everyone with a login for your company.</div>
          {users === null ? (
            <div style={{ fontSize: 13, color: D.text4 }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {users.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: D.inset, borderRadius: 10 }}>
                    <div>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: D.text }}>{u.name}</span>
                      <span style={{ fontSize: 12.5, color: D.text4, marginLeft: 8 }}>{u.email}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: u.management_level === 1 ? D.blue : D.text4, background: u.management_level === 1 ? D.blueBg : D.pillBg, padding: "2px 7px", borderRadius: 6, marginLeft: 8, textTransform: "uppercase", letterSpacing: ".03em" }}>Level {u.management_level ?? "—"}</span>
                    </div>
                    {u.management_level === 2 && <span onClick={() => removeUser(u.id)} style={{ fontSize: 12.5, color: D.red, cursor: "pointer", fontWeight: 600 }}>Remove</span>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: D.text3, marginBottom: 10 }}>Add a Manager / Supervisor</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ padding: "10px 12px", border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 13.5, background: D.page, color: D.text }} />
                <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ padding: "10px 12px", border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 13.5, background: D.page, color: D.text }} />
                <input placeholder="Password (8+ chars)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ padding: "10px 12px", border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 13.5, background: D.page, color: D.text }} />
                <button onClick={createLevel2} disabled={busy} style={{ padding: "10px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Creating…" : "Add to team"}</button>
              </div>
              {error && <div style={{ fontSize: 12.5, color: D.red, marginTop: 10 }}>{error}</div>}
            </>
          )}
        </div>

        {/* Permissions */}
        <div style={cardBox}>
          <div style={{ fontSize: 15, fontWeight: 700, color: D.text, marginBottom: 4 }}>What your Managers can do</div>
          <div style={{ fontSize: 13, color: D.text4, marginBottom: 16 }}>Applies to every Level 2 login on your team. Archiving and permanently deleting roles always stay Level 1-only, regardless of these toggles.</div>
          {permissions === null ? (
            <div style={{ fontSize: 13, color: D.text4 }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {permKeys.map((key) => (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderTop: `0.5px solid ${D.border}` }}>
                  <span style={{ fontSize: 13.5, color: D.text2 }}>{PERMISSION_LABELS[key] || key}</span>
                  <button onClick={() => togglePermission(key)} disabled={permSaving} style={{ position: "relative", height: 22, width: 40, borderRadius: 999, background: permissions[key] ? "#7C3AED" : D.border, border: "none", cursor: "pointer", flexShrink: 0, opacity: permSaving ? 0.7 : 1 }}>
                    <span style={{ position: "absolute", top: 3, left: permissions[key] ? 21 : 3, height: 16, width: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity log */}
      <div style={{ ...cardBox, marginTop: 20 }}>
        <div onClick={() => { setShowLog((v) => !v); if (!log) loadLog(); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: D.text }}>Activity log</div>
          <span style={{ fontSize: 12, color: D.text5 }}>{showLog ? "▲" : "▼"}</span>
        </div>
        {showLog && (
          <div style={{ marginTop: 14 }}>
            {log === null ? (
              <div style={{ fontSize: 13, color: D.text4 }}>Loading…</div>
            ) : log.length === 0 ? (
              <div style={{ fontSize: 13, color: D.text5 }}>Nothing recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                {log.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", gap: 10, fontSize: 13, padding: "8px 4px", borderTop: `0.5px solid ${D.border}` }}>
                    <span style={{ color: D.text4, whiteSpace: "nowrap", fontSize: 11.5 }}>{new Date(entry.created_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                    <span style={{ color: D.text2 }}><b style={{ color: D.text }}>{entry.user_name || "System"}</b> — {entry.action.replace(/_/g, " ").replace(".", ": ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

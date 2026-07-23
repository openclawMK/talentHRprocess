import { useEffect, useState } from "react";
import axios from "axios";
import { usePalette } from "../context/ThemeContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";

// PeopleQuest-staff only — access to this whole screen is gated by
// WorkspaceLayout hiding the nav link, and every request underneath is
// still enforced server-side regardless (a client login gets a 403 from
// requirePlatformAdmin even if it somehow reached this URL directly).
export default function Settings() {
  const D = usePalette();
  const cardBox = { background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 16, padding: 22 };
  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState("");

  const [logins, setLogins] = useState(null);
  const [loginForm, setLoginForm] = useState({ name: "", email: "", password: "" });
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [apiKeys, setApiKeys] = useState(null);
  const [keyName, setKeyName] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [revealedKey, setRevealedKey] = useState(null);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    axios.get("/api/companies").then((r) => {
      setCompanies(r.data);
      if (r.data.length && !companyId) setCompanyId(r.data[0].id);
    }).catch(() => setCompanies([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyId) return;
    setLogins(null); setApiKeys(null); setRevealedKey(null);
    loadLogins(); loadApiKeys();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadLogins() {
    axios.get(`/api/companies/${companyId}/users`).then((r) => setLogins(r.data)).catch(() => setLogins([]));
  }
  async function createLogin() {
    setLoginError("");
    if (!loginForm.name.trim() || !loginForm.email.trim() || loginForm.password.length < 8) {
      setLoginError("Name, email and an 8+ character password are required.");
      return;
    }
    setLoginBusy(true);
    try {
      await axios.post(`/api/companies/${companyId}/users`, loginForm);
      setLoginForm({ name: "", email: "", password: "" });
      loadLogins();
    } catch (e) { setLoginError(e.response?.data?.error || "Couldn't create this login."); }
    finally { setLoginBusy(false); }
  }
  async function deleteLogin(userId) {
    if (!window.confirm("Remove this login? They'll no longer be able to sign in.")) return;
    try { await axios.delete(`/api/companies/${companyId}/users/${userId}`); loadLogins(); }
    catch { /* ignore */ }
  }

  function loadApiKeys() {
    axios.get(`/api/companies/${companyId}/api-keys`).then((r) => setApiKeys(r.data)).catch(() => setApiKeys([]));
  }
  async function createKey() {
    setKeyError(""); setRevealedKey(null);
    if (!keyName.trim()) { setKeyError("Give this key a name (e.g. \"HRIS integration\")."); return; }
    setKeyBusy(true);
    try {
      const res = await axios.post(`/api/companies/${companyId}/api-keys`, { name: keyName.trim() });
      setRevealedKey(res.data.key);
      setKeyName("");
      loadApiKeys();
    } catch (e) { setKeyError(e.response?.data?.error || "Couldn't create this key."); }
    finally { setKeyBusy(false); }
  }
  async function deleteKey(keyId) {
    if (!window.confirm("Revoke this API key? Any system using it will stop working immediately.")) return;
    try { await axios.delete(`/api/companies/${companyId}/api-keys/${keyId}`); loadApiKeys(); }
    catch { /* ignore */ }
  }
  function copyKey() {
    navigator.clipboard?.writeText(revealedKey).then(() => { setKeyCopied(true); setTimeout(() => setKeyCopied(false), 1800); });
  }

  const company = (companies || []).find((c) => c.id === companyId);

  return (
    <div>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 5px", color: D.text }}>Settings</h1>
      <p style={{ fontSize: 15, color: D.text3, margin: "0 0 22px" }}>Client logins and API keys, per company — separate from the roles and candidates themselves.</p>

      <div style={{ ...cardBox, padding: "16px 20px", marginBottom: 22, display: "flex", alignItems: "center", gap: 14 }} className="flex-wrap">
        <span style={{ fontSize: 13, fontWeight: 700, color: D.text3 }}>Company</span>
        {companies === null ? (
          <span style={{ fontSize: 13, color: D.text4 }}>Loading…</span>
        ) : companies.length === 0 ? (
          <span style={{ fontSize: 13, color: D.text4 }}>No companies yet.</span>
        ) : (
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={{ padding: "9px 14px", borderRadius: 9, border: `1px solid ${D.border}`, background: D.page, color: D.text, fontSize: 13.5, fontWeight: 600, minWidth: 220 }}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {companyId && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Client logins */}
          <div style={cardBox}>
            <div style={{ fontSize: 15, fontWeight: 700, color: D.text, marginBottom: 4 }}>🔑 Client logins</div>
            <div style={{ fontSize: 13, color: D.text4, marginBottom: 16 }}>Each login lands on the dashboard, scoped to {company?.name || "this company"}'s own roles and candidates only — never any other client's.</div>
            {logins === null ? (
              <div style={{ fontSize: 13, color: D.text4 }}>Loading…</div>
            ) : (
              <>
                {logins.length === 0 ? (
                  <div style={{ fontSize: 13, color: D.text5, marginBottom: 16 }}>No logins yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                    {logins.map((u) => (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: D.inset, borderRadius: 10 }}>
                        <div>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: D.text }}>{u.name}</span>
                          <span style={{ fontSize: 12.5, color: D.text4, marginLeft: 8 }}>{u.email}</span>
                        </div>
                        <span onClick={() => deleteLogin(u.id)} style={{ fontSize: 12.5, color: D.red, cursor: "pointer", fontWeight: 600 }}>Remove</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input placeholder="Name" value={loginForm.name} onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })} style={{ padding: "10px 12px", border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 13.5, background: D.page, color: D.text }} />
                  <input placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} style={{ padding: "10px 12px", border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 13.5, background: D.page, color: D.text }} />
                  <input placeholder="Password (8+ chars)" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} style={{ padding: "10px 12px", border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 13.5, background: D.page, color: D.text }} />
                  <button onClick={createLogin} disabled={loginBusy} style={{ padding: "10px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: loginBusy ? 0.6 : 1 }}>{loginBusy ? "Creating…" : "Add login"}</button>
                </div>
                {loginError && <div style={{ fontSize: 12.5, color: D.red, marginTop: 10 }}>{loginError}</div>}
              </>
            )}
          </div>

          {/* API keys */}
          <div style={cardBox}>
            <div style={{ fontSize: 15, fontWeight: 700, color: D.text, marginBottom: 4 }}>⚙ API keys</div>
            <div style={{ fontSize: 13, color: D.text4, marginBottom: 16 }}>For {company?.name || "this company"}'s own system to push roles and candidates to us directly — scoped to their data only, same as a login.</div>

            {revealedKey && (
              <div style={{ background: D.amberBg, border: `1px solid ${D.amberBorder}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: D.amber, marginBottom: 8 }}>⚠ Copy this now — it won't be shown again</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code style={{ flex: 1, fontSize: 12.5, background: D.page, border: `1px solid ${D.border}`, borderRadius: 7, padding: "8px 10px", overflowX: "auto", whiteSpace: "nowrap", color: D.text }}>{revealedKey}</code>
                  <button onClick={copyKey} style={{ padding: "8px 14px", background: D.text, color: D.page, border: "none", borderRadius: 7, fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>{keyCopied ? "✓ Copied" : "Copy"}</button>
                </div>
              </div>
            )}

            {apiKeys === null ? (
              <div style={{ fontSize: 13, color: D.text4 }}>Loading…</div>
            ) : (
              <>
                {apiKeys.length === 0 ? (
                  <div style={{ fontSize: 13, color: D.text5, marginBottom: 16 }}>No API keys yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                    {apiKeys.map((k) => (
                      <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: D.inset, borderRadius: 10 }}>
                        <div>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: D.text }}>{k.name}</span>
                          <code style={{ fontSize: 12, color: D.text4, marginLeft: 8 }}>{k.key_prefix}…</code>
                        </div>
                        <span onClick={() => deleteKey(k.id)} style={{ fontSize: 12.5, color: D.red, cursor: "pointer", fontWeight: 600 }}>Revoke</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input placeholder='Name this key, e.g. "HRIS integration"' value={keyName} onChange={(e) => setKeyName(e.target.value)} style={{ flex: 1, minWidth: 200, padding: "10px 12px", border: `1px solid ${D.border}`, borderRadius: 9, fontSize: 13.5, background: D.page, color: D.text }} />
                  <button onClick={createKey} disabled={keyBusy} style={{ padding: "10px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13.5, cursor: "pointer", opacity: keyBusy ? 0.6 : 1 }}>{keyBusy ? "Creating…" : "Generate key"}</button>
                </div>
                {keyError && <div style={{ fontSize: 12.5, color: D.red, marginTop: 10 }}>{keyError}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

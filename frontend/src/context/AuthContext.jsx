import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const KEY = "pq_auth";

// The actual session lives in an httpOnly cookie the browser manages on its
// own (see backend/routes/auth.js) — this is just cached user/permissions
// for an instant UI restore on refresh, never the token itself, which page
// JS was never meant to see in the first place. Because it's only a cache,
// it can be stale or absent even when the cookie is still valid (e.g. an
// unchecked "remember me" gets a session cookie that survives a refresh but
// was never written to localStorage) — see the /api/auth/me check below,
// which is the actual source of truth.
function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { user: null, permissions: null };
    const { user, permissions } = JSON.parse(raw);
    return { user, permissions: permissions || null };
  } catch {
    return { user: null, permissions: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => ({ ...restore(), checking: true }));

  // Confirm the cached restore against the server on every load. A cookie
  // the frontend can't read is now the real session, so localStorage alone
  // can't tell us "am I logged in" — it can be stale (session cookie expired
  // or the browser was closed) or wrongly absent (a valid session cookie
  // that was just never cached, per the "remember me" case above). Runs
  // silently in the background when a cached user lets the UI render
  // immediately; ProtectedRoute below waits for it when there's nothing to
  // optimistically show yet.
  useEffect(() => {
    axios.get("/api/auth/me")
      .then((r) => {
        setAuth({ user: r.data.user, permissions: r.data.permissions, checking: false });
        localStorage.setItem(KEY, JSON.stringify({ user: r.data.user, permissions: r.data.permissions }));
      })
      .catch(() => {
        localStorage.removeItem(KEY);
        setAuth({ user: null, permissions: null, checking: false });
      });
  }, []);

  function login(user, permissions = null) {
    // Always cache: the cookie itself (session vs 8h persistent) is what
    // actually controls how long the login lasts, this is only ever the
    // instant-restore cache and the /me check above corrects it regardless.
    localStorage.setItem(KEY, JSON.stringify({ user, permissions }));
    setAuth({ user, permissions, checking: false });
  }

  async function logout() {
    try { await axios.post("/api/auth/logout"); } catch { /* clearing local state matters more than this succeeding */ }
    localStorage.removeItem(KEY);
    setAuth({ user: null, permissions: null, checking: false });
  }

  // A client login's real management level: 1 (full control) or 2 (limited,
  // configurable). PeopleQuest staff (no company_id) counts as Level 1 for
  // UI purposes — every gate below already treats them as unrestricted.
  const isLevel1 = !auth.user?.company_id || auth.user?.management_level === 1;

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.user, isLevel1 }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

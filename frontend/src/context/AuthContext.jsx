import { createContext, useContext, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const KEY = "pq_auth";

// Restore a remembered session on load (only if the user ticked "Remember me").
function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { token: null, user: null, permissions: null };
    const { token, user, permissions } = JSON.parse(raw);
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    return { token, user, permissions: permissions || null };
  } catch {
    return { token: null, user: null, permissions: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(restore);

  function login(token, user, remember = false, permissions = null) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    if (remember) localStorage.setItem(KEY, JSON.stringify({ token, user, permissions }));
    setAuth({ token, user, permissions });
  }

  function logout() {
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem(KEY);
    setAuth({ token: null, user: null, permissions: null });
  }

  // A client login's real management level: 1 (full control) or 2 (limited,
  // configurable). PeopleQuest staff (no company_id) counts as Level 1 for
  // UI purposes — every gate below already treats them as unrestricted.
  const isLevel1 = !auth.user?.company_id || auth.user?.management_level === 1;

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.token, isLevel1 }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

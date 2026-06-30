import { createContext, useContext, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const KEY = "pq_auth";

// Restore a remembered session on load (only if the user ticked "Remember me").
function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { token: null, user: null };
    const { token, user } = JSON.parse(raw);
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(restore);

  function login(token, user, remember = false) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    if (remember) localStorage.setItem(KEY, JSON.stringify({ token, user }));
    setAuth({ token, user });
  }

  function logout() {
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem(KEY);
    setAuth({ token: null, user: null });
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

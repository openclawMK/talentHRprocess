import { createContext, useContext, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

/**
 * Holds the HR auth token + user in memory only (lost on refresh — fine for the
 * demo; the user just logs in again). Sets the axios Authorization header so
 * every API call is authenticated.
 */
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ token: null, user: null });

  function login(token, user) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setAuth({ token, user });
  }

  function logout() {
    delete axios.defaults.headers.common["Authorization"];
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

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import App from "./App.jsx";
import "./index.css";

// In production set VITE_API_BASE to the deployed backend URL (e.g. Render).
// Left empty for local dev, where Vite proxies /api -> http://localhost:3001.
axios.defaults.baseURL = import.meta.env.VITE_API_BASE || "";

// Auto-recover from an expired/invalid session: if any protected call returns
// 401, clear the stored token and bounce to /login instead of silently
// rendering an empty page. The login call itself is excluded so a wrong-password
// error can still surface on the form.
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem("pq_auth");
      delete axios.defaults.headers.common["Authorization"];
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import App from "./App.jsx";
import { isPublicPath } from "./publicPaths.js";
import "./index.css";

// In production set VITE_API_BASE to the deployed backend URL (e.g. Render).
// Left empty for local dev, where Vite proxies /api -> http://localhost:3001.
axios.defaults.baseURL = import.meta.env.VITE_API_BASE || "";
// The HR login lives in an httpOnly cookie now (see backend/routes/auth.js),
// not an Authorization header -- without this, the browser won't send that
// cookie on the cross-origin request to the deployed backend at all.
axios.defaults.withCredentials = true;

// Auto-recover from an expired/invalid session: if any protected call returns
// 401, clear the stored user/permissions and bounce to /login instead of
// silently rendering an empty page. The login call itself is excluded so a
// wrong-password error can still surface on the form.
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    // Public candidate-facing pages (apply/, voice-screen/, etc.) never have
    // an HR session — a 401 there is normal, not an expired login, and must
    // never blow away whatever that page was doing (e.g. mid-application).
    if (err.response?.status === 401 && !url.includes("/auth/login") && !isPublicPath(window.location.pathname)) {
      localStorage.removeItem("pq_auth");
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

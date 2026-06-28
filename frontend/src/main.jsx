import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import App from "./App.jsx";
import "./index.css";

// In production set VITE_API_BASE to the deployed backend URL (e.g. Render).
// Left empty for local dev, where Vite proxies /api -> http://localhost:3001.
axios.defaults.baseURL = import.meta.env.VITE_API_BASE || "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

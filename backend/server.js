import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRouter from "./routes/auth.js";
import companiesRouter from "./routes/companies.js";
import jobsRouter from "./routes/jobs.js";
import candidatesRouter from "./routes/candidates.js";
import successProfileRouter from "./routes/successProfile.js";
import exportRouter from "./routes/export.js";
import portalRouter from "./routes/portal.js";
import webhookRouter from "./routes/webhook.js";
import apiV1Router from "./routes/apiV1.js";
import teamRouter from "./routes/team.js";
import { authenticateHR } from "./middleware/auth.js";
import { authenticateApiKey } from "./middleware/apiKeyAuth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Render (and most hosts) terminate TLS at a proxy in front of this process,
// so the request Express sees is always plain HTTP internally. Without this,
// req.secure is always false, and the auth cookie logic below (which decides
// Secure/SameSite based on req.secure) would think every request is
// unencrypted even in production, breaking cross-site cookies there.
app.set("trust proxy", 1);

// The frontend (Vercel) and backend (this server) are on separate origins,
// so cross-origin requests are real, not incidental -- but a bare cors()
// answers every origin with "*", meaning any site on the internet can call
// this API using a token stolen some other way (XSS, a leaked log, etc).
// Locked to known frontends only. ALLOWED_ORIGINS lets a new deploy add its
// own domain via env var without a code change.
const ALLOWED_ORIGINS = [
  "https://talent-h-rprocess.vercel.app",
  "http://localhost:5173", // Vite dev server (requests are proxied server-side anyway, but harmless to allow directly too)
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : []),
];
app.use(cors({
  origin: (origin, callback) => {
    // No Origin header = server-to-server or same-origin (curl, mobile app,
    // the API-key-authenticated /api/v1 integrations) -- never browser CORS.
    // Passing `false` (not an Error) here just omits the CORS header, which
    // the requesting browser then blocks client-side -- passing an Error
    // instead would fall through to Express's default error page, which
    // dumps a full stack trace (server file paths included) to the caller.
    callback(null, !origin || ALLOWED_ORIGINS.includes(origin));
  },
  // The HR login cookie is httpOnly and cross-site (Vercel frontend, this
  // backend on a different origin) -- the browser only attaches it if the
  // server explicitly opts in to sending/receiving credentials.
  credentials: true,
}));
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio webhook posts form-encoded

// Health check (public)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "People Hire backend" });
});

// --- Public routes (no auth) ---
app.use("/api/auth", authRouter); // login / me
app.use("/api", portalRouter); // candidate-facing portal + ocean-questions
app.use("/webhook", webhookRouter); // Twilio inbound

// --- Machine-facing API (an API key, not a login, resolves company_id) ---
// Must be registered BEFORE the "/api" + authenticateHR (JWT-only) mounts
// below — Express matches app.use() prefixes in registration order, so
// "/api/v1/roles" would otherwise hit authenticateHR first and 401 before
// ever reaching this router, since "/api/v1/..." also starts with "/api".
app.use("/api/v1", authenticateApiKey, apiV1Router);

// --- Protected HR routes (require a valid JWT) ---
app.use("/api", authenticateHR, companiesRouter);
app.use("/api", authenticateHR, jobsRouter);
app.use("/api", authenticateHR, candidatesRouter);
app.use("/api", authenticateHR, successProfileRouter);
app.use("/api", authenticateHR, exportRouter);
app.use("/api", authenticateHR, teamRouter);

app.listen(PORT, () => {
  console.log(`People Hire backend running on http://localhost:${PORT}`);
});

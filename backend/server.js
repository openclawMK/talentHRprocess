import express from "express";
import cors from "cors";
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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio webhook posts form-encoded

// Health check (public)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "PeopleQuest Talent AI backend" });
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
  console.log(`PeopleQuest Talent AI backend running on http://localhost:${PORT}`);
});

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
import { authenticateHR } from "./middleware/auth.js";

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

// --- Protected HR routes (require a valid JWT) ---
app.use("/api", authenticateHR, companiesRouter);
app.use("/api", authenticateHR, jobsRouter);
app.use("/api", authenticateHR, candidatesRouter);
app.use("/api", authenticateHR, successProfileRouter);
app.use("/api", authenticateHR, exportRouter);

app.listen(PORT, () => {
  console.log(`PeopleQuest Talent AI backend running on http://localhost:${PORT}`);
});

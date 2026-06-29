import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import jobsRouter from "./routes/jobs.js";
import candidatesRouter from "./routes/candidates.js";
import portalRouter from "./routes/portal.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "PeopleQuest Talent AI backend" });
});

// Mounted route modules
app.use("/api", jobsRouter);
app.use("/api", candidatesRouter);
app.use("/api", portalRouter);

app.listen(PORT, () => {
  console.log(`PeopleQuest Talent AI backend running on http://localhost:${PORT}`);
});

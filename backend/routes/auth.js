/**
 * Auth routes (Session 12).
 */
import { Router } from "express";
import { login } from "../services/authService.js";
import { authenticateHR } from "../middleware/auth.js";
import { resolvePermissions } from "../services/permissions.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const result = await login(email, password);
  if (!result) return res.status(401).json({ error: "Invalid email or password" });
  res.json(result);
});

// POST /api/auth/logout — JWT is stateless; client just clears the token.
router.post("/logout", (req, res) => res.json({ ok: true }));

// GET /api/auth/me — protected
router.get("/me", authenticateHR, async (req, res) => {
  const permissions = await resolvePermissions(req.user);
  res.json({ user: req.user, permissions });
});

export default router;

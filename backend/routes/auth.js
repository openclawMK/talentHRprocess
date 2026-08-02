/**
 * Auth routes (Session 12).
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login } from "../services/authService.js";
import { authenticateHR } from "../middleware/auth.js";
import { resolvePermissions } from "../services/permissions.js";

const router = Router();

// Login had no brute-force protection at all -- unlimited password guesses
// against any known email. 10 attempts per 15 min per IP is generous for a
// real user who mistypes a password, but shuts down automated guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." },
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
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

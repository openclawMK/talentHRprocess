/**
 * authenticateHR — protects HR routes. Reads the JWT from the httpOnly
 * "pq_token" cookie the browser sends automatically (see routes/auth.js) —
 * this is what actually keeps the token out of reach of any XSS-injected
 * script, since page JS can never read an httpOnly cookie. Falls back to
 * "Authorization: Bearer <token>" for non-browser callers (curl, scripts) —
 * that fallback doesn't weaken the browser-side protection: it still
 * requires already possessing a valid token, the same as today.
 */
import { verifyToken, COOKIE_NAME } from "../services/authService.js";

export function authenticateHR(req, res, next) {
  const header = req.headers.authorization || "";
  const token = req.cookies?.[COOKIE_NAME] || (header.startsWith("Bearer ") ? header.slice(7) : null);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

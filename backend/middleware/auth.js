/**
 * authenticateHR — protects HR routes. Expects "Authorization: Bearer <token>".
 */
import { verifyToken } from "../services/authService.js";

export function authenticateHR(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

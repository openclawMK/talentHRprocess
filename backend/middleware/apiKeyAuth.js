/**
 * authenticateApiKey — protects the machine-facing /api/v1 routes. Expects
 * "Authorization: Bearer <api key>". Resolves to req.user in the SAME shape
 * authenticateHR produces ({ company_id, role: "client" }), so every existing
 * company-scoping guard (companyScope.js, the forced company_id on job
 * creation) works unchanged regardless of which auth path set it.
 */
import { findApiKeyMatch } from "../services/apiKeyService.js";

export async function authenticateApiKey(req, res, next) {
  const header = req.headers.authorization || "";
  const key = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!key) return res.status(401).json({ error: "Missing API key." });
  try {
    const match = await findApiKeyMatch(key);
    if (!match) return res.status(401).json({ error: "Invalid API key." });
    req.user = { company_id: match.company_id, role: "client", api_key_id: match.id };
    next();
  } catch (err) {
    console.error("api key auth error:", err);
    res.status(500).json({ error: "Authentication failed." });
  }
}

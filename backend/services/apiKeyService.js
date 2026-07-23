/**
 * Company-scoped API keys — the machine-facing equivalent of a client login.
 * A key resolves to exactly one company_id, which plugs into the same
 * req.user.company_id scoping every dashboard route already enforces (see
 * middleware/companyScope.js) — no separate isolation logic needed here.
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { readTable, insertRow, deleteRow } from "./store.js";

const PREFIX = "pq_live_";

function generateRawKey() {
  return `${PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
}

/** Creates a key for a company. Returns the raw key ONCE — only its hash is stored. */
export async function createApiKey(companyId, name) {
  const key = generateRawKey();
  const record = {
    id: `key_${crypto.randomBytes(4).toString("hex")}`,
    company_id: companyId,
    name: name?.trim() || "API key",
    key_prefix: key.slice(0, PREFIX.length + 6),
    key_hash: bcrypt.hashSync(key, 10),
    created_at: new Date().toISOString(),
  };
  await insertRow("api_keys", record);
  return { id: record.id, name: record.name, key_prefix: record.key_prefix, created_at: record.created_at, key };
}

export async function listApiKeys(companyId) {
  const keys = await readTable("api_keys");
  return keys
    .filter((k) => k.company_id === companyId)
    .map(({ id, name, key_prefix, created_at }) => ({ id, name, key_prefix, created_at }));
}

export async function deleteApiKey(id, companyId) {
  const keys = await readTable("api_keys");
  const match = keys.find((k) => k.id === id && k.company_id === companyId);
  if (!match) return false;
  await deleteRow("api_keys", id);
  return true;
}

/** Resolves a raw key from an Authorization header to its owning company, or null. */
export async function findApiKeyMatch(rawKey) {
  if (!rawKey || !rawKey.startsWith(PREFIX)) return null;
  const keys = await readTable("api_keys");
  // Narrow by prefix before the (slower) bcrypt compare — prefixes aren't
  // secret, they're just a display/lookup aid, so this leaks nothing.
  const candidates = keys.filter((k) => rawKey.startsWith(k.key_prefix));
  for (const k of candidates) {
    if (bcrypt.compareSync(rawKey, k.key_hash)) return k;
  }
  return null;
}

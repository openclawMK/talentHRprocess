/**
 * HR authentication (Session 12) — bcrypt password check + stateless JWT.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { readTable, writeTable } from "./store.js";
import { resolvePermissions } from "./permissions.js";

const JWT_SECRET = process.env.JWT_SECRET || "peoplequest_secret_2024";
const TOKEN_TTL = "8h";

export function hashPassword(plaintext) {
  return bcrypt.hashSync(plaintext, 10);
}

/** Verify credentials → return a signed JWT + safe user object, or null. */
export async function login(email, password) {
  const users = await readTable("users");
  const user = users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user) return null;
  if (!bcrypt.compareSync(String(password || ""), user.password_hash)) return null;
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role, company_id: user.company_id ?? null, management_level: user.management_level ?? null };
  const token = jwt.sign(safe, JWT_SECRET, { expiresIn: TOKEN_TTL });
  const permissions = await resolvePermissions(safe);
  return { token, user: safe, permissions };
}

/** Decode + verify a JWT. Throws if invalid/expired. */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// company_id set -> a client login, scoped to that company's own dashboard
// and data only; company_id omitted -> internal PeopleQuest staff, with the
// cross-company workspace view. managementLevel only applies within a
// company: 1 (full control) or 2 (limited, per company_permissions).
// PeopleQuest staff onboards a company's first user as Level 1; from then
// on that Level 1 user creates their own company's Level 2 users.
export async function createUser(name, email, password, companyId = null, managementLevel = companyId ? 1 : null) {
  const users = await readTable("users");
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("A user with that email already exists.");
  }
  const user = {
    id: `user_${String(users.length + 1).padStart(3, "0")}`,
    name,
    email,
    password_hash: hashPassword(password),
    role: companyId ? "client" : "admin",
    company_id: companyId || null,
    management_level: companyId ? managementLevel : null,
    created_at: new Date().toISOString(),
  };
  users.push(user);
  await writeTable("users", users);
  return { id: user.id, name: user.name, email: user.email, role: user.role, company_id: user.company_id, management_level: user.management_level };
}

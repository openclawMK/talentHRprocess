/**
 * HR authentication (Session 12) — bcrypt password check + stateless JWT.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_PATH = path.join(__dirname, "..", "data", "users.json");

const JWT_SECRET = process.env.JWT_SECRET || "peoplequest_secret_2024";
const TOKEN_TTL = "8h";

const readUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
  } catch {
    return [];
  }
};
const writeUsers = (u) => fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2));

export function hashPassword(plaintext) {
  return bcrypt.hashSync(plaintext, 10);
}

/** Verify credentials → return a signed JWT + safe user object, or null. */
export function login(email, password) {
  const user = readUsers().find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user) return null;
  if (!bcrypt.compareSync(String(password || ""), user.password_hash)) return null;
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = jwt.sign(safe, JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { token, user: safe };
}

/** Decode + verify a JWT. Throws if invalid/expired. */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function createUser(name, email, password) {
  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("A user with that email already exists.");
  }
  const user = {
    id: `user_${String(users.length + 1).padStart(3, "0")}`,
    name,
    email,
    password_hash: hashPassword(password),
    role: "admin",
    created_at: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// In production a missing JWT_SECRET is a fatal misconfiguration: a predictable
// fallback would let anyone forge tokens. Fail fast instead of starting insecure.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET не задан. Задайте переменную окружения JWT_SECRET в production.");
}
export const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";

export type Role = "SUPER_ADMIN" | "ADMIN";

export interface TokenPayload {
  sub: string;
  role: Role;
  adminId: string | null;
  branchId: string | null;
  /** Все филиалы админа; заполняется middleware'ом на каждый запрос. */
  branchIds?: string[];
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

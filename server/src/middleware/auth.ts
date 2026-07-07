import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../auth";
import { prisma } from "../prisma";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Не авторизован" });
  }
  try {
    const token = header.slice("Bearer ".length);
    req.user = verifyToken(token);
  } catch {
    return res.status(401).json({ message: "Недействительный или просроченный токен" });
  }

  // Load the admin's branch assignments fresh on every request so that changes
  // made by the super admin take effect immediately (no re-login needed).
  if (req.user.role === "ADMIN" && req.user.adminId) {
    try {
      const links = await prisma.adminBranch.findMany({
        where: { adminId: req.user.adminId },
        select: { branchId: true },
      });
      const ids = links.map((l) => l.branchId);
      if (req.user.branchId && !ids.includes(req.user.branchId)) ids.unshift(req.user.branchId);
      req.user.branchIds = ids;
    } catch (err) {
      return next(err);
    }
  }
  next();
}

/** Branches an ADMIN is allowed to work in (SUPER_ADMIN is unrestricted). */
export function allowedBranchIds(user: TokenPayload): string[] {
  return user.branchIds ?? (user.branchId ? [user.branchId] : []);
}

/**
 * Resolve the branch an ADMIN request should operate on: the requested branch
 * if it's one of theirs, otherwise their primary branch. Returns null when the
 * requested branch is explicitly foreign.
 */
export function resolveAdminBranch(user: TokenPayload, requested?: string | null): string | null {
  const allowed = allowedBranchIds(user);
  if (requested) return allowed.includes(requested) ? requested : null;
  return user.branchId && allowed.includes(user.branchId) ? user.branchId : allowed[0] ?? null;
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  next();
}

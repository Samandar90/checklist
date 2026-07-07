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

  // Refresh the admin's branch assignments from the DB on every request.
  // Tokens live for 7 days, so branchIds baked into the token go stale the
  // moment the super admin re-assigns branches — this is what made
  // multi-branch admins "not work" until re-login.
  if (req.user.role === "ADMIN" && req.user.adminId) {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id: req.user.adminId },
        select: { branchId: true, branches: { select: { id: true } } },
      });
      if (admin) {
        const ids = admin.branches.map((b) => b.id);
        if (!ids.includes(admin.branchId)) ids.unshift(admin.branchId);
        req.user.branchId = admin.branchId;
        req.user.branchIds = ids;
      }
    } catch (err) {
      return next(err);
    }
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Недостаточно прав" });
  }
  next();
}

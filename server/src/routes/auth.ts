import { Router } from "express";
import { prisma } from "../prisma";
import { comparePassword, signToken } from "../auth";
import { loginSchema } from "../validation";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username },
      include: { admin: { include: { branch: true } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const branchId = user.admin?.branchId ?? null;
    const token = signToken({
      sub: user.id,
      role: user.role as "SUPER_ADMIN" | "ADMIN",
      adminId: user.adminId,
      branchId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        adminId: user.adminId,
        branchId,
        fullName: user.admin?.fullName ?? null,
        branchName: user.admin?.branch.name ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: { admin: { include: { branch: true } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      adminId: user.adminId,
      branchId: user.admin?.branchId ?? null,
      fullName: user.admin?.fullName ?? null,
      branchName: user.admin?.branch.name ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { prisma } from "../prisma";
import { comparePassword, hashPassword, signToken } from "../auth";
import { changePasswordSchema, loginSchema } from "../validation";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username },
      include: { admin: { include: { branch: true, branches: { include: { branch: true } } } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const branchId = user.admin?.branchId ?? null;
    const branches = (user.admin?.branches ?? []).map((ab) => ({ id: ab.branch.id, name: ab.branch.name }));
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
        branchIds: branches.map((b) => b.id),
        branches,
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
      include: { admin: { include: { branch: true, branches: { include: { branch: true } } } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    const branches = (user.admin?.branches ?? []).map((ab) => ({ id: ab.branch.id, name: ab.branch.name }));
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      adminId: user.adminId,
      branchId: user.admin?.branchId ?? null,
      branchIds: branches.map((b) => b.id),
      branches,
      fullName: user.admin?.fullName ?? null,
      branchName: user.admin?.branch.name ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// Любой авторизованный пользователь может сменить свой пароль (не только SUPER_ADMIN).
router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: "Текущий пароль указан неверно" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    res.json({ message: "Пароль успешно изменён" });
  } catch (err) {
    next(err);
  }
});

export default router;

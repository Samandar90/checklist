import { Router } from "express";
import { prisma } from "../prisma";
import { comparePassword, hashPassword, signToken } from "../auth";
import { changePasswordSchema, loginSchema } from "../validation";
import { authenticate } from "../middleware/auth";
import { recordAudit } from "../audit";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username },
      include: { admin: { include: { branch: true, branches: true } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    const branchId = user.admin?.branchId ?? null;
    const branchIds = user.admin?.branches.map((b) => b.id) ?? [];
    const token = signToken({
      sub: user.id,
      role: user.role as "SUPER_ADMIN" | "ADMIN",
      adminId: user.adminId,
      branchId,
      branchIds,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        adminId: user.adminId,
        branchId,
        branchIds,
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
      include: { admin: { include: { branch: true, branches: true } } },
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
      branchIds: user.admin?.branches.map((b) => b.id) ?? [],
      fullName: user.admin?.fullName ?? null,
      branchName: user.admin?.branch.name ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Смена СОБСТВЕННОГО пароля — доступна любому вошедшему пользователю.
 *
 * Раньше маршрут был закрыт requireSuperAdmin, хотя пункт «Сменить пароль» есть
 * в меню у всех: администратор филиала получал 403 «Недостаточно прав» и мог
 * поменять пароль только через главный аккаунт (то есть сообщив ему свой новый
 * пароль). Право здесь не нужно: меняется исключительно пароль вызывающего
 * (req.user.sub), и только после проверки текущего пароля.
 */
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

    // Смена пароля — событие безопасности: в журнале должен остаться след,
    // кто и когда сменил себе пароль (сам пароль, разумеется, не пишем).
    await recordAudit(req, {
      action: "UPDATE",
      entity: "user",
      entityId: user.id,
      summary: `Сменил пароль своей учётной записи (${user.username})`,
    });

    res.json({ message: "Пароль успешно изменён" });
  } catch (err) {
    next(err);
  }
});

export default router;

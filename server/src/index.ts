import path from "path";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { authenticate } from "./middleware/auth";
import authRouter from "./routes/auth";
import branchesRouter from "./routes/branches";
import adminsRouter from "./routes/admins";
import roomsRouter from "./routes/rooms";
import sourcesRouter from "./routes/sources";
import reportsRouter from "./routes/reports";
import expensesRouter from "./routes/expenses";
import auditRouter from "./routes/audit";
import dashboardRouter from "./routes/dashboard";

const DEFAULT_SOURCES = ["Booking", "Reception", "Walk In", "Telegram", "Phone", "Instagram", "Other"];

async function ensureSeedData() {
  for (const name of DEFAULT_SOURCES) {
    await prisma.bookingSource.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || "admin";
  const existing = await prisma.user.findUnique({ where: { username: superAdminUsername } });
  if (!existing) {
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin123";
    await prisma.user.create({
      data: {
        username: superAdminUsername,
        passwordHash: await hashPassword(superAdminPassword),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Создан главный аккаунт: ${superAdminUsername} / ${superAdminPassword}`);
  }
}

const app = express();

// Behind Render's proxy — required for correct client IPs (rate limiting).
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security headers. CSP is disabled because the SPA + charts rely on inline styles;
// the other protections (HSTS, X-Frame-Options, noSniff, etc.) still apply.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: restrict to an allowlist in production, allow all in local dev.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Throttle authentication attempts to slow down brute-force / credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток входа. Попробуйте позже." },
});

app.use("/api/auth", authLimiter, authRouter);

app.use("/api/branches", authenticate, branchesRouter);
app.use("/api/admins", authenticate, adminsRouter);
app.use("/api/rooms", authenticate, roomsRouter);
app.use("/api/sources", authenticate, sourcesRouter);
app.use("/api/reports", authenticate, reportsRouter);
app.use("/api/expenses", authenticate, expensesRouter);
app.use("/api/audit", authenticate, auditRouter);
app.use("/api/dashboard", authenticate, dashboardRouter);

const clientDistPath = path.join(__dirname, "../public");
app.use(express.static(clientDistPath));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Ошибка валидации",
      errors: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Запись с такими значениями уже существует" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    if (err.code === "P2003") {
      return res.status(409).json({ message: "Невозможно удалить: запись используется в других данных" });
    }
  }

  console.error(err);
  res.status(500).json({ message: "Внутренняя ошибка сервера" });
};

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Не найдено" });
});

app.use(errorHandler);

// SPA fallback: any non-API route serves the React app's index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

ensureSeedData()
  .catch((err) => {
    console.error("Failed to seed default data:", err);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });

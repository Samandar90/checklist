import path from "path";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import branchesRouter from "./routes/branches";
import adminsRouter from "./routes/admins";
import roomsRouter from "./routes/rooms";
import sourcesRouter from "./routes/sources";
import reportsRouter from "./routes/reports";
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
}

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/branches", branchesRouter);
app.use("/api/admins", adminsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/sources", sourcesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/dashboard", dashboardRouter);

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
    console.error("Failed to seed default booking sources:", err);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });

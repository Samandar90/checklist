import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireSuperAdmin } from "../middleware/auth";
import { buildOverview, toLlmContext, addDays, dayKey, type AiOverview } from "../lib/aiAnalytics";
import { dayStart } from "../lib/bookings";
import { aiAvailable, askClaude, AiRefusedError, Anthropic, AI_MODEL } from "../lib/claude";

/*
 * AI analytics for the head office. Three endpoints:
 *   GET  /overview   — deterministic numbers: KPIs, forecast, anomalies, insights
 *   GET  /narrative  — the overview narrated by Claude (cached 10 min); falls
 *                      back to the rule-based summary when no key is set
 *   POST /ask        — a natural-language question over the same numbers
 * Only aggregates ever reach the model — never guest names or notes.
 */

const router = Router();
router.use(requireSuperAdmin);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Некорректная дата");

const filtersSchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
type Filters = z.infer<typeof filtersSchema>;

const askSchema = filtersSchema.extend({
  question: z.string().trim().min(3, "Задайте вопрос").max(600, "Слишком длинный вопрос"),
});

function resolveRange(f: Filters) {
  const today = dayStart(new Date());
  const to = f.to ? dayStart(new Date(f.to)) : today;
  const from = f.from ? dayStart(new Date(f.from)) : addDays(to, -29);
  if (from > to) return { today, from: to, to: from };
  return { today, from, to };
}

async function computeOverview(f: Filters): Promise<AiOverview> {
  const { today, from, to } = resolveRange(f);
  const scope = f.branchId ? { branchId: f.branchId } : {};
  const rangeDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevFrom = addDays(from, -rangeDays);
  // History for the weekday profile (12 weeks) + the previous period, and a
  // month before that so stays that started earlier still count their nights.
  const earliest = addDays(new Date(Math.min(prevFrom.getTime(), addDays(today, -84).getTime())), -31);
  const horizonEnd = addDays(today, 15);

  const [rooms, reports, expenses] = await Promise.all([
    prisma.room.findMany({ where: scope, select: { id: true, roomNumber: true, type: true } }),
    prisma.monthlyReport.findMany({
      where: { ...scope, date: { gte: earliest, lte: horizonEnd } },
      select: {
        date: true,
        checkOut: true,
        price: true,
        status: true,
        paymentStatus: true,
        paidAmount: true,
        roomId: true,
        source: { select: { name: true } },
      },
    }),
    prisma.expense.findMany({
      where: { ...scope, date: { gte: prevFrom, lt: addDays(to, 1) } },
      select: { date: true, amount: true, category: true },
    }),
  ]);

  return buildOverview({
    bookings: reports.map((r) => ({
      date: r.date,
      checkOut: r.checkOut,
      price: r.price,
      status: r.status,
      paymentStatus: r.paymentStatus,
      paidAmount: r.paidAmount,
      sourceName: r.source.name,
      roomId: r.roomId,
    })),
    rooms,
    expenses,
    from,
    to,
    today,
  });
}

router.get("/overview", async (req, res, next) => {
  try {
    const f = filtersSchema.parse(req.query);
    const overview = await computeOverview(f);
    res.json({ ...overview, aiAvailable: aiAvailable(), model: aiAvailable() ? AI_MODEL : null });
  } catch (err) {
    next(err);
  }
});

const SYSTEM_PROMPT = `Ты — аналитик доходов сети отелей (revenue manager). Тебе передают агрегированные показатели одного отеля или сети: выручку, загрузку, ADR, RevPAR, прогноз на 14 дней, аномалии, распределение по каналам и список уже найденных инсайтов.

Правила:
- Отвечай по-русски, коротко и по делу: до 6 предложений или короткий список из 3–5 пунктов через «•».
- Опирайся только на переданные данные. Если данных недостаточно для ответа — скажи об этом прямо и назови, чего не хватает.
- Причины формулируй как гипотезы («вероятно», «похоже»), а не как факты, если данные их не доказывают.
- Суммы в UZS; округляй до тысяч или миллионов (например «1,2 млн», «850 тыс.»). Проценты — целые.
- Каждый ответ заканчивай одним конкретным действием, которое владелец может сделать на этой неделе.
- Без markdown-заголовков, без жирного текста, без таблиц. Обычный текст и маркеры «•».`;

const NARRATIVE_TASK = `Составь сводку для владельца отеля за период: 3–5 предложений. Сначала что произошло с выручкой и загрузкой (с цифрами и сравнением с прошлым периодом), затем главный риск, затем главная возможность, и в конце одно конкретное действие на ближайшую неделю. Не перечисляй все инсайты — выбери самые важные.`;

// Narratives are expensive and change slowly — cache per filter set for 10 minutes.
const NARRATIVE_TTL_MS = 10 * 60 * 1000;
const narrativeCache = new Map<string, { text: string; model: string; at: number }>();

function narrativeKey(f: Filters, o: AiOverview) {
  return `${f.branchId ?? "all"}|${o.range.from}|${o.range.to}|${AI_MODEL}`;
}

function aiErrorResponse(err: unknown): { status: number; message: string } | null {
  if (err instanceof AiRefusedError) return { status: 422, message: "AI не смог ответить на этот вопрос. Переформулируйте его." };
  if (err instanceof Anthropic.AuthenticationError) return { status: 503, message: "AI не настроен: ключ ANTHROPIC_API_KEY отклонён." };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "AI перегружен. Попробуйте через минуту." };
  if (err instanceof Anthropic.APIError) return { status: 502, message: "AI временно недоступен. Попробуйте позже." };
  return null;
}

router.get("/narrative", async (req, res, next) => {
  try {
    const f = filtersSchema.parse(req.query);
    const overview = await computeOverview(f);
    if (!aiAvailable()) {
      return res.json({ available: false, text: overview.summary });
    }
    const key = narrativeKey(f, overview);
    const cached = narrativeCache.get(key);
    if (cached && Date.now() - cached.at < NARRATIVE_TTL_MS) {
      return res.json({ available: true, text: cached.text, model: cached.model, cached: true });
    }
    const { text, model } = await askClaude({
      system: SYSTEM_PROMPT,
      user: `Данные (JSON):\n${JSON.stringify(toLlmContext(overview))}\n\nЗадача: ${NARRATIVE_TASK}`,
      effort: "high",
      maxTokens: 1200,
    });
    narrativeCache.set(key, { text, model, at: Date.now() });
    if (narrativeCache.size > 100) {
      const oldest = [...narrativeCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) narrativeCache.delete(oldest[0]);
    }
    res.json({ available: true, text, model, cached: false });
  } catch (err) {
    const mapped = aiErrorResponse(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message });
    next(err);
  }
});

// Each question is a paid model call — throttle per client.
const askLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много вопросов подряд. Подождите немного." },
});

router.post("/ask", askLimiter, async (req, res, next) => {
  try {
    const body = askSchema.parse(req.body);
    if (!aiAvailable()) {
      return res.status(503).json({
        code: "AI_NOT_CONFIGURED",
        message: "AI не подключён. Добавьте переменную окружения ANTHROPIC_API_KEY и перезапустите сервис.",
      });
    }
    const overview = await computeOverview(body);
    const { text, model } = await askClaude({
      system: SYSTEM_PROMPT,
      user: `Данные (JSON):\n${JSON.stringify(toLlmContext(overview))}\n\nСегодня: ${dayKey(dayStart(new Date()))}.\nВопрос владельца: ${body.question}`,
      effort: "medium",
      maxTokens: 1500,
    });
    res.json({ answer: text, model });
  } catch (err) {
    const mapped = aiErrorResponse(err);
    if (mapped) return res.status(mapped.status).json({ message: mapped.message });
    next(err);
  }
});

export default router;

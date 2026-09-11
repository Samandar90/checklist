import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireSuperAdmin } from "../middleware/auth";
import { buildOverview, toLlmContext, addDays, dayKey, type AiOverview } from "../lib/aiAnalytics";
import { dayStart } from "../lib/bookings";
import { createHotelAnalyst, hotelFacts } from "../lib/hotelAnalyst";
import { aiAvailable, askClaude, AiRefusedError, Anthropic, AI_MODEL } from "../lib/claude";

/*
 * AI analytics for the head office. Three endpoints:
 *   GET  /overview   — deterministic numbers: KPIs, forecast, anomalies, insights
 *   GET  /narrative  — the period summarised in prose
 *   POST /ask        — a question in plain Russian over the same numbers
 *
 * Answers come from the local analyst (../analyst — rules + statistics, no
 * network). When ANTHROPIC_API_KEY is configured, Claude polishes the
 * narrative and takes over questions the local parser is not sure about.
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
  question: z.string().trim().min(2, "Задайте вопрос").max(600, "Слишком длинный вопрос"),
});

function resolveRange(f: Filters) {
  const today = dayStart(new Date());
  const to = f.to ? dayStart(new Date(f.to)) : today;
  const from = f.from ? dayStart(new Date(f.from)) : addDays(to, -29);
  if (from > to) return { today, from: to, to: from };
  return { today, from, to };
}

/** One DB round-trip feeds both the overview page and the analyst. */
async function loadData(f: Filters) {
  const { today, from, to } = resolveRange(f);
  const scope = f.branchId ? { branchId: f.branchId } : {};
  const rangeDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevFrom = addDays(from, -rangeDays);
  // 12 weeks of history for the weekday profile, plus a month before that so
  // stays that started earlier still count their nights; 15 days ahead.
  const earliest = addDays(new Date(Math.min(prevFrom.getTime(), addDays(today, -84).getTime())), -31);
  const horizonEnd = addDays(today, 15);

  const [rooms, reports, expenses] = await Promise.all([
    prisma.room.findMany({ where: scope, select: { id: true, roomNumber: true, type: true, branch: { select: { name: true } } } }),
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
        branch: { select: { name: true } },
        room: { select: { type: true } },
      },
    }),
    prisma.expense.findMany({
      where: { ...scope, date: { gte: earliest, lt: addDays(to, 1) } },
      select: { date: true, amount: true, category: true, branch: { select: { name: true } } },
    }),
  ]);

  return { today, from, to, earliest, horizonEnd, rooms, reports, expenses };
}
type Loaded = Awaited<ReturnType<typeof loadData>>;

function overviewFrom(d: Loaded): AiOverview {
  return buildOverview({
    bookings: d.reports.map((r) => ({
      date: r.date,
      checkOut: r.checkOut,
      price: r.price,
      status: r.status,
      paymentStatus: r.paymentStatus,
      paidAmount: r.paidAmount,
      sourceName: r.source.name,
      roomId: r.roomId,
    })),
    rooms: d.rooms,
    expenses: d.expenses,
    from: d.from,
    to: d.to,
    today: d.today,
  });
}

function analystFrom(d: Loaded) {
  const analyst = createHotelAnalyst({ today: () => d.today });
  analyst.load(hotelFacts({ bookings: d.reports, rooms: d.rooms, expenses: d.expenses, from: dayKey(d.earliest), to: dayKey(d.horizonEnd) }));
  return analyst;
}

const engineLabel = () => (aiAvailable() ? "claude+local" : "local");

router.get("/overview", async (req, res, next) => {
  try {
    const f = filtersSchema.parse(req.query);
    const overview = overviewFrom(await loadData(f));
    res.json({ ...overview, aiAvailable: aiAvailable(), model: aiAvailable() ? AI_MODEL : null, engine: engineLabel() });
  } catch (err) {
    next(err);
  }
});

const SYSTEM_PROMPT = `Ты — аналитик доходов сети отелей (revenue manager). Тебе передают агрегированные показатели одного отеля или сети: выручку, загрузку, ADR, RevPAR, прогноз на 14 дней, аномалии, распределение по каналам и список уже найденных инсайтов.

Правила:
- Отвечай по-русски, коротко и по делу: до 6 предложений или короткий список из 3–5 пунктов через «•».
- Опирайся только на переданные данные. Если данных недостаточно для ответа — скажи об этом прямо и назови, чего не хватает.
- Причины формулируй как гипотезы («вероятно», «похоже»), а не как факты, если данные их не доказывают.
- Суммы в UZS; округляй до тысяч или миллионов (например «1,2 млн», «850 тыс»). Проценты — целые.
- Каждый ответ заканчивай одним конкретным действием, которое владелец может сделать на этой неделе.
- Без markdown-заголовков, без жирного текста, без таблиц. Обычный текст и маркеры «•».`;

const NARRATIVE_TASK = `Составь сводку для владельца отеля за период: 3–5 предложений. Сначала что произошло с выручкой и загрузкой (с цифрами и сравнением с прошлым периодом), затем главный риск, затем главная возможность, и в конце одно конкретное действие на ближайшую неделю. Не перечисляй все инсайты — выбери самые важные.`;

// Claude narratives are paid and change slowly — cache per filter set for 10 minutes.
const NARRATIVE_TTL_MS = 10 * 60 * 1000;
const narrativeCache = new Map<string, { text: string; model: string; at: number }>();

function narrativeKey(f: Filters, o: AiOverview) {
  return `${f.branchId ?? "all"}|${o.range.from}|${o.range.to}|${AI_MODEL}`;
}

function aiErrorMessage(err: unknown): string | null {
  if (err instanceof AiRefusedError) return "AI не смог ответить на этот вопрос";
  if (err instanceof Anthropic.AuthenticationError) return "ключ ANTHROPIC_API_KEY отклонён";
  if (err instanceof Anthropic.RateLimitError) return "AI перегружен";
  if (err instanceof Anthropic.APIError) return "AI временно недоступен";
  return null;
}

router.get("/narrative", async (req, res, next) => {
  try {
    const f = filtersSchema.parse(req.query);
    const data = await loadData(f);
    const overview = overviewFrom(data);
    const analyst = analystFrom(data);
    const local = analyst.narrative({ range: overview.range, today: dayKey(data.today), insights: overview.insights });

    if (!aiAvailable()) return res.json({ available: true, engine: "local", text: local });

    const key = narrativeKey(f, overview);
    const cached = narrativeCache.get(key);
    if (cached && Date.now() - cached.at < NARRATIVE_TTL_MS) {
      return res.json({ available: true, engine: "claude", text: cached.text, model: cached.model, cached: true });
    }
    try {
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
      return res.json({ available: true, engine: "claude", text, model, cached: false });
    } catch (err) {
      const msg = aiErrorMessage(err);
      if (!msg) throw err;
      // The local analyst always has an answer.
      return res.json({ available: true, engine: "local", text: local, note: msg });
    }
  } catch (err) {
    next(err);
  }
});

// Local answers are free, but the endpoint still does a DB scan per call.
const askLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много вопросов подряд. Подождите немного." },
});

router.post("/ask", askLimiter, async (req, res, next) => {
  try {
    const body = askSchema.parse(req.body);
    const data = await loadData(body);
    const overview = overviewFrom(data);
    const analyst = analystFrom(data);
    const local = analyst.ask(body.question, { range: overview.range, today: dayKey(data.today), insights: overview.insights });

    // Claude steps in only for questions the parser could not place.
    if (aiAvailable() && local.confidence < 0.5) {
      try {
        const { text, model } = await askClaude({
          system: SYSTEM_PROMPT,
          user: `Данные (JSON):\n${JSON.stringify(toLlmContext(overview))}\n\nСегодня: ${dayKey(data.today)}.\nВопрос владельца: ${body.question}`,
          effort: "medium",
          maxTokens: 1500,
        });
        return res.json({ answer: text, engine: "claude", model, confidence: 0.9, followUps: local.followUps });
      } catch (err) {
        if (!aiErrorMessage(err)) throw err;
      }
    }
    res.json({ answer: local.text, engine: "local", confidence: local.confidence, intent: local.intent, followUps: local.followUps });
  } catch (err) {
    next(err);
  }
});

export default router;

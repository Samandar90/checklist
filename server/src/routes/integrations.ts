import { Router } from "express";
import { z } from "zod";
import { requireSuperAdmin } from "../middleware/auth";
import { integrationService } from "../integrations/services/integrationService";
import { IntegrationError } from "../integrations/core/errors";

/**
 * Integration Layer API. Thin controllers only — all logic in integrationService.
 * Super-admin gated (integrations are an organization-level concern).
 *
 * This phase exposes read + preparation endpoints; none of them contact an OTA.
 */
const router = Router();
router.use(requireSuperAdmin);

/** Map integration-layer domain errors to HTTP responses. */
function handle(err: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if (err instanceof IntegrationError) {
    return res.status(err.httpStatus).json({ message: err.message, code: err.code });
  }
  next(err);
}

// GET /api/integrations — accounts with provider + branch + mapping counts
router.get("/", async (_req, res, next) => {
  try {
    res.json(await integrationService.listAccounts());
  } catch (err) {
    handle(err, res, next);
  }
});

const createAccountSchema = z.object({
  providerId: z.string().trim().min(1, "Укажите провайдера"),
  branchId: z.string().trim().min(1, "Укажите филиал"),
  externalHotelId: z.string().trim().optional(),
  settings: z.record(z.unknown()).optional(),
});

// POST /api/integrations — link a branch to a provider (no OTA auth)
router.post("/", async (req, res, next) => {
  try {
    const data = createAccountSchema.parse(req.body);
    res.status(201).json(await integrationService.createAccount(data));
  } catch (err) {
    handle(err, res, next);
  }
});

// DELETE /api/integrations/:accountId
router.delete("/:accountId", async (req, res, next) => {
  try {
    await integrationService.deleteAccount(req.params.accountId);
    res.status(204).send();
  } catch (err) {
    handle(err, res, next);
  }
});

// GET /api/integrations/providers — the registered provider catalog
router.get("/providers", async (_req, res, next) => {
  try {
    res.json(await integrationService.listProviders());
  } catch (err) {
    handle(err, res, next);
  }
});

// GET /api/integrations/:accountId/mappings
router.get("/:accountId/mappings", async (req, res, next) => {
  try {
    res.json(await integrationService.listRoomMappings(req.params.accountId));
  } catch (err) {
    handle(err, res, next);
  }
});

// GET /api/integrations/:accountId/logs
router.get("/:accountId/logs", async (req, res, next) => {
  try {
    res.json(await integrationService.listLogs(req.params.accountId));
  } catch (err) {
    handle(err, res, next);
  }
});

// GET /api/integrations/:accountId/health
router.get("/:accountId/health", async (req, res, next) => {
  try {
    res.json(await integrationService.health(req.params.accountId));
  } catch (err) {
    handle(err, res, next);
  }
});

const roomMappingSchema = z.object({
  roomId: z.string().trim().min(1, "Укажите номер"),
  externalRoomId: z.string().trim().min(1, "Укажите внешний ID номера"),
  externalName: z.string().trim().optional(),
});

// POST /api/integrations/:accountId/room-mapping
router.post("/:accountId/room-mapping", async (req, res, next) => {
  try {
    const data = roomMappingSchema.parse(req.body);
    const mapping = await integrationService.createRoomMapping(
      req.params.accountId,
      data.roomId,
      data.externalRoomId,
      data.externalName
    );
    res.status(201).json(mapping);
  } catch (err) {
    handle(err, res, next);
  }
});

// POST /api/integrations/:accountId/sync — enqueue a manual sync job (no OTA call)
router.post("/:accountId/sync", async (req, res, next) => {
  try {
    const kind = req.body?.kind === "EXPORT" ? "EXPORT" : "IMPORT";
    res.status(202).json(await integrationService.triggerSync(req.params.accountId, kind));
  } catch (err) {
    handle(err, res, next);
  }
});

export default router;

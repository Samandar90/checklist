import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma";
import { hasProvider } from "../integrations/providers/registry";
import { queue } from "../integrations/core/queue";
import { payloadHash } from "../integrations/core/hash";

/**
 * Provider-agnostic webhook ingress framework (Step 11).
 *
 * This is REUSABLE INFRASTRUCTURE, not any OTA's endpoint. For every provider,
 * a single route `POST /api/webhooks/:providerCode` does the common work:
 *   • resolve the provider via the registry (unknown → 404, nothing logged),
 *   • record the raw receipt in WebhookLog (payload hashed, not stored raw),
 *   • enqueue a durable WEBHOOK job for later processing,
 *   • return 202 immediately.
 *
 * Signature verification is delegated to the provider adapter (abstraction);
 * since no adapter is implemented, receipts are logged with signatureOk=false
 * and processing is deferred to the queue. This endpoint is intentionally
 * unauthenticated (OTAs are not logged-in users) but rate-limited and bounded:
 * it refuses unknown providers so it can never be used to flood the DB.
 */
const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many webhook requests." },
});

router.post("/:providerCode", webhookLimiter, async (req, res, next) => {
  try {
    const providerCode = req.params.providerCode;

    // Unknown provider → reject before any DB write.
    if (!hasProvider(providerCode)) {
      return res.status(404).json({ message: "Unknown provider" });
    }

    const log = await prisma.webhookLog.create({
      data: {
        providerCode,
        signatureOk: false, // real signature check happens in the provider adapter
        status: "RECEIVED",
        payloadHash: payloadHash(req.body ?? null),
      },
    });

    // Hand off to the durable queue; a future worker + provider adapter will
    // verify the signature and turn the payload into canonical reservations.
    await queue.enqueue({
      kind: "WEBHOOK",
      payload: { providerCode, webhookLogId: log.id },
    });

    res.status(202).json({ received: true });
  } catch (err) {
    next(err);
  }
});

export default router;

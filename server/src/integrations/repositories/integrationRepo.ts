import { prisma } from "../../prisma";
import { MappingError } from "../core/errors";

/**
 * Repository over the integration-layer tables. Keeps Prisma queries in one
 * place so the service and router never build raw queries themselves.
 */
export const integrationRepo = {
  // ── Providers ──
  listProviders() {
    return prisma.integrationProvider.findMany({ orderBy: { name: "asc" } });
  },

  upsertProvider(code: string, name: string) {
    return prisma.integrationProvider.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  },

  // ── Accounts ──
  listAccounts() {
    return prisma.integrationAccount.findMany({
      include: { provider: true, branch: true, _count: { select: { roomMappings: true, reservationMappings: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  getAccount(id: string) {
    return prisma.integrationAccount.findUnique({
      where: { id },
      include: { provider: true, branch: true },
    });
  },

  createAccount(input: { providerId: string; branchId: string; externalHotelId?: string; settings?: string }) {
    return prisma.integrationAccount.create({
      data: { ...input, status: "DISCONNECTED" },
      include: { provider: true, branch: true },
    });
  },

  deleteAccount(id: string) {
    return prisma.integrationAccount.delete({ where: { id } });
  },

  // ── Room mappings ──
  listRoomMappings(accountId: string) {
    return prisma.roomMapping.findMany({
      where: { accountId },
      include: { room: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async createRoomMapping(input: { accountId: string; roomId: string; externalRoomId: string; externalName?: string }) {
    // Enforce the "one external ↔ one internal room per account" invariant with a
    // clear domain error rather than a raw Prisma unique-constraint failure.
    const existing = await prisma.roomMapping.findFirst({
      where: {
        accountId: input.accountId,
        OR: [{ externalRoomId: input.externalRoomId }, { roomId: input.roomId }],
      },
    });
    if (existing) {
      throw new MappingError("Этот номер уже сопоставлен для данного подключения.");
    }
    return prisma.roomMapping.create({ data: input });
  },

  deleteRoomMapping(id: string) {
    return prisma.roomMapping.delete({ where: { id } });
  },

  // ── Logs ──
  listSyncLogs(accountId: string, limit = 100) {
    return prisma.syncLog.findMany({
      where: { accountId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },

  listWebhookLogs(accountId: string, limit = 100) {
    return prisma.webhookLog.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  // ── Queue backlog (for health) ──
  countJobsByStatus(accountId?: string) {
    return prisma.syncJob.groupBy({
      by: ["status"],
      where: accountId ? { accountId } : undefined,
      _count: { _all: true },
    });
  },
};

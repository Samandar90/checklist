import { integrationRepo } from "../repositories/integrationRepo";
import { getProvider, listProviders } from "../providers/registry";
import { queue } from "../core/queue";
import { ProviderContext, ProviderHealth } from "../core/provider";
import { IntegrationError } from "../core/errors";

/**
 * Thin orchestration layer used by the router. Controllers stay dumb; all
 * integration decisions live here. No provider-specific logic — everything is
 * resolved through the registry.
 */
export const integrationService = {
  listProviders() {
    return integrationRepo.listProviders();
  },

  listAccounts() {
    return integrationRepo.listAccounts();
  },

  /**
   * Create an account linking a branch to a provider. This is NOT authentication
   * with the OTA — it only declares intent to integrate; status stays
   * DISCONNECTED until a real adapter connects. No secrets are accepted here.
   */
  async createAccount(input: { providerId: string; branchId: string; externalHotelId?: string; settings?: unknown }) {
    const provider = await integrationRepo
      .listProviders()
      .then((ps) => ps.find((p) => p.id === input.providerId));
    if (!provider) throw new IntegrationError("Провайдер не найден", "UNKNOWN_PROVIDER", 404);
    // Ensure the provider actually has a registered adapter.
    this.assertProviderRegistered(provider.code);
    return integrationRepo.createAccount({
      providerId: input.providerId,
      branchId: input.branchId,
      externalHotelId: input.externalHotelId,
      settings: input.settings != null ? JSON.stringify(input.settings) : undefined,
    });
  },

  async deleteAccount(accountId: string) {
    await this.requireAccount(accountId);
    return integrationRepo.deleteAccount(accountId);
  },

  async listRoomMappings(accountId: string) {
    await this.requireAccount(accountId);
    return integrationRepo.listRoomMappings(accountId);
  },

  async createRoomMapping(accountId: string, roomId: string, externalRoomId: string, externalName?: string) {
    await this.requireAccount(accountId);
    return integrationRepo.createRoomMapping({ accountId, roomId, externalRoomId, externalName });
  },

  async listLogs(accountId: string) {
    await this.requireAccount(accountId);
    const [sync, webhooks] = await Promise.all([
      integrationRepo.listSyncLogs(accountId),
      integrationRepo.listWebhookLogs(accountId),
    ]);
    return { sync, webhooks };
  },

  /**
   * Enqueue a manual sync. This does NOT talk to any OTA — it creates a durable
   * IMPORT job. With no adapter implemented, a future worker would pick it up
   * and the provider's importReservations() would (currently) report
   * NotImplemented; here we only guarantee the job is queued and auditable.
   */
  async triggerSync(accountId: string, kind: "IMPORT" | "EXPORT" = "IMPORT") {
    await this.requireAccount(accountId);
    const jobId = await queue.enqueue({ kind, accountId });
    return { jobId, status: "queued" as const };
  },

  /** Health snapshot per account, via the provider adapter + queue backlog. */
  async health(accountId: string): Promise<ProviderHealth & { backlog: number }> {
    const account = await this.requireAccount(accountId);
    const provider = getProvider(account.provider.code);
    const ctx: ProviderContext = {
      accountId: account.id,
      branchId: account.branchId,
      externalHotelId: account.externalHotelId,
      settings: parseSettings(account.settings),
    };
    const health = await provider.healthCheck(ctx);
    const counts = await integrationRepo.countJobsByStatus(accountId);
    const backlog = counts.find((c) => c.status === "PENDING")?._count._all ?? 0;
    return { ...health, backlog };
  },

  /** Ensure a provider code is known before any account can use it. */
  assertProviderRegistered(code: string) {
    getProvider(code); // throws UnknownProviderError if not registered
  },

  registeredProviderCodes(): string[] {
    return listProviders().map((p) => p.code);
  },

  async requireAccount(accountId: string) {
    const account = await integrationRepo.getAccount(accountId);
    if (!account) throw new IntegrationError("Подключение не найдено", "ACCOUNT_NOT_FOUND", 404);
    return account;
  },
};

function parseSettings(settings: string | null): Record<string, unknown> {
  if (!settings) return {};
  try {
    const parsed = JSON.parse(settings);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

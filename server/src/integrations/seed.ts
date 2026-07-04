import { listProviders } from "./providers/registry";
import { integrationRepo } from "./repositories/integrationRepo";

/**
 * Idempotent: mirror the in-code provider registry into IntegrationProvider so
 * the DB registry and the code registry can never drift. Safe to call on every
 * boot; adds new providers, updates display names, never deletes.
 */
export async function seedIntegrationProviders(): Promise<void> {
  for (const provider of listProviders()) {
    await integrationRepo.upsertProvider(provider.code, provider.name);
  }
}

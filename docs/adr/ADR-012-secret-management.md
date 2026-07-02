# ADR-012: Secret Management

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 42.12, 41.11/41.13, 38.18–38.19, 12 (config), 15/ADR-004 (signing keys) |
| **Review findings resolved** | Top-100 item 32 (secret-store decision awaited by Chs 12/38/41/42); enabler for GDPR crypto-shredding (Blocker #6) and per-tenant keys (ADR-001 open question 1) |
| **Depends on** | ADR-001 (tenant scoping of credentials), ADR-003 (rotation jobs) |
| **Depended on by** | ADR-004 (JWT keys), ADR-013 (edge credentials), ADR-014 (plugin config), payment/OTA integrations (Ch 30/31/38) |

---

## 1. Context

Four chapters demand secret protection (encrypted at rest/in transit, rotation, versioning, revocation — 38.18–19, 41.11/13, 42.12) and none names a mechanism. The platform actually has **two different secret problems** that a single "use a vault" answer conflates:

1. **Platform secrets** — few, slow-changing, deploy-time: DB credentials, JWT signing keys, LBL's own provider accounts (SMS/email), edge/API tokens.
2. **Tenant integration credentials** — many, dynamic, runtime-managed by customers through wizards (38.17): OTA API keys, payment-provider credentials, OAuth refresh tokens, webhook secrets — per organization, created/rotated/revoked constantly, and *themselves tenant data* under ADR-001.

### Decision drivers

1. Nothing secret in git or images, ever (42.12) — and CI that proves it.
2. Tenant credentials: encrypted at rest, tenant-isolated, auditable access, rotatable without downtime (38.19).
3. **Per-tenant cryptography as a GDPR instrument**: crypto-shredding (delete a tenant's key ⇒ their encrypted data is gone) — the mechanism Blockers #6 and ADR-001 §3.5 await.
4. Stage-1 operability: no 24/7 unseal-and-HA infrastructure for a small team.
5. Key rotation with overlap (signing keys per ADR-004 JWKS; data keys lazily re-wrapped).

---

## 2. Options considered

### Option A — Hosting env vars only (Stage-1 status quo)
- ✅ Fine for platform secrets today. ❌ No runtime CRUD, no rotation/audit story, nothing for tenant credentials. **Insufficient alone.**

### Option B — HashiCorp Vault (self-hosted)
- ✅ The most capable tool. ❌ Unsealing, HA, upgrades — a standing ops tax that a small team pays forever; overkill when a cloud KMS provides the primitive that matters (root-key custody + envelope encryption). **Rejected.**

### Option C — Cloud KMS + envelope encryption in Postgres + managed secret store for platform secrets — **chosen**
Root keys live in a cloud KMS (never exportable); data keys are generated per scope, used for AES-256-GCM, and stored only *wrapped* by the KMS. Tenant credentials live as ciphertext in tenant-scoped Postgres tables. Platform secrets live in the host's secret facility now, a managed secret store (AWS/GCP Secret Manager) from Stage 2.

---

## 3. Decision

### 3.1 Platform secrets

- Stage 1: hosting provider's secret/env facility, populated manually by owners, inventoried in a checked-in **secret catalog** (names, owners, rotation period — *no values*).
- Stage 2+: managed cloud secret store, referenced by deploy tooling (42.5 IaC); apps read at boot; rotation via dual-secret overlap (old+new valid during a window).
- Non-prod configuration that must live in git is **SOPS-encrypted** (age/KMS keys) — encrypted-in-repo, never plaintext.
- JWT signing keys (ADR-004): generated and held KMS-side (sign via KMS API) or KMS-wrapped locally; JWKS publishes public halves; rotation drill per ADR-004.

### 3.2 Tenant integration credentials (the `SecretsService`)

- Table `tenant_secrets` (ADR-001 tenant-scoped, RLS): `organization_id`, `integration_id`, `name`, `ciphertext`, `data_key_wrapped`, `version`, `created/rotated/revoked` timestamps, `last_used_at`.
- **Envelope encryption:** one **data key per organization** (extendable to per-integration), AES-256-GCM; data keys wrapped by the KMS root key; unwrap happens in memory with a short-TTL cache. Root-key rotation = re-wrap data keys (lazy, background job per ADR-003); it never re-encrypts payloads.
- **Crypto-shredding:** destroying an organization's data key renders its ciphertext permanently unreadable — this is the tenant-deletion and GDPR-erasure primitive ADR-001 §3.5 references. Key destruction is a two-person, audited, delayed (7-day soft window) operation.
- One **`SecretsService` module is the only code path** that decrypts (single-door pattern, same as ADR-002/006/008/011). Decrypted values: never logged (17.12), never serialized into events/exports, never returned by APIs (write-only fields; reads return metadata + `last4`-style hints).
- Access audit: every decrypt records `(who/what job, which secret, when)` — feeds 41.17 and the integration logs (38.23).

### 3.3 Rotation & revocation

- Tenant credentials: rotation via the 38.17 wizard or provider-driven refresh (OAuth) — new version written, old kept until confirmed, then revoked (38.19's zero-interruption requirement).
- Expiry monitoring (38.19): background job flags credentials near expiry → Notification Center.
- Compromise runbook: revoke version, force integration re-auth, audit access trail — referenced by the security handbook.

---

## 4. Consequences

**Positive** — one primitive (KMS + envelope) serves integrations, GDPR shredding, per-tenant isolation, and future BYOK (enterprise brings their own KMS key — the dedicated-tier ask lands as configuration, not redesign). No standing vault infrastructure.
**Negative / accepted** — KMS becomes a hard runtime dependency for integration flows (mitigated by the unwrap cache + graceful degradation: integrations pause, core PMS unaffected); per-org data keys add key-inventory management (bounded, automated).
**Risks** — *cache holds plaintext in memory*: short TTL, no swap-out serialization, process-level only. *KMS regional availability*: keys replicated per provider capability; noted in DR runbooks (Ch 45).

## 5. Compliance checks (CI-enforceable)

1. gitleaks/trufflehog scan in CI — build fails on secret-shaped strings (repo + images).
2. Lint: `process.env` readable only in the config module; no crypto primitives outside `SecretsService`.
3. Log-scrubber test: fixture secrets injected through request/job paths never appear in captured logs/events.
4. API contract test: secret fields are write-only; responses expose metadata only.
5. Shred test: destroy fixture org's data key → all its ciphertext undecryptable; unrelated org unaffected.
6. Rotation test: root-key rotation with lazy re-wrap keeps all decrypts working mid-migration.

## 6. Open questions

1. Which cloud KMS (follows primary hosting choice at Stage 2 — ADR-015 gate).
2. BYOK contract details for dedicated-tier tenants — with the first enterprise requirement.
3. Field-level PII encryption (Ch 23 documents) — reuses this envelope machinery; scoped in the privacy-engineering spec.

## 7. References
PMS-1.2-Architecture-Review.md Top-100 #32, #43; Detailed review Ch 38 finding 1, Ch 41 finding 1, Ch 23 finding 3. ADR-001 §3.5, ADR-004 §3.1.

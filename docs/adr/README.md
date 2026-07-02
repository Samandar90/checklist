# LBL PMS — Architecture Decision Records

Foundational decisions identified by the architecture review (PMS-1.2-Architecture-Review.md, roadmap "Immediate" phase). One ADR per decision; status lifecycle: `Proposed → Accepted → (Superseded by ADR-NNN)`.

| # | Decision | Status | Blocks (spec chapters) |
|---|---|---|---|
| [ADR-001](ADR-001-multi-tenancy-data-model.md) | Multi-tenancy data model (pooled + RLS, tiered) | **Proposed** | 28, 40, 42, 45, 48 |
| [ADR-002](ADR-002-financial-core-ledger-folio-night-audit.md) | Financial core: double-entry ledger, folios, night audit | **Proposed** | 22, 26, 35, 36, 38, 46 |
| [ADR-003](ADR-003-transactional-outbox-and-jobs.md) | Transactional outbox + background job infrastructure | **Proposed** | 17, 26, 30, 32, 33, 39, 40, 46 |
| [ADR-004](ADR-004-auth-sessions-tokens-revocation.md) | Auth sessions: access/refresh tokens, revocation, storage, MFA | **Proposed** | 15, 29 |
| [ADR-005](ADR-005-realtime-transport.md) | Real-time transport (SSE), reconnect/backfill protocol | **Proposed** | 20, 21 |
| [ADR-006](ADR-006-reservation-state-machine.md) | Reservation state machine: transition matrix, single executor | **Proposed** | 22, 24, 27 |
| [ADR-007](ADR-007-business-dates-and-timezones.md) | Business dates & timezones (hotel-local stay dates vs UTC instants) | **Proposed** | 20, 22, 26, 27, 40, 48 |
| [ADR-008](ADR-008-authorization-policy-engine.md) | Authorization policy engine (RBAC+ABAC evaluation) | **Proposed** | 29, 41 |
| [ADR-009](ADR-009-frontend-server-state.md) | Frontend server-state library & data-loading pattern | **Proposed** | 11, 21 |
| ADR-010 | Mobile framework & offline sync protocol | Planned | 43 |
| ADR-011 | Search architecture (Postgres FTS → OpenSearch triggers) | Planned | 14, 23, 28 |
| ADR-012 | Secret management (KMS/Vault) | Planned | 12, 38, 41, 42 |
| ADR-013 | API gateway placement & rate-limiting enforcement | Planned | 14, 37, 42 |
| ADR-014 | Extension sandbox runtime (webhook/iframe-first) | Planned | 46 |
| ADR-015 | Evolution-stage triggers (monolith → services, per Ch 50.11) | Planned | 12, 42, 50 |

**Rules:** an ADR is ~1–3 pages: context, drivers, options with rejection reasons, decision, consequences, CI-enforceable compliance checks. No feature spec may cite a "Planned" ADR as resolved. Chapter 13 (Data Architecture) may be written only after ADR-001, -002, -003, -006, -007 are Accepted.

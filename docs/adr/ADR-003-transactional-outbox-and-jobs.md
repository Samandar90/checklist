# ADR-003: Transactional Outbox, Domain Events & Background Job Infrastructure

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 17 (Audit), 26 (Finance), 30 (Channel Manager), 32 (Notification Center), 33 (Automation), 39 (AI), 40 (Data Platform), 46 (Plugins), 12 (Backend) |
| **Review findings resolved** | Blocker #8 (no reliable event delivery); Top-100 items 6, 15, 67 |
| **Depends on** | ADR-001 (every event carries `organization_id`) |
| **Depended on by** | ADR-002 (night-audit scheduling, fiscalization jobs), ADR-005 (real-time fan-out source) |

---

## 1. Context

Eight chapters presuppose that "every module publishes events" (32.6, 33.3, 46.9, 50.10) and that long-running work happens "in the background" (18.20, 26.44, 30.13). The Chapter 12 stack contains **no queue, no broker, no job runner, and no Redis** — and, more fundamentally, no answer to the **dual-write problem**: if a service saves a payment and then publishes "PaymentReceived" as two separate operations, a crash between them silently loses the notification, the channel-sync job, or the audit projection. At-least-once delivery of business events must be *guaranteed by construction*, or Chapters 30/32/33 are built on sand.

Concrete v1 consumers of this infrastructure:
- **Night audit** (ADR-002 §3.4) — scheduled, per-hotel, business-critical.
- **Channel Manager sync jobs** (30.13/30.16) — created atomically with availability changes.
- **Notification Center** (32.10) — event-triggered, queued, retried.
- **Automation Engine triggers** (33.3–33.5).
- **Webhooks to integrators** (37.16) and plugin event hooks (46.9).
- **Warehouse ingestion** (40.5) and read-model refresh (dashboard aggregates).

### Decision drivers

1. **Atomicity:** business change + event emission must commit or fail together.
2. **Stage-1 simplicity:** one infrastructure dependency (PostgreSQL) — no Kafka/RabbitMQ/Redis clusters for a small team on managed hosting.
3. **At-least-once + idempotent consumers** as the platform delivery contract (37.18, 30.23 already demand idempotency — this generalizes it).
4. **Per-aggregate ordering:** events for one reservation must be consumable in order; global ordering is not required.
5. **Evolution path:** a broker (Kafka-class) must be adoptable later (37.29, Stage 3+) without rewriting producers.
6. **Durable scheduled work:** cron-like jobs (night audit, scheduled reports 26.44, scheduled notifications 32.17) with retries, backoff, and dead-lettering.

---

## 2. Options considered

### Option A — Direct publish to a message broker (Kafka / RabbitMQ / NATS) from services
- ❌ Does not solve dual-write (publish and DB commit are still two systems) without adding transactions/outbox anyway.
- ❌ New 24/7 infrastructure at Stage 1 (against driver 2).
- **Rejected for now**; brokers re-enter at Stage 3 as *transport behind* the outbox (§3.6).

### Option B — Transactional outbox in PostgreSQL + Postgres-based job queue — **chosen**
Events written to an `outbox` table **in the same transaction** as the business change; a relay publishes them to consumers. Jobs run on a Postgres-backed queue (`pg-boss`).
- ✅ Atomicity for free (one database, one transaction). One infra dependency.
- ✅ `FOR UPDATE SKIP LOCKED` gives competing-consumer semantics natively in Postgres.
- ✅ pg-boss provides retries, backoff, cron scheduling, archiving — the 30.14/32.12 retry ladders become configuration.
- ⚠️ Postgres carries queue load (mitigable: separate schema, aggressive archiving; volume triggers in §3.6).

### Option C — Change Data Capture (Debezium → broker)
- ✅ No producer code changes; strongest ordering guarantees.
- ❌ Operationally the heaviest option (Kafka Connect + broker + schema registry) — wrong for Stage 1.
- **Deferred:** CDC is the likely Stage-3 ingestion path for the Chapter 40 warehouse; the outbox does not preclude it.

### Option D — Redis-backed queues (BullMQ)
- ❌ Second infrastructure dependency, and Redis enqueue cannot join the Postgres business transaction — dual-write returns.
- **Rejected** as the event backbone. (Redis still arrives later for caching/rate-limiting per 18.19 — different concern.)

---

## 3. Decision

### 3.1 Outbox table & producers

`outbox_events`: `id (UUIDv7 — time-ordered)`, `organization_id`, `aggregate_type`, `aggregate_id`, `event_type`, `event_version`, `payload JSONB`, `occurred_at`, `published_at (nullable)`, `attempts`.

- **Rule:** any service method that changes business state and must announce it writes the event **in the same Prisma transaction** as the change. Direct emission to any other channel from business code is forbidden (lint + review gate).
- Audit records (Ch 17) are **not** outbox events — they are same-transaction inserts into the append-only audit table (per review Ch 17 finding 1). The outbox may additionally carry an event for audit *projections/search indexing*, but the audit record itself never depends on the relay.

### 3.2 Relay & dispatch

- A relay worker polls `outbox_events WHERE published_at IS NULL` with `FOR UPDATE SKIP LOCKED` in batches, ordered by `id` (UUIDv7 = creation order), and dispatches to registered consumers. Per-aggregate ordering is preserved by partitioning batches on `aggregate_id`.
- v1 consumers are **in-process modules** (Notification Center intake, channel-sync job creator, automation trigger matcher, webhook fan-out, read-model refreshers). Each consumer records processed event IDs in its own **inbox table** (`consumer_name, event_id, processed_at`) — this is the idempotency mechanism; duplicate delivery is a no-op by design.
- Delivery contract, platform-wide and documented: **at-least-once, per-aggregate ordered, idempotent consumers mandatory.**

### 3.3 Job infrastructure

- **pg-boss** as the job runner: named queues per concern (`night-audit`, `channel-sync`, `notifications`, `automation-exec`, `webhooks`, `reports`, `exports`).
- Every job payload carries `organization_id` (+ `hotel_id` where relevant); workers re-establish tenant context (ADR-001 §3.2) before any query.
- **Retry policy defaults** implement the spec's ladders (30.14, 32.12): exponential backoff, capped attempts, then **dead-letter** (pg-boss failed-job retention + a `dead_letters` review surface with owner and SLA — resolves review Ch 30 finding 2).
- **Scheduled jobs** via pg-boss cron: night audit per hotel (at hotel-local audit hour — scheduler computes UTC per ADR-007), scheduled reports, hold-expiry sweeps, retention jobs.
- **Dead-man monitoring** for business-critical schedules: night audit not completed by audit-hour+1h → page (ADR-002 risk mitigation).
- Workers run as a **separate process/deployment unit** from the web tier from day one (even on Stage-1 hosting: a second service) — an execution storm must not degrade check-in (review Ch 33 finding 19), and this is the natural first seam for the 50.11 evolution.

### 3.4 Event schema & registry

- Fixed **envelope**: `event_id`, `event_type` (namespaced: `reservation.checked_in`), `event_version`, `occurred_at`, `organization_id`, `hotel_id?`, `aggregate_type`, `aggregate_id`, `payload`.
- An **event catalog** document (one file in-repo, PR-reviewed) lists every event type with its versioned payload schema (JSON Schema). Public webhooks (37.16), plugin hooks (46.9), and internal consumers all bind to the same catalog — one event dialect, not three (resolves review Top-100 #67).
- Evolution rules: additive changes bump minor (consumers tolerate unknown fields); breaking changes = new `event_version`, old version emitted in parallel through a deprecation window (37.27 discipline applied internally).

### 3.5 What this ADR does *not* cover

- Automation Engine's **durable long waits** ("wait until check-in", 33.18) — pg-boss delayed jobs suffice for bounded delays; month-long stateful workflows need the Temporal-vs-homegrown evaluation flagged in the review (Ch 33 finding 1). Deferred to the Automation Engine spec; this ADR provides its substrate either way.
- Real-time UI push (calendar live updates) — ADR-005; the outbox is its *source*, the transport is its own decision.

### 3.6 Evolution triggers (Stage 3+)

Introduce a broker (and/or CDC) behind the relay — producers unchanged — when **any** of:
- Sustained outbox throughput > ~500 events/sec or relay lag SLO (p95 < 2s) breached under tuning.
- A consumer needs replay/long retention beyond the outbox archive window.
- Cross-service consumption appears (first extracted service per 50.11) — in-process dispatch no longer reaches it.
- Warehouse ingestion moves to streaming (Ch 40 CDC decision).

---

## 4. Consequences

**Positive**
- The dual-write class of bugs is structurally eliminated; Chapters 30/32/33/46 get a real foundation.
- One new operational concept (workers) instead of three (broker + queue + scheduler).
- Night audit, retries, DLQs, scheduled reports — all become configuration on one substrate.
- The event catalog forces the API/webhook/plugin payloads to converge now, when it is cheap.

**Negative / accepted costs**
- Postgres hosts queue traffic: outbox and pg-boss tables need archiving policies and their own monitoring (queue depth, relay lag) from day one.
- At-least-once means **every** consumer must be written idempotently — a permanent discipline, enforced by the inbox pattern and tests, not by trust.
- In-process consumers couple deploys (a bad consumer blocks the relay batch) — mitigated by per-consumer error isolation (failed consumer → its own retry, not batch failure).

**Risks & mitigations**
- *Risk:* relay falls behind silently. → lag metric (`now − min(occurred_at) unpublished`) with alert threshold; the first SLO of the platform.
- *Risk:* poison event loops a consumer forever. → per-consumer attempt cap → consumer-level dead-letter with owner notification.
- *Risk:* outbox table bloat. → published events archived/partitioned on schedule; retention per event class.

---

## 5. Compliance checks (CI-enforceable)

1. Lint: no event emission API callable outside a transaction context; no direct queue/notification calls from business services (must route through outbox or job API).
2. Catalog test: every `event_type` emitted in code exists in the event catalog with a valid JSON Schema; payloads validate against it in integration tests.
3. Idempotency test template: every consumer is delivered each fixture event twice; state must be identical to single delivery.
4. Tenant test: every emitted event and job payload carries `organization_id` (extends ADR-001 check #4).
5. Chaos test (staging): kill the relay mid-batch; assert zero event loss and zero duplicate side effects after restart.

## 6. Open questions (tracked, not blocking)

1. Temporal (or equivalent) for Automation Engine durable workflows — evaluate when Ch 33 implementation starts.
2. Outbox archive retention per event class (legal events longer) — with the retention schedule (GDPR work).
3. Broker selection at Stage 3 (Kafka vs NATS JetStream) — decide at trigger time, not before.

## 7. References

- PMS-1.2-Architecture-Review.md §6 Blocker #8; Top-100 items 6, 15, 53, 67.
- PMS-1.2-Architecture-Review-Detailed.md — Ch 12 finding 1, Ch 30 findings 1–2, Ch 32 finding 1, Ch 33 findings 1/19.
- Patterns: Transactional Outbox, Competing Consumers, Inbox/Idempotent Consumer (microservices.io); pg-boss documentation.

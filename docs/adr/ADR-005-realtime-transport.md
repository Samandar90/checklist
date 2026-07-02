# ADR-005: Real-Time Transport for Live UI Updates

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 21.70 (calendar live updates), 20.14 (activity feed), 21.78 (offline resilience), 25.17/25.29 (housekeeping dashboards), 26.29 (financial dashboard), 30.18 (sync dashboard) |
| **Review findings resolved** | Top-100 item 16; Detailed review Ch 21 findings 1/10, Ch 20 finding 1 |
| **Depends on** | ADR-003 (outbox is the event source), ADR-004 (stream authentication), ADR-001 (tenant-scoped subscriptions) |
| **Depended on by** | Calendar data API contract; dashboard widget contracts |

---

## 1. Context

Chapter 21.70 requires that reception staff "see changes without refreshing" — reservation created/moved, check-ins, payments, housekeeping status — and 21.78 requires graceful recovery after connectivity loss ("what did I miss while disconnected"). Dashboards (20.14, 25.17, 26.29) want the same. No chapter chooses a transport, an authentication model for the stream, or a backfill protocol. Mutations are *not* part of this problem: all writes go through the REST API (Ch 14); this decision covers **server→client push only**.

### Decision drivers

1. Multi-user calendar coherence with sub-second perceived latency on a hotel LAN/normal broadband.
2. **Missed-event recovery**: reconnect must deterministically resume or instruct a refetch — never silently show stale data.
3. Authentication + tenant/branch scoping per connection (a receptionist must not subscribe to another branch's stream — review Ch 21 finding 5).
4. Stage-1 infrastructure honesty: few app instances, one Postgres, managed hosting (Ch 12); no new 24/7 dependency for v1.
5. Multi-instance fan-out: an event committed via instance A must reach clients connected to instance B.
6. Cheap fan-out: hundreds of concurrent connections per busy hotel property, thousands platform-wide at Stage 2.
7. Mobile *background* delivery is explicitly out of scope — that is push notifications (FCM/APNs, Ch 43.10 via Notification Center); this ADR covers foreground live UI.

---

## 2. Options considered

### Option A — Short polling / long polling
- ✅ Zero new machinery; works everywhere.
- ❌ Latency×load tradeoff never satisfies 21.70 at acceptable cost; long polling is SSE with worse ergonomics. **Rejected as primary; retained as the automatic degraded mode** (driver: 21.78, corporate proxies that break streaming).

### Option B — WebSocket
- ✅ Bidirectional, binary-capable, lowest per-message overhead.
- ❌ Bidirectionality is unused (writes go via REST); needs its own auth handshake, heartbeat, and reconnect/backfill protocol *built by hand*; more proxy/LB friction; on Stage-1 hosting, connection limits and sticky behavior are real constraints. **Not chosen for v1** — adoption triggers defined in §3.6.

### Option C — Server-Sent Events (SSE) — **chosen**
- ✅ Server→client only — exactly the problem shape; runs over plain HTTP (same middleware chain: ADR-004 auth, ADR-001 tenant context, standard LB/proxy behavior).
- ✅ **Reconnect + `Last-Event-ID` are built into the protocol** — the backfill contract (driver 2) gets native client support (`EventSource` auto-reconnect).
- ✅ Trivial to consume in React and in future mobile webviews; HTTP/2 multiplexing removes the legacy 6-connection limit.
- ⚠️ Unidirectional (acceptable — see above); text-only (fine — JSON events).

---

## 3. Decision

### 3.1 Endpoint & subscription model

- One streaming endpoint: `GET /api/v1/events/stream?scope=hotel:{id}` (SSE). Authenticated by the normal ADR-004 middleware; the requested scope is validated against the session's permissions (org → hotel → branch). Scope classes v1: `hotel:{id}` (calendar/operations surface) and `user:{id}` (personal notifications). Finer filtering is client-side — server-side per-entity filters are premature.
- Connection policy: max concurrent streams per user (default 3); heartbeat comment every 25 s (proxy keep-alive); server closes idle/unauthorized streams; on permission change or session revocation (ADR-004), affected streams are terminated server-side.

### 3.2 Event flow (source → wire)

`business tx → outbox (ADR-003) → relay → LISTEN/NOTIFY fan-out → SSE connections`

- A dedicated outbox consumer publishes UI-relevant events to **Postgres `NOTIFY`** on per-hotel channels; every app instance `LISTEN`s and forwards to its local SSE connections. This keeps Stage 1 at **one infrastructure dependency** (driver 4). NOTIFY payload carries only the event ID reference (8 KB limit is irrelevant by design) — instances read the event row from the outbox.
- **Thin events on the wire**: `{id, type, aggregate_type, aggregate_id, version, hotel_id, occurred_at}` — *no business payload*. Clients react by patching/refetching the affected entity through the normal permission-filtered REST API. Rationale: (a) no permission leakage through fat pushed payloads (hover-preview finding, Ch 21 #5); (b) fan-out stays cheap; (c) one source of field-level truth (the API), so push and fetch can never disagree.

### 3.3 Reconnect & backfill contract (the part 21.78 actually needs)

- Event `id` = the outbox UUIDv7 (time-ordered). Client reconnects with `Last-Event-ID` (native SSE header).
- Server replays events for the subscribed scope from the outbox where `id > Last-Event-ID`, **within the replay horizon** (outbox retention for UI events: 24 h).
- If the gap exceeds the horizon (or the client has no cursor), the server sends a single control event `{type:"resync"}` — the client refetches its visible window (calendar range, dashboard widgets) and resumes streaming. This two-mode contract (delta-replay | resync) is normative for every consuming surface.
- While disconnected, the UI must show a staleness indicator and disable optimistic interactions that depend on liveness (degraded-mode requirement — review Ch 21 finding 10).

### 3.4 Client integration

- One shared stream client in the frontend (single `EventSource` per scope, multiplexed to subscribers) integrated with the server-state layer (ADR-009): events invalidate/patch query cache entries by `(aggregate_type, aggregate_id)`. No component opens its own connection.
- Calendar specifics: reservation events carry `version` — if the client already holds ≥ version (own optimistic update confirmed), the event is a no-op; otherwise targeted refetch of that reservation/row. This is the missing half of 21.73's optimistic-update loop.

### 3.5 Monitoring (SLOs from day one)

- `push_lag` = NOTIFY receipt − outbox `occurred_at`; SLO p95 < 2 s.
- Connected-clients gauge per instance/hotel; reconnect rate; resync rate (a rising resync rate = retention too short or clients unstable — the health signal that matters).

### 3.6 Evolution triggers

- **Redis pub/sub replaces LISTEN/NOTIFY** when: instance count makes per-instance LISTEN wasteful, NOTIFY throughput becomes a measurable Postgres load, or the first extracted service (50.11) must publish UI events without DB access.
- **WebSocket (or WebTransport) is introduced** only when a genuinely bidirectional feature ships (collaborative presence/cursors, in-app chat); it will reuse the same event contract (§3.2–3.3) — the transport is swappable by design because the contract, not the socket, is the architecture.

---

## 4. Consequences

**Positive**
- 21.70/21.78/20.14 get a concrete, testable design with native reconnect semantics instead of a hand-built protocol.
- Zero new infrastructure at Stage 1; auth/tenancy inherited from the existing HTTP stack rather than re-implemented for a socket.
- Thin-event discipline eliminates a whole class of permission-leak and push/fetch-divergence bugs.

**Negative / accepted costs**
- Thin events cost an extra REST fetch per change (deliberate; mitigated by batching/coalescing in the client for event bursts, e.g., group-reservation updates).
- SSE holds an HTTP connection per client — connection-count capacity must be part of instance sizing (Stage-1 hosting verified for streaming responses; documented in the infra guide).
- Two modes (delta/resync) mean every consuming surface must implement resync honestly — enforced by the shared client, not by per-feature discipline.

**Risks & mitigations**
- *Risk:* proxies/antivirus strip streaming. → automatic downgrade to long-polling fallback in the shared client (same contract, worse latency), plus staleness indicator.
- *Risk:* event storm (bulk operations) floods clients. → server-side coalescing per (scope, aggregate) within a 250 ms window; resync instruction for oversized bursts.
- *Risk:* replay horizon too short for overnight tablets. → resync path is first-class and tested, not an error branch.

---

## 5. Compliance checks (CI-enforceable)

1. AuthZ test: stream subscription to an unpermitted hotel/branch is rejected; permission revocation closes the stream within the liveness window.
2. Backfill test: disconnect → events emitted → reconnect with `Last-Event-ID` → exact gap replayed, order preserved, no duplicates (consumer-side idempotency by event id).
3. Resync test: cursor older than horizon → `resync` control event → client refetch path executes.
4. Payload test: wire events contain no business fields beyond the thin-event schema (leak prevention as a test).
5. Multi-instance test: event committed via instance A reaches a client connected to instance B (LISTEN/NOTIFY path).
6. Lint: no `EventSource`/socket construction outside the shared stream client module.

## 6. Open questions (tracked, not blocking)

1. Per-branch scope granularity (`branch:{id}`) — add when branch-scoped roles are the common case; hotel scope + client filtering suffices for v1.
2. Read receipts / presence ("who else is viewing this reservation") — future; would be the WebSocket trigger.
3. Booking-engine public pages — explicitly **no** live streaming (cacheable reads only); availability freshness there is a Ch 31 caching concern, not a push concern.

## 7. References

- PMS-1.2-Architecture-Review.md — Top-100 item 16.
- PMS-1.2-Architecture-Review-Detailed.md — Ch 21 findings 1, 5, 10; Ch 20 findings 1, 14.
- ADR-003 (outbox/UUIDv7 ordering), ADR-004 (stream auth), ADR-009 (client cache integration).
- WHATWG SSE spec (`EventSource`, `Last-Event-ID`); PostgreSQL LISTEN/NOTIFY.

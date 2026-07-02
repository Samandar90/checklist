# ADR-009: Frontend Server-State Management & Data Loading

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 11.9–11.11 (amended/made concrete), 18.13 (search dedup/caching), 21.68 (prefetching), 21.73 (optimistic updates), 16.14/16.17 (frontend error & retry behavior), 20.18 (widget states) |
| **Review findings resolved** | Top-100 item 17; Detailed review Ch 11 findings 1–2, Ch 21 finding 1 (client store half) |
| **Depends on** | ADR-005 (SSE cache integration), ADR-006 (`allowed_actions` consumption), Ch 14 (cursor pagination) |
| **Depended on by** | Calendar implementation (Ch 21), dashboard widgets (Ch 20), all feature modules |

---

## 1. Context

Chapter 11 defines a layer cake (pages → hooks → services → API) but never chooses the machinery for the hardest frontend problem the spec poses elsewhere: **server-state caching**. Chapter 21 alone requires optimistic updates with rollback (21.73), request deduplication and query caching (18.13), prefetching adjacent calendar windows (21.68), keeping stale data visible through network loss (21.78), and cache patching from live events (ADR-005 §3.4). Hand-rolling this inside "services and hooks" means rebuilding a query cache badly — the exact trap the review flagged.

### Decision drivers

1. Optimistic mutation lifecycle (apply → server verdict → commit/rollback) as a *framework guarantee*, not per-feature code (21.73, 21.38).
2. Cache invalidation and surgical updates addressable by key — required by the SSE thin-event contract (ADR-005: events carry `aggregate_type/aggregate_id`; something must map that to cached queries).
3. Request dedup, focus/reconnect refetch, prefetch, infinite/windowed queries for virtualized lists (18.10, 21.63–68).
4. Spec compliance: 16.17 forbids auto-retry of dangerous mutations; 16.18/21.78 demand stale-data preservation; 20.18 demands uniform loading/empty/error/offline states.
5. Team throughput: the pattern must be teachable as "the one way to fetch data" (11.24's onboarding goal).

---

## 2. Options considered

### Option A — Hand-rolled services + hooks + Context (the spec's implicit reading)
- ❌ Rebuilds caching, dedup, invalidation, and rollback from scratch; Context-held server data re-renders everything (the exact pathology 18.9 warns against). **Rejected.**

### Option B — Redux Toolkit + RTK Query
- ✅ Capable cache; good codegen.
- ❌ Brings the Redux store as a permanent dependency the architecture otherwise doesn't need; more ceremony per endpoint. **Not chosen.**

### Option C — SWR
- ✅ Minimal, elegant reads.
- ❌ Mutation lifecycle (structured optimistic rollback, mutation states) and devtools are materially weaker for a mutation-heavy operational app. **Not chosen.**

### Option D — TanStack Query v5 — **chosen**
- ✅ Industry-standard server cache: full optimistic-mutation lifecycle, key-addressable invalidation and `setQueryData` patching, dedup, focus/online refetch, `useInfiniteQuery` for virtualized windows, prefetching, devtools, `keepPreviousData` for 21.78.
- ⚠️ A library dependency at the heart of the frontend — accepted; it is the de-facto standard with the largest ecosystem, and the service layer keeps API access swappable beneath it.

---

## 3. Decision

### 3.1 Layer contract (amends 11.9–11.11 into something enforceable)

```
Component → feature hook (useQuery/useMutation wrappers) → service (pure, generated API client) → HTTP
```

- **Services** are *pure functions* over a **generated OpenAPI client** (types + fetchers generated from the API spec — resolves review Ch 11 finding 15; a schema drift becomes a compile error, not a runtime bug). No caching, no state in services.
- **Feature hooks** own query keys, cache policy, and mutation lifecycles. **Components never fetch** (no `fetch`/client imports outside services — lint), and **`useEffect`-based data fetching is banned** (lint).
- **Server data never lives in Context or client stores** (11.10/11.11 amended from "avoid" to "never"): Context/Zustand hold only genuine client state — theme, drawer/selection UI state, current hotel context. The 18.9 re-render pathology is closed structurally.

### 3.2 Query key convention (the addressability contract)

`[domain, entity, id]` for singletons, `[domain, "list", normalizedFilters]` for collections, `[domain, "window", {rangeKey}]` for calendar windows. Keys are produced **only** by per-module key factories (one file per domain; lint bans inline key arrays). This registry is what the SSE bridge (§3.4) and tests address — inconsistent keys are the failure mode that silently breaks invalidation.

### 3.3 Mutation standard (21.73 as reusable code)

One `useOptimisticMutation` wrapper implements: `onMutate` snapshot + optimistic patch → `onError` rollback + toast per 16.14 → `onSettled` targeted invalidation. Version-aware: mutations send the entity `version` (ADR-006 §3.3); a 409 triggers the conflict UX (21.72's reload/merge affordance), never a silent overwrite. **Retry policy (16.17 enforced in defaults):** mutations never auto-retry; queries retry ×2 on network errors only, with backoff.

### 3.4 Live-update bridge (completes ADR-005)

The shared SSE client feeds one **event→cache map**: `(aggregate_type) → key-factory targets`. Thin event arrives → compare `version` against cached entity → stale ⇒ `invalidateQueries` (or `setQueryData` for cheap patches: status flips, balance updates). Burst coalescing (ADR-005 §risks) happens here. This map is the *only* place push meets cache — auditable in one file per domain.

### 3.5 Loading, routes, and states

- **Route-level loaders** (React Router) prefetch the route's critical queries (`queryClient.ensureQueryData`) so navigation lands on warm cache (18.3's "instant navigation"); heavy secondaries load in-component per 20.21's staged rendering.
- **Error boundaries** per route and per dashboard widget (20.18's five states standardized as a `<QueryBoundary>` wrapper providing loading / empty / error / offline / content) — widget failure never grays the page (Ch 20 finding 14's bulkhead).
- **Stale-data posture:** `keepPreviousData` everywhere lists paginate or windows slide; explicit staleness indicator binds to the SSE connection state (ADR-005 §3.3).

### 3.6 Cache policy defaults (per data class)

| Class | `staleTime` | Notes |
|---|---|---|
| Reference (room types, amenities, settings) | 5 min | invalidated by SSE on change |
| Operational (calendar, tasks, dashboard) | 15 s | SSE keeps it honest between refetches |
| Financial (folios, balances, shift state) | 0 | always revalidate on focus/mount |
| Search results | 30 s keyed by normalized query | debounce in hook per 18.13 |

- Calendar windows use `useInfiniteQuery` keyed by date-range pages; adjacent-window prefetch on idle implements 21.68.
- **No persistent (disk) cache in v1** — clean auth semantics (ADR-004 in-memory tokens) and no stale-PII-on-shared-terminal risk; revisit only with a concrete offline-web requirement (mobile offline is ADR-010's domain, not the web app's).

---

## 4. Consequences

**Positive**
- 21.73/21.68/21.78/18.13/16.17/20.18 stop being aspirations: each maps to a named framework mechanism with a house wrapper.
- The SSE thin-event design (ADR-005) becomes implementable — the cache is the addressable store those events needed.
- Onboarding story is one sentence: "keys from the factory, reads via useQuery hooks, writes via useOptimisticMutation, never fetch in components."

**Negative / accepted costs**
- TanStack Query's mental model (staleTime/gcTime, invalidation) must be taught once — cheaper than maintaining a bespoke cache forever.
- Generated API client adds a codegen step to CI — accepted; it *is* the contract check.
- Key-factory discipline is one more convention to enforce — carried by lint, not memory.

**Risks & mitigations**
- *Risk:* cache-patching logic (setQueryData) drifts from server truth. → patches allowed only for whitelisted cheap fields; everything else invalidates+refetches (correctness over cleverness — consistent with 18.19's "caching never compromises correctness").
- *Risk:* unbounded cache growth in long shifts (12-hour reception sessions, 18.2). → gcTime tuned per class; window queries capped; memory profiled in the Ch 21 perf harness.
- *Risk:* library major-version churn. → all usage behind the house wrappers (`useOptimisticMutation`, `QueryBoundary`, key factories) — the swap surface is deliberately small.

---

## 5. Compliance checks (CI-enforceable)

1. Lint: no `fetch`/HTTP-client imports outside `services/`; no data fetching in `useEffect`; no inline query-key arrays (key factories only); no server data in Context/stores.
2. Codegen check: generated client is current with the OpenAPI spec (hash compare) — build fails on drift.
3. Mutation test template: every mutation hook exercised for optimistic apply → error rollback → cache equals pre-mutation snapshot; 409 path renders conflict UX.
4. SSE-bridge test: fixture thin event per aggregate type → asserted invalidation/patch of exactly the mapped keys (and nothing else).
5. Retry-policy test: mutations never retried on failure; queries retried per policy (16.17 conformance).
6. Boundary test: every route and dashboard widget renders all five 20.18 states via `<QueryBoundary>` fixtures.

## 6. Open questions (tracked, not blocking)

1. Zustand vs Context for the small client-state remainder — trivial either way; decide at implementation (default: Context until a perf case appears).
2. Calendar window page size / prefetch radius — tune in the Ch 21 performance harness.
3. Codegen tool choice (openapi-typescript + fetch wrapper vs orval) — pick during API spec bootstrap; both satisfy this ADR.

## 7. References

- PMS-1.2-Architecture-Review.md — Top-100 item 17.
- PMS-1.2-Architecture-Review-Detailed.md — Ch 11 findings 1/2/13/15, Ch 21 finding 1, Ch 20 findings 12/14, Ch 16 finding "frontend behavior".
- ADR-005 §3.4 (event→cache), ADR-006 §3.4 (`allowed_actions`), Ch 14 (cursor pagination).
- TanStack Query v5 documentation.

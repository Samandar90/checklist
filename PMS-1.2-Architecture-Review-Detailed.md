# LBL PMS 1.2 — Detailed Per-Chapter Review (Full 20-Criteria Analysis)

**Companion to:** PMS-1.2-Architecture-Review.md (executive report)
**Coverage statement:** The source file contains Chapters 11–50 — 39 unique chapters (Chapter 12 is duplicated verbatim; Chapter 13 does not exist; Chapters 1–10 belong to Volume 0, the Design System specification). Every chapter present in the file is reviewed below against the full 20-criteria framework:
(1) missing architectural concepts, (2) weak decisions, (3) missing enterprise best practices, (4) scalability issues, (5) security concerns, (6) future limitations, (7) missing diagrams, (8) missing business rules, (9) missing technical standards, (10) missing operational processes, (11) missing governance, (12) missing engineering standards, (13) missing monitoring, (14) missing observability, (15) missing automation, (16) missing AI opportunities, (17) missing integrations, (18) missing APIs, (19) missing deployment considerations, (20) missing documentation requirements.

Where a criterion genuinely produces no material finding for a chapter, it says so in one line rather than inventing filler — an empty checkbox filled with noise is worse than an honest "no finding."

---

## Chapter 11 — Frontend Architecture

**Scores & deduction rationale:**
- Architecture 6/10 — sound layering (pages orchestrate, components render, hooks/services own logic), but the two most consequential runtime decisions (server-state manager, route-level data loading) are unmade.
- Enterprise Readiness 5/10 — 11.23 promises "multiple teams" with zero multi-team mechanics (ownership, boundaries, monorepo).
- Scalability 5/10 — "100+ pages, 1000+ components" claimed; no mechanism scales a flat feature-folder convention to that size.
- Maintainability 7/10 — size limits, naming conventions, import order, no-hardcoded-colors rules are genuinely good and enforceable.
- Security 5/10 — no CSP, no XSS/sanitization standard, no supply-chain policy.
- Cloud Readiness 6/10 — SPA is host-agnostic; asset/CDN strategy deferred to Ch 42.
- Future Proof 5/10 — i18n and plugin-UI extension points absent; both are expensive retrofits.
- Overall 5.5/10.

**(1) Missing architectural concepts.** Server-state management (TanStack Query / SWR / RTK Query) — required by Ch 21.73's optimistic updates and Ch 18.13's request dedup/caching, absent here. Route-level data loading strategy (React Router loaders vs component-level fetch). Error boundary hierarchy (app / route / widget). Suspense and loading-state conventions. A component workbench (Storybook) as the contract between Volume 0 and code.
**(2) Weak decisions.** "Contexts store global state" without evaluating dedicated stores (Zustand/Jotai) for cross-feature UI state — Context re-render behavior is the exact problem 18.9 later warns about; the two chapters are in quiet tension. Styling "Tailwind + CSS variables" is fine, but the token pipeline (who generates variables from Volume 0 tokens, how are they versioned) is unowned.
**(3) Missing enterprise best practices.** Module-boundary enforcement (eslint-plugin-boundaries / Nx enforce-module-boundaries); dependency-update automation (Renovate) with review policy; dead-code and duplicate-dependency detection in CI; bundle-size budgets wired to CI (18.24 names budgets, nothing enforces them here).
**(4) Scalability issues.** Multiple teams in one Vite SPA: no position on monorepo tooling (pnpm workspaces/Nx/Turborepo), no code-ownership map, no micro-frontend / module-federation stance for the Ch 46 plugin UI requirement. Build times and TS project references at 1000+ components — unaddressed.
**(5) Security concerns.** Rich text is promised (21.49) with no sanitization standard (DOMPurify-class) — stored XSS via guest notes is the concrete attack. No Content-Security-Policy requirement. No npm supply-chain policy (lockfile audit, provenance). Token storage decision deferred (see Ch 15) but frontend chapter must state "no tokens in localStorage."
**(6) Future limitations.** White-label (11.23) needs multi-brand token theming beyond dark/light — mechanism unspecified. Plugin system (Ch 46.10) needs stable UI extension points (slot/portal registry) — nothing here reserves them; retrofitting extension points into 100+ pages is a rewrite-class effort.
**(7) Missing diagrams.** Component-layer diagram (primitive → business → page); dependency-rule diagram for the folder structure; data-flow sequence (user action → hook → service → API → cache update).
**(8) Missing business rules.** None — correctly none; the chapter rightly forbids business logic in the frontend.
**(9) Missing technical standards.** TypeScript strictness profile (strict, noUncheckedIndexedAccess); path-alias convention; i18n key naming; datetime/money display formatting utilities as the only permitted formatters.
**(10) Missing operational processes.** Frontend release process: immutable hashed assets, atomic deploy, cache invalidation, rollback of a bad bundle; environment-config injection (build-time vs runtime config).
**(11) Missing governance.** Design-review gate against Volume 0; a11y sign-off per feature; who may add a dependency (dependency review board or lightweight ADR).
**(12) Missing engineering standards.** PR review checklist for frontend; component-API documentation convention (props docs); test colocation convention (unit tests live where?).
**(13) Missing monitoring.** Frontend error reporting (Sentry-class) with release tagging and source-map security; alerting on error-rate spikes per release.
**(14) Missing observability.** RUM (web-vitals field data) feeding 18.24 budgets; user-journey funnels for Ch 47 product analytics — no client instrumentation standard exists anywhere in the document.
**(15) Missing automation.** OpenAPI → TypeScript client/type codegen — the highest-leverage automation available to this stack (kills an entire class of contract bugs); visual-regression automation hook (Ch 44.16) not referenced.
**(16) Missing AI opportunities.** Low relevance at architecture level; optional: AI-assisted a11y linting in CI.
**(17) Missing integrations.** Analytics/product-telemetry SDK decision (ties Ch 47.14); feature-flag client SDK (ties 42.10/47.10).
**(18) Missing APIs.** BFF question: will mobile (Ch 43) and web share endpoints or need tailored aggregates? The service layer here silently assumes one API shape for all clients.
**(19) Missing deployment considerations.** CDN/cache-header strategy, preview deployments per PR, canary for frontend releases (Ch 44.21 covers backend-ish canary only).
**(20) Missing documentation requirements.** Frontend contribution guide; component catalog; "how to add a feature module" runbook for new developers (11.24 demands fast onboarding, provides no artifact).

---

## Chapter 12 — Backend Architecture

**Scores & deduction rationale:**
- Architecture 5/10 — correct layered skeleton, but missing the four load-bearing subsystems its own sibling chapters require (jobs, events/outbox, modular boundaries, DI).
- Enterprise Readiness 4/10 — Render + single monolith + no module boundaries is pre-enterprise; acceptable only as declared Stage 1, which it never declares.
- Scalability 4/10 — nothing here scales horizontally: no statelessness statement, no session externalization, no queue.
- Maintainability 6/10 — thin controllers / fat services is maintainable if module boundaries exist; they don't.
- Security 5/10 — right slogans (never trust input, protect against OWASP list) with zero mechanisms (no helmet/CSP, no rate-limit tech, no secrets).
- Cloud Readiness 3/10 — contradicts Ch 42 wholesale; no containers, no health checks, no 12-factor config.
- Future Proof 4/10 — 12.20's list (plugins, public API, AI, channel manager) is unachievable on this chapter's skeleton without the missing subsystems.
- Overall 4.5/10.

**(1) Missing architectural concepts.** Transactional outbox (audit + notifications + sync jobs written atomically with business changes); background job runner (pg-boss/BullMQ) — Chapters 18.20, 26.44, 30.13, 32.10, 33 all presuppose one; domain events; modular-monolith module map with enforced boundaries; repository interfaces (as written, "Repository / Prisma" is one layer — Prisma types will leak into services and make the Ch 50.11 evolution to services 10× harder); dependency injection convention.
**(2) Weak decisions.** SQLite in development — dev/prod parity violation precisely where double-booking concurrency lives; Express without a structure framework (NestJS or an explicitly specified in-house convention) for a system this large is a decision that needs an ADR, not a line item; "business logic must never be implemented using SQL" is half-wrong — *invariants* (uniqueness, non-overlap) MUST live in the database as constraints; only *policy* belongs in services. As written, this sentence forbids the exclusion constraint that prevents double-booking.
**(3) Missing enterprise best practices.** 12-factor config; graceful shutdown (drain requests, finish jobs); health/readiness/liveness endpoints; request-scoped context (requestId, tenantId, userId) propagated through all layers; API-layer and service-layer timeouts.
**(4) Scalability issues.** No statement that the app is stateless (required for >1 instance); no connection pooling plan (PgBouncer; Prisma's pool behavior under many instances); no cache tier (Redis is "future" in 18.19 while rate limiting in 12.19/14.18 needs shared state on day one — an internal contradiction).
**(5) Security concerns.** CSRF named but the mitigation depends on the unmade token-storage decision (Ch 15); no security-header middleware standard; no input-size limits/payload caps; no dependency scanning here (only in Ch 42 CI); secrets management absent (first appears Ch 42.12); "never expose internal IDs unnecessarily" — then specify the public identifier standard (UUIDv7/ULID) once, globally.
**(6) Future limitations.** Without module boundaries and events, extracting Ch 50.11's "Domain Services" later means untangling a shared Prisma schema — the classic monolith death. The chapter forecloses its own evolution plan.
**(7) Missing diagrams.** C4 container diagram; module map with allowed dependencies; sequence diagram for one write path (request → validation → service → transaction → outbox → response).
**(8) Missing business rules.** The enforcement locus rule: which invariants live in DB constraints vs service code — the most important sentence the chapter never writes.
**(9) Missing technical standards.** Migration discipline (expand/contract, no destructive migration with deploy); transaction isolation-level policy per operation class; UUID/ID standard; error-to-HTTP mapping table.
**(10) Missing operational processes.** Deployment runbook, rollback procedure incl. schema, log rotation/shipping on Render, backup ownership (Render's? yours? — Ch 45 assumes capabilities Render may not give you).
**(11) Missing governance.** ADR practice for backend decisions; module ownership; who may alter the Prisma schema (schema review gate).
**(12) Missing engineering standards.** Service/controller naming and file layout, test conventions per layer, lint/format config as law.
**(13) Missing monitoring.** Process metrics (event-loop lag — the Node-specific killer), DB pool saturation, HTTP RED metrics; none named here (Ch 42 is generic).
**(14) Missing observability.** OpenTelemetry SDK adoption in *this* stack (Ch 42.23 names OTel; nobody wires it to Express/Prisma); trace context through jobs.
**(15) Missing automation.** Schema-drift detection; seed-data automation for dev; API-client generation (pairs with Ch 11 finding 15).
**(16) Missing AI opportunities.** None material at this layer.
**(17) Missing integrations.** None here beyond what sibling chapters own — correct scoping.
**(18) Missing APIs.** Internal admin/ops API surface (feature flags, tenant ops) — assumed by Chs 42/48/49, never allocated to any module.
**(19) Missing deployment considerations.** The entire bridge to Ch 42 (containerization of this app, env promotion). "Render" appears once with no capacity, cost, or exit criteria.
**(20) Missing documentation requirements.** Backend developer guide; "add an endpoint end-to-end" tutorial; Prisma schema documentation convention.

---

## Chapter 14 — API Standards

**Scores & deduction rationale:**
- Architecture 6/10 — capability-oriented REST with consistent envelopes is right; concurrency and idempotency mechanics missing.
- Enterprise Readiness 6/10 — versioning + consistent errors are enterprise table stakes, present; registry/contract tooling absent.
- Scalability 5/10 — offset pagination as the platform default is a known scale cliff.
- Maintainability 7/10 — uniform conventions are the chapter's strength.
- Security 6/10 — auth/authz/rate-limit placement is right; header standards and abuse cases thin.
- Cloud Readiness 6/10; Future Proof 6/10 — 14.23's expansion list is supportable if the Ch 37 machinery (OpenAPI, idempotency) is backported to v1.
- Overall 6/10.

**(1) Missing architectural concepts.** Optimistic-concurrency standard (ETag/If-Match or version field) — Ch 21.72 requires it, no API mechanism exists; idempotency mechanics (header, storage, TTL, replay); bulk/batch endpoints with partial-failure semantics; async-operation pattern (202 + operation resource) for exports/reports.
**(2) Weak decisions.** `page/limit` offset pagination as default (deep-offset O(n), phantom items under writes — switch default to cursor for all collections that grow unboundedly); `include=` expansion without depth/cost limits invites accidental N+1 amplification and payload bombs — cap expansion depth and enumerate allowed includes per resource.
**(3) Missing enterprise best practices.** OpenAPI as source of truth for the internal API too (Ch 37 grants it only to the public API); contract linting (Spectral) + breaking-change diff in CI; API style guide with examples as executable docs.
**(4) Scalability issues.** No response-size caps; no compression standard; no cache-control conventions per endpoint class (14.22 says "cache-friendly when possible" — define it: which GETs carry ETags/max-age).
**(5) Security concerns.** No standard security headers; no request-ID header requirement; rate-limit responses lack header spec (X-RateLimit-*/Retry-After); no anti-enumeration guidance for sequential IDs in URLs (ties to Ch 12 ID standard).
**(6) Future limitations.** Response envelope `{success,data,...}` conflicts with future GraphQL/standard tooling; adopting RFC 9457 problem+json for errors now would spare a breaking migration later.
**(7) Missing diagrams.** Request lifecycle (middleware pipeline) diagram; pagination/cursor semantics diagram.
**(8) Missing business rules.** Search semantics (14.11): case folding, partial match rules, ranking — "predictable" requires definition.
**(9) Missing technical standards.** ISO-8601 UTC datetime; money as integer minor units + ISO-4217 code; enum casing; null-vs-absent field semantics for PATCH (JSON Merge Patch? define it).
**(10) Missing operational processes.** Endpoint deprecation workflow for internal consumers (37.27 covers public only).
**(11) Missing governance.** Error-code registry ownership; API review gate for new endpoints.
**(12) Missing engineering standards.** Endpoint test template (auth/authz/validation/happy/error paths) — Ch 44.6 lists categories, no template.
**(13) Missing monitoring.** Per-endpoint RED metrics named as a requirement of the standard.
**(14) Missing observability.** Correlation-ID propagation requirement (client-supplied vs server-issued precedence).
**(15) Missing automation.** SDK/type generation from the spec; mock-server generation for frontend development.
**(16) Missing AI opportunities.** Not material.
**(17) Missing integrations.** None — Ch 37/38 own them; correct.
**(18) Missing APIs.** Webhook conventions cross-reference (37.16) so internal and public event payloads share one schema family.
**(19) Missing deployment considerations.** Version routing strategy (path-based /v1 chosen — fine; state how v1/v2 coexist in one deployment).
**(20) Missing documentation requirements.** The API changelog exists for public (37.27); internal API changes need the same discipline — say so.

---

## Chapter 15 — Authentication & Authorization

**Scores & deduction rationale:**
- Architecture 6/10 — clean authN/authZ separation, middleware layering, scope model; the JWT/session contradiction is a structural flaw.
- Enterprise Readiness 5/10 — MFA and SSO "future" blocks enterprise procurement checklists.
- Scalability 6/10 — stateless JWT scales; the moment revocation is honored, the missing session store becomes the bottleneck design.
- Maintainability 6/10. Security 5/10 — the two unmade decisions (revocation, token storage) are the two most attacked seams. Cloud 6/10. Future Proof 6/10 — 15.21's list is fine *if* an IdP-abstraction seam is put in now.
- Overall 5.5/10.

**(1) Missing architectural concepts.** Server-side session/refresh-token store with rotation + reuse detection; identity-provider abstraction layer (so Google/SSO/LDAP in 15.21 don't each fork the login flow); step-up authentication concept for sensitive actions (refund approval should be able to demand re-auth/MFA even mid-session — pairs with 29.25).
**(2) Weak decisions.** Password complexity rules (15.5) over length+breach-check: NIST 800-63B recommends length + compromised-password screening over composition rules; bcrypt not wrong, argon2id preferred — either way, record cost parameters. "Refresh strategy (future)" — refresh tokens are v1, not future, once sessions must expire and be revocable.
**(3) Missing enterprise best practices.** Account lockout with progressive backoff (numbers); credential-stuffing defense (IP + identifier throttling, optional CAPTCHA escalation); password-reset token entropy/TTL/one-time semantics quantified; session-fixation prevention on privilege change.
**(4) Scalability issues.** Permission data in JWT (2001–2013 lists role, permissions, branch/hotel access in "session") — tokens bloat and go stale; the standard answer (identity in token, permissions resolved server-side per request with cache) must be stated.
**(5) Security concerns.** Token storage unspecified (decide: httpOnly+Secure+SameSite cookies + CSRF token); logout-everywhere impossible without the store; audit of *permission-denied* events is listed (good) — add alerting threshold on bursts (attack signal).
**(6) Future limitations.** No tenant-aware login routing (same email in two organizations — Ch 48 multi-tenancy will force an account-model decision: global identity + org membership vs per-org accounts; deciding late breaks login UX).
**(7) Missing diagrams.** Sequence diagrams: login (+MFA), refresh rotation with reuse-detection branch, logout-everywhere, password reset.
**(8) Missing business rules.** Concurrent-session policy (allowed? limited per role?); shift-bound sessions for reception roles (auto-logout at shift close — an operational security rule a PMS should state).
**(9) Missing technical standards.** JWT claims schema (registered + custom claims, issuer/audience), key rotation for signing keys (JWKS), token TTL numbers.
**(10) Missing operational processes.** Compromised-account response runbook; forced global logout procedure; auth-provider outage degraded mode.
**(11) Missing governance.** Who may create System Administrator accounts; joiner-mover-leaver process hooks (HR-driven deprovisioning — enterprise buyers ask).
**(12) Missing engineering standards.** Auth code isolation (one module, security-reviewed changes only).
**(13) Missing monitoring.** Login success/failure rates, MFA failure rates, token-refresh anomalies — named metrics with alerts.
**(14) Missing observability.** Auth decisions in traces (authorized-by-which-rule) for debugging permission issues.
**(15) Missing automation.** Secrets/signing-key rotation automation; stale-account auto-suspension.
**(16) Missing AI opportunities.** Risk scoring is already planned in 41.23 — cross-reference instead of duplicating.
**(17) Missing integrations.** SCIM for enterprise user provisioning — never mentioned in the whole document; SSO buyers expect it.
**(18) Missing APIs.** Session-management API (list/terminate) is implied by 29.19 — allocate it here.
**(19) Missing deployment considerations.** Cookie domain strategy across white-label custom domains (48.17) — cookies + arbitrary customer domains is a real design constraint; unaddressed.
**(20) Missing documentation requirements.** Security section of the developer guide; auth flows in the public API docs (37.20 will need them).

---

## Chapter 16 — Error Handling & Business Exceptions

**Scores & deduction rationale:** Architecture 6/10; Enterprise 6/10; Scalability 6/10; Maintainability 7/10 (taxonomy is clean and teachable); Security 7/10 (no-stack-trace, generic-on-unexpected are right); Cloud 6/10; Future Proof 6/10; Overall 6/10. Deductions concentrate on missing resilience machinery and the unowned error-code catalog.

**(1) Missing architectural concepts.** Resilience patterns: timeouts (mandatory on every external call), circuit breakers, bulkheads — absent document-wide; compensation/saga model for multi-step flows spanning external systems (payment auth → local failure → void); dead-letter concept for failed async work (only Ch 38.22 mentions DLQ — it belongs in the base error architecture).
**(2) Weak decisions.** None serious — 16.17's prohibition of auto-retry for dangerous operations is one of the best decisions in the document. Sharpen it by *defining* idempotent-safe vs unsafe operation classes so the rule is checkable.
**(3) Missing enterprise best practices.** RFC 9457 problem+json; error budgets linking error rates to SLOs (Ch 42.25 vocabulary, never connected); user-facing error copy review process (UX writing governance).
**(4) Scalability issues.** Error storms: one DB outage → thousands of identical errors → logging/alerting overload; needs aggregation/sampling and circuit-breaking, unmentioned.
**(5) Security concerns.** Error responses as oracle (404 vs 403 policy to avoid resource-existence leaks across tenants — with Ch 48 multi-tenancy this is a real cross-tenant enumeration channel; specify "404 for unauthorized-and-not-found alike" or equivalent).
**(6) Future limitations.** traceId is "optional" in 16.13 — make it mandatory; every future support workflow (Ch 49) keys on it.
**(7) Missing diagrams.** Error-handling decision tree (category → response → log → alert); saga/compensation sequence for booking-payment.
**(8) Missing business rules.** Which business violations are retriable-after-user-fix vs terminal; conflict-resolution options per conflict type (16.9 promises "recovery options" — enumerate them).
**(9) Missing technical standards.** The error-code registry format (namespacing per module, stability guarantees, deprecation).
**(10) Missing operational processes.** Error-triage workflow (new error code appears in prod → who owns it); user-impact assessment procedure.
**(11) Missing governance.** Registry ownership; approval for new user-facing error messages (i18n + tone).
**(12) Missing engineering standards.** Exception class hierarchy for the backend (BusinessError/ValidationError/... with code binding) — implied, never specified.
**(13) Missing monitoring.** Alert thresholds per category (auth-error spike = attack; infra-error spike = outage; business-error spike = possible UX bug).
**(14) Missing observability.** Error events linked to traces and releases (which deploy introduced code X).
**(15) Missing automation.** Auto-created issues for novel error codes; regression detection (error rate per code per release).
**(16) Missing AI opportunities.** Error-log clustering/summarization for on-call — cheap, real win.
**(17–18) Missing integrations/APIs.** Status-page integration (49.21) triggered from infra-error classes.
**(19) Missing deployment considerations.** Rollback triggers tied to error-rate gates (44.28 monitors; nothing states auto-rollback thresholds).
**(20) Missing documentation requirements.** Public error-code reference for API consumers (37.14 links "Documentation Link" — the target document is never commissioned).

---

## Chapter 17 — Logging & Audit Architecture

**Scores & deduction rationale:** Architecture 6/10 (correct log/audit separation — many real systems get this wrong); Enterprise 6/10; Scalability 5/10 (no volume strategy); Maintainability 6/10; Security 5/10 (immutability unmechanized; GDPR unreconciled); Cloud 5/10 (no tooling); Future Proof 6/10; Overall 5.5/10.

**(1) Missing architectural concepts.** Audit-write mechanism: same-transaction append-only insert (audit is a business record; async audit = lossy audit); immutability mechanism (revoked UPDATE/DELETE grants at minimum; hash-chaining or WORM export for high assurance); log pipeline architecture (stdout → collector → store) — no components named.
**(2) Weak decisions.** 17.9 "Nothing should be omitted" — storing full old/new values for every entity conflicts with data minimization; store diffs for large entities and reference-not-copy for documents.
**(3) Missing enterprise best practices.** Retention numbers (the words "limited/long-term/maximum" are not a policy — write 30d/1y/7y or whatever legal requires); log schema versioning; PII-masking implementation standard (field allowlist, not regex hope).
**(4) Scalability issues.** Audit volume: an active hotel produces millions of audit rows/year; partitioning strategy (by month/tenant), archive tiering (24.23 archiving exists for business data; audit needs the same), and search index strategy — all absent.
**(5) Security concerns.** GDPR erasure vs permanent audit — the collision must be resolved *here* (crypto-shredding or PII tokenization in audit payloads); access control for audit reads (who can see whose actions — auditors' audit trail, i.e., audit-of-audit-access); log injection (user-supplied strings in structured logs — escape/encode standard).
**(6) Future limitations.** 17.21 promises microservices-ready logging without the prerequisite: trace-context standard (W3C traceparent) — name it now.
**(7) Missing diagrams.** Log/audit pipeline diagram; audit-record lifecycle (write → retain → archive → legal hold).
**(8) Missing business rules.** Legal hold (litigation freeze overriding retention) — enterprise requirement, absent; which actions require a mandatory "reason" field (17.9 marks reason optional — for deletions/overrides it must be mandatory, cf. 22.64 where it *is* mandatory: inconsistency between chapters).
**(9) Missing technical standards.** Log schema (JSON field names/types), clock discipline (NTP, monotonic timestamps), timezone (UTC everywhere in logs).
**(10) Missing operational processes.** Log-storage cost management; audit-export procedure for external auditors; retention-policy execution verification.
**(11) Missing governance.** Data owner for audit; who approves retention changes; auditor access grants workflow.
**(12) Missing engineering standards.** Logger usage rules (no console.log, no PII in message strings, level guidance with examples).
**(13) Missing monitoring.** Meta-monitoring: alert when audit writes fail or log pipeline lags (silent audit loss is the worst failure mode this chapter can have).
**(14) Missing observability.** Logs↔traces↔metrics correlation (exemplars) — Ch 42.21 names three pillars; nothing joins them.
**(15) Missing automation.** Automated PII-leak scanning of log samples; retention-job automation with attestation.
**(16) Missing AI opportunities.** Owner-facing natural-language audit summaries ("what happened in my hotel yesterday") — high product value, feeds from 17.19/17.20.
**(17–18) Missing integrations/APIs.** SIEM forwarding (41.24) — cross-reference; audit query API for Ch 37 (resource "Audit Logs" is listed in 37.7 — the contract, filtering, and authz for it are never designed).
**(19) Missing deployment considerations.** Log shipping on Stage-1 infra (Render) vs Stage-3 (K8s DaemonSets) — per-stage reality absent.
**(20) Missing documentation requirements.** Logging handbook page in the developer guide; audit-event catalog (the 17.8 list, maintained as a governed enum).

---

## Chapter 18 — Performance Architecture

**Scores & deduction rationale:** Architecture 6/10; Enterprise 5/10 (no numbers = no accountability); Scalability 6/10 (targets in 18.25 are quantified — credit — but no path to them); Maintainability 7/10 ("only where measurable" anti-premature-optimization stance is healthy); Security n/a; Cloud 6/10; Future Proof 6/10; Overall 6/10.

**(1) Missing architectural concepts.** Read-model strategy for hot aggregates (dashboard KPIs, availability search) — materialized views / event-refreshed projections; connection pooling (PgBouncer); load model (concurrent users per hotel, peak hour patterns like checkout rush and New Year) — capacity planning is impossible without it.
**(2) Weak decisions.** None wrong per se; the chapter's weakness is that every rule is unmeasurable as written (18.24 budget fields empty).
**(3) Missing enterprise best practices.** Performance budgets enforced in CI (Lighthouse CI, bundle-size gates, k6 thresholds); `EXPLAIN` review gate for new queries touching hot tables; index standards for date-range queries (GiST on ranges) — the single most PMS-specific index guidance, absent.
**(4) Scalability issues.** No read-replica policy; no cache-invalidation design (18.19 lists cache tiers, never how invalidation stays correct — and its own rule "caching must never compromise correctness" demands exactly that design); N+1 "avoidance" needs tooling (Prisma query logging + CI assertion), not exhortation.
**(5) Security concerns.** Resource-exhaustion abuse (expensive report queries as DoS) — per-tenant query quotas, statement timeouts; unmentioned.
**(6) Future limitations.** 18.25 scale targets (millions of reservations) with offset pagination (Ch 14) and no partitioning strategy — the numbers and the mechanics don't meet.
**(7) Missing diagrams.** Data-flow with cache layers; hot-path sequence (availability check) with latency budget per hop.
**(8) Missing business rules.** Freshness SLAs: which numbers may be N seconds stale (dashboard) vs must be transactional (availability at confirm) — a business decision the chapter should force.
**(9) Missing technical standards.** P95/P99 targets per endpoint class; Core Web Vitals numeric targets; slow-query threshold (e.g., log >100ms, page >1s).
**(10) Missing operational processes.** Performance-regression triage; load-test cadence (pre-release? weekly?) — Ch 44.11 defines tests, no schedule.
**(11) Missing governance.** Budget ownership (who signs off a budget increase).
**(12) Missing engineering standards.** Profiling toolkit standard; perf-test authoring conventions (k6 scripts colocated with modules).
**(13) Missing monitoring.** APM decision; DB pool/replication-lag/event-loop-lag alerts.
**(14) Missing observability.** RUM field data (pairs with Ch 11.14 finding); trace-based latency attribution.
**(15) Missing automation.** Automated bundle-diff comments on PRs; nightly perf runs against a fixed dataset.
**(16) Missing AI opportunities.** Anomaly detection on latency series — Ch 39.18 covers business anomalies; extend scope to perf.
**(17–18) Missing integrations/APIs.** None material.
**(19) Missing deployment considerations.** Warmup/cold-start behavior after deploys (empty caches → latency spike → false alerts); pre-warming or gradual traffic shift.
**(20) Missing documentation requirements.** The filled-in performance budget sheet as a versioned artifact; capacity-planning doc (see Missing Documents #20 in the main report).

---

## Chapter 19 — Accessibility Architecture

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10; Maintainability 7/10; Future Proof 7/10; Overall 7/10 — the most complete quality-attribute chapter in the document. Deductions are about verification and legal pinning, not intent.

**(1) Missing architectural concepts.** Live-region strategy for the real-time surfaces (calendar live updates, activity feed, toasts — Ch 20/21 update continuously; screen-reader users need a coherent announcement policy or the app becomes noise); focus management for the drawer-centric workflow (21.41) is covered — credit.
**(2) Weak decisions.** None. The color+icon+text rule (19.9) and charts-never-sole-source (19.15) are exemplary.
**(3) Missing enterprise best practices.** Pin the standard: WCAG 2.2 AA (EU EAA enforcement is live since June 2025 — a hotel-facing SaaS selling into the EU has legal exposure); accessibility conformance report (ACR/VPAT) as a sales artifact; a11y acceptance criteria in the story template (Ch 47.8).
**(4) Scalability issues.** Not applicable, honestly.
**(5) Security concerns.** Not applicable.
**(6) Future limitations.** RTL "should remain possible" (19.17) is too weak given Arabic is explicitly listed in 31.22/32.9 — RTL must be a tested requirement, or the booking engine cannot serve a listed market.
**(7) Missing diagrams.** Focus-order maps for the three complex surfaces (calendar grid, drawer, wizard).
**(8) Missing business rules.** Keyboard-shortcut collision policy (21.55 shortcuts vs screen-reader/browser bindings).
**(9) Missing technical standards.** ARIA pattern sources (WAI-ARIA APG components); minimum touch-target size in px (19.12 says "comfortable" — write 44×44).
**(10) Missing operational processes.** Audit cadence (internal quarterly + external annual); user testing with assistive-tech users.
**(11) Missing governance.** A11y sign-off role per release; exception process with expiry for known issues.
**(12) Missing engineering standards.** axe-core in CI with zero-new-violations gate; a11y unit-test conventions (testing-library queries by role).
**(13–14) Missing monitoring/observability.** A11y regression tracking per release (violation counts as a quality metric in 44.26's dashboard).
**(15) Missing automation.** Automated contrast checking of the token palette whenever Volume 0 tokens change — cheap and prevents whole-theme regressions.
**(16) Missing AI opportunities.** AI-generated alt-text suggestions for uploaded room photos (Ch 24.10/31.8) — real product value.
**(17–19) Missing integrations/APIs/deployment.** None material.
**(20) Missing documentation requirements.** Accessibility statement (public); a11y section in the component catalog documenting each component's keyboard contract.

---

## Chapter 20 — Dashboard Specification

**Scores & deduction rationale:** Architecture 6/10 (excellent product spec, missing its data-supply half); Enterprise 6/10; Scalability 5/10 (live KPIs from OLTP won't survive scale); Maintainability 6/10; Security 5/10 (permission scoping of widgets unstated); Cloud 6/10; Future Proof 6/10; Overall 6/10.

**(1) Missing architectural concepts.** The aggregation layer: every KPI (revenue today, occupancy, ADR) needs a defined source — transactional query, materialized view, or pre-aggregated projection refreshed by events — with a freshness SLA per widget. The chapter specifies pixels, not plumbing. Also missing: the real-time transport (shared gap with Ch 21.70) and a widget-data contract (one endpoint per widget vs a dashboard-composition endpoint — chatty vs chunky decision).
**(2) Weak decisions.** "Compared with yesterday" (20.5) as the hero comparison — hotel businesses compare same-day-last-week and same-date-last-year (seasonality); yesterday is often noise. Make comparison basis configurable.
**(3) Missing enterprise best practices.** Skeleton-vs-spinner loading policy exists implicitly (20.18) — good; missing: stale-while-revalidate display convention (show last numbers greyed while refreshing) so the five-second rule survives slow networks.
**(4) Scalability issues.** Global dashboard aggregation across 100 hotels (28.8 reuses this) cannot be N live queries; requires the Ch 40 read platform or pre-aggregation — dependency unmarked.
**(5) Security concerns.** Widget-level permission filtering (cashier must not see org revenue; administrator-performance leaderboard 20.12 exposes colleague metrics — role-gate it); dashboard export/share leaks (27.31) — classification unaddressed.
**(6) Future limitations.** 20.24 future widgets (weather, channel status) imply third-party calls from the dashboard path — needs the resilience patterns from Ch 16 findings or the dashboard inherits every vendor's downtime.
**(7) Missing diagrams.** Dashboard data-flow (event → aggregate → cache → widget); layout grid spec (12-col named; breakpoints tie to Volume 0 — cross-reference absent).
**(8) Missing business rules.** "Today" = hotel business date, not calendar/browser date (interlocks with the Night Audit gap, Ch 22): revenue "today" before the date roll must be defined; occupancy definition (include OOO rooms? day-use?) — pulls the KPI-dictionary need forward.
**(9) Missing technical standards.** Number formatting (locale, currency display, rounding for display vs storage); trend-arrow semantics (what % change flips color).
**(10) Missing operational processes.** KPI-discrepancy runbook ("dashboard says X, report says Y" is the #1 owner support ticket — 22.78 promises they always match; the *process* when they don't is what support needs).
**(11) Missing governance.** KPI definition ownership (the Ch 27/40 dictionary — this chapter is its biggest consumer).
**(12) Missing engineering standards.** Widget component contract (props: data, loading, error, empty, permissions) so 20.18's five states are enforced by type, not by review.
**(13) Missing monitoring.** Dashboard render-time RUM against the 1-second target (20.21) — target exists, measurement doesn't.
**(14) Missing observability.** Widget-level error tracking (one failing widget must not gray out the page — bulkhead per widget).
**(15) Missing automation.** Scheduled snapshot of daily KPIs (feeds 26.44/27.28 and gives owners a consistent morning number regardless of later edits).
**(16) Missing AI opportunities.** 20.24 lists AI Recommendations — cross-link to 39.16 so two teams don't build two insight widgets.
**(17) Missing integrations.** None beyond future widgets.
**(18) Missing APIs.** Dashboard composition API design (batching, partial responses).
**(19) Missing deployment considerations.** Feature-flag the hero/new widgets (42.10) for safe iteration.
**(20) Missing documentation requirements.** Widget catalog with data-source and freshness annotation per widget.

---

## Chapter 21 — Calendar Engine (Parts 1–4)

**Scores & deduction rationale:** Architecture 7/10 (the strongest engineering chapter: virtualization, optimistic updates, progressive loading, concurrency awareness); Enterprise 6/10; Scalability 6/10 (targets quantified in 21.62 — credit — mechanics for live sync absent); Maintainability 6/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 6.5/10.

**(1) Missing architectural concepts.** Real-time transport decision (WebSocket vs SSE) + connection auth + reconnect/backfill protocol ("what changed since cursor X" — requires server-side event log or versioned snapshots); client-side data-store design for the grid (normalized reservation cache keyed by room×date-range — the data structure that makes 21.63–65 possible is never sketched); delayed-rejection UX for optimistic updates (server veto arrives 800ms after the user saw "success" — what does the interface do? 21.73 says "rollback gracefully": define the animation + toast + refocus contract).
**(2) Weak decisions.** 21.52 auto-save on inline edit conflicts with 21.56 unsaved-changes prompts — two persistence models in one drawer; pick per-field auto-save with undo (recommended) or explicit save, not both. 21.37 auto-save on drag is right *only* with instant server validation — bind them explicitly.
**(3) Missing enterprise best practices.** Field-level conflict policy for 21.72 (merge semantics per field class: dates conflict = block; notes conflict = merge both; payment conflict = impossible by design since payments are append-only — say this); undo (21.35) must revalidate like any mutation and may fail — specify the failed-undo UX.
**(4) Scalability issues.** Numbers exist (10k rooms, 1M reservations) but per-fetch window limits, max concurrent WS connections per instance, and event fan-out (one hotel's update → N connected receptionists) need a pub/sub tier the backend chapter lacks; date-range query indexing (GiST) is the enabling DB work — cross-dependency on the missing Ch 13.
**(5) Security concerns.** WS/SSE channel authorization per hotel/branch (a receptionist must not subscribe to another branch's stream); hover preview (21.15) leaks guest phone/balance — apply 29-permission filtering to preview payloads, not just pages.
**(6) Future limitations.** Multi-day/multi-room bulk operations (block a floor for renovation) — the direct-manipulation model covers single reservations only; adding marquee-select later touches every interaction handler.
**(7) Missing diagrams.** Drag-validation state machine (valid/conflict/maintenance/blocked/cleaning/VIP — 21.28 lists states; the transitions and precedence need a diagram); sync sequence (optimistic apply → server verdict → commit/rollback); virtualization window diagram.
**(8) Missing business rules.** Drag permission granularity (who may move a checked-in guest? cross-branch drag rules — 21.31 hints "alternative branch (future)"); timezone: a calendar column is a hotel-local business date (interlocks Ch 48.10 finding); resize past today's business date (extending a checked-out reservation must be blocked).
**(9) Missing technical standards.** Frame budget (16ms) per interaction class; event payload schema for live updates (versioned).
**(10) Missing operational processes.** Degraded mode: live-updates outage → visible staleness indicator + manual refresh (21.78 covers client network loss; server-side event-pipeline loss is different and unhandled).
**(11) Missing governance.** None material beyond the shared KPI/permission governance.
**(12) Missing engineering standards.** Performance test harness for the grid (scripted 500-room scroll/drag in CI — 21.79 lists metrics; no harness).
**(13) Missing monitoring.** The 21.79 metrics (scroll FPS, drag FPS, render time) need a RUM sink and alert thresholds — measurement infrastructure unnamed.
**(14) Missing observability.** Client event log for support ("what did the receptionist actually drag") — ties to audit; currently only the server mutation is audited, losing interaction context.
**(15) Missing automation.** None material.
**(16) Missing AI opportunities.** Smart suggestions (21.31) are rule-based — good; future ranking by guest preference (23.10) is a natural, cheap AI extension; note it to prevent a parallel build.
**(17) Missing integrations.** Housekeeping/maintenance overlays specified (25.30) — credit; door-lock status overlay (22.45 future) worth reserving a layer for.
**(18) Missing APIs.** The calendar data API (windowed fetch: rooms × date-range with delta support) is the most performance-critical endpoint in the product and is never specified as a contract.
**(19) Missing deployment considerations.** WS infrastructure on Stage-1 hosting (Render supports WS but with connection limits) — per-stage reality check absent.
**(20) Missing documentation requirements.** Interaction spec (drag thresholds, snap rules, keyboard equivalents) as the QA test basis for 44.7's E2E flows.

---

## Chapter 22 — Reservation Engine (Parts 1–4)

**Scores & deduction rationale:** Architecture 6/10 (complete workflow coverage; missing formal state machine, holds, night audit); Enterprise 6/10; Scalability 6/10; Maintainability 6/10; Security 6/10; Cloud 6/10; Future Proof 6/10; Overall 6/10.

**(1) Missing architectural concepts.** Formal state machine with transition matrix (states listed in 22.3; legal transitions, guards, permissions per transition — absent; note 22.3's lifecycle includes "In House" while 27.19's funnel omits it — the two chapters already disagree); **Night Audit** (business-date roll, auto room-charge posting for in-house guests, auto no-show marking, daily journal, day locking) — absent from the entire document and indispensable; inventory holds with TTL between wizard step 2 and confirmation; rate snapshot doctrine (per-night prices captured at booking; never silently recomputed on move/extend — 22.22/22.23 recalculate "automatically," 22.61 demands explainability: bind them with an explicit repricing-consent step).
**(2) Weak decisions.** Administrator as a *required* field (22.6) but reassignable (22.18) — define what administrator-attribution means for 20.12/27.9 performance metrics after reassignment (credit stays with creator? current owner?) — this will be disputed at the first bonus payout. Merge (22.29) "preserves all audit records" — define the surviving reservation-number rule and the fate of the other number (searchable alias).
**(3) Missing enterprise best practices.** Cancellation-policy engine in v1 (22.26 defers to future while cancellations/refunds/no-shows are v1 — with OTA connections, policy enforcement is contractual, not optional); duplicate-booking heuristics (same guest, overlapping dates, different channels — 30.19 detects cross-channel; do it natively too).
**(4) Scalability issues.** Availability check (22.9) "in real time" per keystroke of the wizard across large hotels — needs the availability read-model/cache design; group reservations (22.30) of 200 rooms = 200-row transactional writes — batch semantics and partial-failure policy undefined.
**(5) Security concerns.** Price override (22.64) is the highest-fraud-risk action in the product: pair with approval thresholds (29.25) — link exists in spirit, not in spec; walk-in with "guest details later" (22.31) vs jurisdictions requiring ID *before* key issuance — make the minimal-data rule configurable per legal regime.
**(6) Future limitations.** No allotments/contracts (tour operators holding N rooms) — a common hotel B2B model absent from the domain; day-use reservations (hourly) — the whole-day snap model (21.36) forecloses them; at least reserve the data-model possibility.
**(7) Missing diagrams.** The state machine diagram (the single most needed diagram in the document); wizard sequence with hold acquisition/release; split/merge object diagrams.
**(8) Missing business rules.** No-show timing (auto-marked at night audit? manual only?); reopen window (22.27 — how long after cancellation?); check-in date tolerance (early arrival before official check-in time — occupies the room from when?); max stay length; children/adults affecting price (occupancy-based pricing per person — common in the region — absent from the 22.62 price structure).
**(9) Missing technical standards.** Reservation-number format spec (22.12: "human-readable, unique, never changes" — define alphabet, length, collision strategy, per-hotel prefix); date semantics (arrival/departure as hotel-local dates; nights = departure − arrival).
**(10) Missing operational processes.** Overbooking response runbook (when it happens anyway — walk protocol: relocate guest, comp policy, record-keeping); reservation-data correction process after day-lock (links to the Ch 26 period-close gap).
**(11) Missing governance.** Who may change the required-fields set (22.6) — config governance per Ch 28.11 standardization.
**(12) Missing engineering standards.** One state-machine implementation (library or in-house) as the sole transition executor — no ad-hoc status writes anywhere; concurrency tests for create/move/extend as mandatory suite (cross-ref Ch 44 finding).
**(13) Missing monitoring.** Business-invariant monitors: overlapping-reservation detector (should find zero, alert if not — the safety net behind the DB constraint), negative-balance detector, stuck-state detector (Confirmed with arrival 3 days past).
**(14) Missing observability.** Funnel instrumentation for the wizard (drop-off per step) — 47.14 wants it; source instrumentation absent.
**(15) Missing automation.** Auto-release of expired holds; auto-no-show at night audit; auto-cancel unpaid pending reservations after policy deadline (pairs with 31.28 abandoned recovery).
**(16) Missing AI opportunities.** Room-assignment optimization (which physical room to assign to maximize future contiguous availability — a classic PMS optimization); 23.27 covers guest-preference suggestions — cross-link.
**(17) Missing integrations.** Government guest registration (22.59 lists it as future integration — in UZ/CIS it is a *day-one legal requirement* at check-in; move it to v1 scope with an abstraction per jurisdiction).
**(18) Missing APIs.** Reservation API contract (the Ch 37 resource) with the state machine exposed as legal-actions-per-state (HATEOAS-lite: "this reservation can: check-in, cancel") — prevents every client reimplementing transition rules.
**(19) Missing deployment considerations.** None beyond platform-wide.
**(20) Missing documentation requirements.** Reservation business-rules handbook (the transition matrix + pricing rules + policy engine) as the canonical training document for support (49.13) and QA.

---

## Chapter 23 — Guest CRM (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10; Enterprise 5/10; Scalability 6/10; Maintainability 6/10; **Security 4/10** — highest-sensitivity PII in the product with no privacy engineering; Cloud 6/10; Future Proof 6/10; Overall 5.5/10.

**(1) Missing architectural concepts.** Privacy engineering layer: lawful-basis map per field, retention schedule, anonymization pipeline (preserve financial records, strip identity), per-guest crypto-shredding keys; consent model (marketing 23.34/32.22, profiling 23.25–26, cross-hotel sharing 28.10); identity-resolution architecture for duplicate detection (sync-at-create vs async-batch, matching algorithm ownership).
**(2) Weak decisions.** "Guest history remains permanent" (23.3) as an absolute — directly violates GDPR Art. 17; replace with "retained per retention schedule; anonymized on erasure request." Guest reputation labels (23.26: "Problematic") are automated profiling with legal exposure (GDPR Art. 22) and defamation risk in shared-CRM contexts — require human confirmation, reason codes, and expiry.
**(3) Missing enterprise best practices.** Merge undo/tombstone (23.29 merge is irreversible as specified; false merges of two real people are certain at scale — 30-day unmerge window with pre-merge snapshots); blacklist due process (23.22 has reason/severity/expiry — good; add review cadence and guest-facing dispute path for compliance).
**(4) Scalability issues.** Duplicate detection (23.15) comparing "name similarity + DOB" across 250k guests per creation — needs indexed phonetic/trigram strategy, not naive scans; guest-value recalculation (23.25) "after every completed stay" — event-driven job, not synchronous.
**(5) Security concerns.** Field-level encryption for document numbers; document images (23.21) need storage security spec (private bucket, presigned URLs, virus scanning, EXIF stripping) — no file-storage architecture exists anywhere in the document (see Missing Documents); access logging for PII reads (who viewed this passport — read-audit, not just write-audit; 17.8 audits writes only).
**(6) Future limitations.** Cross-organization guest identity is (correctly) not shared — state it explicitly to prevent a future "global guest graph" feature from violating 48.4 isolation.
**(7) Missing diagrams.** Guest-data lifecycle (create → enrich → retain → anonymize); merge algorithm flow.
**(8) Missing business rules.** Minor guests (children's PII — parental linkage, no marketing ever); deceased-guest handling; blacklist scope (branch? hotel? organization?) — 23.22 doesn't say, and the answer has legal weight.
**(9) Missing technical standards.** Phone/email normalization (E.164; lowercase email) as dedup preconditions; name transliteration handling (Cyrillic/Latin double entries — the primary duplicate source in the CIS market — deserves explicit strategy).
**(10) Missing operational processes.** DSAR workflow (data subject access request: export within 30 days — 41.27 lists rights; the operational pipeline is missing); consent-withdrawal propagation (to Notification Center suppression lists).
**(11) Missing governance.** Data-protection ownership (DPO or equivalent); DPIA for scoring/reputation features before build.
**(12) Missing engineering standards.** PII-field annotation convention in the schema (drives masking, encryption, export tooling automatically — one annotation, four features).
**(13) Missing monitoring.** Mass-PII-read alerts (one user viewing 500 profiles/hour = exfiltration signal — ties 41.19 DLP).
**(14) Missing observability.** Dedup precision/recall metrics (false-merge rate as a quality KPI).
**(15) Missing automation.** Retention-schedule execution (auto-anonymize after N years of inactivity); document-expiry notifications (passport expiring — service opportunity + data hygiene).
**(16) Missing AI opportunities.** Dedup ranking (match-probability scoring) — the strongest near-term AI fit in the module; OCR ingestion of ID documents (39.23 exists — cross-link so CRM consumes it rather than rebuilding).
**(17) Missing integrations.** External CRM sync (38.12) field-mapping governance; loyalty platforms (23.13 future) — reserve the ledger link (points as ledger entries, not counters).
**(18) Missing APIs.** Guest API with PII-scoped field visibility per permission (37.7 lists the resource; the field-level authz contract is the hard part and is unwritten).
**(19) Missing deployment considerations.** Data-residency implications of guest data (48.20) — guest tables are the primary residency-constrained dataset; unlinked.
**(20) Missing documentation requirements.** Privacy notice content requirements (what hotels must show guests); PII-handling section of the developer guide.

---

## Chapter 24 — Room Management (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 6/10; Scalability 7/10; Maintainability 7/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 6.5/10.

**(1) Missing architectural concepts.** Two-axis status model: occupancy state (Vacant/Occupied/Reserved) × housekeeping state (Clean/Dirty/Inspected) are orthogonal — 24.7's single enum conflates them and contradicts 25.3's own lifecycle; **room-type-level inventory layer** (sellable counts per type per date) as the unit OTAs and the booking engine consume, with physical assignment as a separate concern — absent, and Ch 30/31 cannot be built correctly without it; OOO (out of order — removed from denominator) vs OOS (out of service — sellable, flagged) distinction, which changes occupancy/RevPAR math in Chs 26/27.
**(2) Weak decisions.** None fundamentally wrong; 24.8 "availability calculated automatically" is correct — it just needs the type-level layer above.
**(3) Missing enterprise best practices.** Effective-dated room attributes (room 101 was Standard until March, Deluxe after renovation — historical reports must use the attribute *as of the stay date*; without effective dating, every renovation corrupts history).
**(4) Scalability issues.** Virtual suite availability (24.23) is a constraint-propagation problem (booking combo blocks components and vice versa) — needs the same DB-level guarantee as double-booking; unspecified.
**(5) Security concerns.** QR codes (24.12) must be signed/opaque tokens, not guessable room IDs (a public QR that resolves to room data is an enumeration vector for 25.12 mobile flows).
**(6) Future limitations.** Non-room inventory (parking spots, conference rooms, spa slots — 26.23 already takes manual income for them) — the "room" model could generalize to "bookable resource units"; deciding now costs a naming choice, deciding later costs a migration.
**(7) Missing diagrams.** Two-axis status matrix; hierarchy ERD (hotel→branch→floor→zone→type→room + connected/virtual relations).
**(8) Missing business rules.** Reassignment of a Dirty room to an arriving guest (allowed with warning? forbidden?); smoking/pet violations recording (damage-fee linkage 22.69); block-vs-reservation precedence when both target the same cell.
**(9) Missing technical standards.** Room-number uniqueness scope (per branch? per building?); amenity taxonomy governance (28.26 standardization consumes it).
**(10) Missing operational processes.** Room onboarding/retirement procedure (new wing opens: bulk creation, type mapping, channel mapping — touches Chs 30/31/34).
**(11) Missing governance.** Who approves type changes (they cascade into pricing 34.5 and channel mapping 30.6 — cross-module change control needed).
**(12) Missing engineering standards.** Status transitions through the same single-executor pattern as reservations (24.25 says invalid transitions prevented — same state-machine engine, one implementation).
**(13) Missing monitoring.** Status-drift detector (room Occupied with no active reservation = data corruption signal — the invariant monitor pattern again).
**(14) Missing observability.** Room-status-change latency (checkout → housekeeping notified) as an ops metric for 25.2's promise.
**(15) Missing automation.** Auto-OOO on repeated maintenance failures (24.21 lists it as future — cheap rule, promote to v1).
**(16) Missing AI opportunities.** None material beyond 22's assignment optimization.
**(17) Missing integrations.** Door-lock/IoT (24.33) — reserve the abstraction interface (lock-vendor adapter) now, one page of spec.
**(18) Missing APIs.** Availability API (type-level, date-ranged) — the most-consumed contract in the platform (booking engine, channel manager, wizard) — never specified as one shared endpoint; three modules will build three.
**(19) Missing deployment considerations.** None material.
**(20) Missing documentation requirements.** Room-setup guide for onboarding (49.4 consumes it).

---

## Chapter 25 — Housekeeping Module (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10; Scalability 7/10; Maintainability 7/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 7/10. The most execution-ready module chapter.

**(1) Missing architectural concepts.** Offline-first for the mobile workflow is deferred (25.32 "future") while Ch 43.6 declares it a core requirement for housekeeping — the two chapters contradict; resolve in favor of 43 (hotel corridors and basements are connectivity dead zones; the feature fails its primary environment without offline).
**(2) Weak decisions.** Auto-assignment (25.7) mixing with manual override — good; but "Skill Level (future)" while 25.25 already balances by "Cleaning Complexity" — complexity without skill produces unfair loads; ship both or neither.
**(3) Missing enterprise best practices.** Task SLA per priority (Critical room ready within X minutes) — 36.12 defines SLAs for maintenance; housekeeping deserves the same table; turndown service and periodic in-stay cleaning schedules (daily clean for in-house guests) — the spec models only checkout cleaning; in-stay cleaning is half the department's work.
**(4) Scalability issues.** None material — queue volumes are modest even at 10k rooms.
**(5) Security concerns.** Housekeeper mobile access scope (assigned rooms only — least privilege for guest-adjacent data); panic/duress consideration for lone workers (legal requirement in some jurisdictions — at minimum note it for the mobile roadmap).
**(6) Future limitations.** Outsourced cleaning companies (external staff without employee accounts) — contractor access model absent (same gap as 36 maintenance contractors).
**(7) Missing diagrams.** Cleaning lifecycle state machine with rejection loop (sketched in 25.3/25.16 — formalize); assignment algorithm flow.
**(8) Missing business rules.** DND (do-not-disturb) handling — guest refuses cleaning: task disposition, retry policy, record; minimum in-stay cleaning frequency policy; lost & found retention period and disposal/donation rules (25.20 records items; their end-of-life is a legal/policy gap).
**(9) Missing technical standards.** Photo standards for before/after (resolution caps, EXIF stripping, storage quota per room).
**(10) Missing operational processes.** Shift handover procedure (incomplete tasks crossing shifts — reassignment rules); linen inventory day-cycle link to Ch 35 (restocking exists; bulk linen flows don't).
**(11) Missing governance.** Performance-metric usage policy (25.26 data in employment decisions — works-council/labor-law note; "coaching not punishment" appears in 27.9 for admins; extend the principle here).
**(12) Missing engineering standards.** None beyond platform-wide.
**(13) Missing monitoring.** Queue-depth and room-ready-latency alerts (VIP arriving, room not started — operational alert, distinct from 25.28's task notifications).
**(14) Missing observability.** Cycle-time analytics exist (25.27) — credit; add data-quality checks (timer left running overnight skews all averages — cap/flag anomalous durations).
**(15) Missing automation.** Auto-generation of in-stay cleaning tasks from occupancy (the missing daily-clean scheduler); auto-priority escalation as arrival time approaches (25.6 has rules — make time-decay explicit).
**(16) Missing AI opportunities.** 25.31 covers AI scheduling — adequately scoped as future; no additional finding.
**(17) Missing integrations.** Laundry vendors (linen out/in tracking); ties to 35 supplier model — one line reserving it suffices.
**(18) Missing APIs.** Housekeeping task API for the mobile client (43) — contract unwritten; the offline sync design depends on it.
**(19) Missing deployment considerations.** None material.
**(20) Missing documentation requirements.** Housekeeping SOP template library (28.26 lists checklists as shared standards — the authoring/versioning of SOPs is the missing artifact).

---

## Chapter 26 — Finance & Cash Register (Parts 1–3)

**Scores & deduction rationale:** Architecture 5/10 — operational controls (shift reconciliation, locking) are genuinely good; the accounting core beneath them does not exist. Enterprise 4/10 — no ledger, no period close, no fiscalization = not sellable to serious operators in target markets. Scalability 5/10; Maintainability 5/10 (flat transaction records resist every future accounting requirement); Security 5/10; Cloud 5/10; Future Proof 5/10 — 26.46's accounting-integration promise is unimplementable without a chart of accounts. Overall 5/10. **Highest-risk module in the document.**

**(1) Missing architectural concepts.** Double-entry ledger (journal of balanced debit/credit postings; accounts: cash registers, guest ledger, revenue by category, tax payable, deposits held, receivables); guest folio (charges posted to folio lines; payments settle folios; folio split/transfer — required by 22.28's own use cases and by every accounting integration); accounting-period close (monthly close, locked periods, adjustments only in open periods — 26.48 demands reproducible history and provides no mechanism); money-representation standard (integer minor units, ISO-4217, banker's rounding, per-currency precision — floating-point money is otherwise guaranteed).
**(2) Weak decisions.** "Manual Adjustment" and "Correction" as transaction types (26.9) without reversal semantics — in a ledger world, corrections are reversing entries, never edits; as specified, they are a fraud/blur channel even with audit. Editing closed-shift transactions "with permission and approval" (26.21) — in accounting, closed means closed; corrections happen in the open period as new entries. This single paragraph, as written, would fail a financial audit.
**(3) Missing enterprise best practices.** Chargeback/dispute lifecycle (states, evidence, ledger impact, deadlines) — absent from the entire document despite card acceptance; gateway settlement reconciliation (provider payout files vs recorded transactions — the online counterpart of 26.19's cash reconciliation); four-eyes principle on refunds above thresholds (29.25 approvals exist — bind amounts).
**(4) Scalability issues.** Financial reports (26.34–26.40) computed from raw transactions at scale — needs posted daily aggregates from the night-audit journal; report queries against OLTP (shared Ch 27 finding).
**(5) Security concerns.** PCI scope statement (no PAN storage, hosted fields, SAQ-A); cash-handling fraud patterns (void-after-payment, refund-to-different-method) deserve named detective controls — 39.18 lists "fraudulent payments" as future AI; basic rule-based detection is v1 hygiene, not AI futurism.
**(6) Future limitations.** Multi-currency deferred (26.25 "future") but border hotels take USD/EUR cash on day one in the target market — at minimum, per-register currency + manual rate recording must be v1; OTA virtual credit cards (Booking.com VCC settlement — a dominant payment reality for connected hotels) never mentioned.
**(7) Missing diagrams.** Ledger posting flow (reservation → folio → journal → registers → reports); shift lifecycle state machine; refund/chargeback sequence.
**(8) Missing business rules.** Deposit forfeiture (no-show keeps deposit? policy link to 22.26); partial-refund allocation across mixed payments (refund $50 of a $170 cash+card payment — from which method?); rounding rules at line vs total level (tax law differs by jurisdiction); gapless legal numbering for fiscal documents.
**(9) Missing technical standards.** Fiscalization interface spec per jurisdiction (UZ ОФД e-receipts given Payme/Click/Uzum are named providers; this is a legal blocker for the home market); invoice/receipt document standards (26.45 export formats ≠ legal document layout requirements).
**(10) Missing operational processes.** Month-end close procedure; cash-count procedure standards (blind count?); float/petty-cash management (opening balance exists; float replenishment policy doesn't).
**(11) Missing governance.** Chart-of-accounts ownership; financial-config change control (tax rates, categories — effective-dated, approved, audited).
**(12) Missing engineering standards.** Money type enforced in code (no floats — lint rule + typed Money class); ledger-balancing invariant test (sum of debits = credits) as a permanent CI/production check.
**(13) Missing monitoring.** Ledger imbalance alert (must be zero, page if not); reconciliation-failure and cash-difference-trend alerts (26.43 lists business alerts — credit; the integrity alerts are the missing tier).
**(14) Missing observability.** Traceability from any report number to its constituent postings (drill-through exists in 40.18 — bind it to the ledger, which requires the ledger).
**(15) Missing automation.** Night-audit auto-posting (the automation everything above hangs on); auto-matching of gateway settlements; scheduled reconciliation reports (26.44 exists — credit).
**(16) Missing AI opportunities.** Cash-difference pattern analysis across shifts/employees (fraud signal) — appropriate as assistive flag with human review; expense-receipt OCR (39.23 — cross-link).
**(17) Missing integrations.** Fiscal devices/ОФД operators; bank-statement import (for transfer reconciliation); accounting platforms (26.46 lists them — blocked on the missing ledger, restated for emphasis).
**(18) Missing APIs.** Folio/ledger read API for the 38.10 accounting sync; payment webhook ingestion contract (gateway → LBL) with idempotency.
**(19) Missing deployment considerations.** Fiscal-device connectivity (local hardware at reception vs cloud API per jurisdiction) affects deployment topology — noted nowhere.
**(20) Missing documentation requirements.** Financial architecture spec + chart of accounts (Missing Documents #5); cashier training handbook (49.13 consumes it); jurisdiction compliance matrix (which fiscal/tax rules apply per country).

---

## Chapter 27 — Reports & Business Intelligence (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10; Enterprise 6/10; Scalability 5/10 (OLTP-coupled until Ch 40 exists; bridge undefined); Maintainability 6/10; Security 6/10 (permission filtering stated — credit); Cloud 6/10; Future Proof 6/10; Overall 6/10.

**(1) Missing architectural concepts.** The v1 reporting substrate (before the Ch 40 warehouse exists): read replica + materialized views + query timeouts — undefined, so v1 reports will hammer OLTP; canonical KPI dictionary (ADR/RevPAR/occupancy defined once — currently implicitly defined here, in 26.35, and in 40.8; three definitions guarantee three numbers).
**(2) Weak decisions.** Administrator rankings (27.23) as a default surface — gamified leaderboards distort behavior (staff will race check-ins); 27.9 says "coaching, not punishment" — make rankings opt-in per organization and pair every rate metric with volume context.
**(3) Missing enterprise best practices.** Report versioning (a saved report's meaning changes when the KPI definition changes — snapshot the definition version with the report); scheduled-report failure handling (owner's daily report silently missing = trust damage; delivery monitoring required).
**(4) Scalability issues.** "Responsive with millions of records" (27.32) — named techniques (incremental load, aggregation, caching) need the substrate from (1); export of large datasets (Excel row limits, streaming CSV, async export with notification — 14's async-operation pattern) unspecified.
**(5) Security concerns.** Export = data egress: watermarking/classification on exports, DLP hooks (41.19), audit of export events (17.8 lists "Export Reports" as a permission — add it as an audited event).
**(6) Future limitations.** Report builder (27.29) is a product-in-a-product (arbitrary metric×dimension queries = query-cost governance, semantic-layer dependency) — stage it explicitly after Ch 40's semantic layer, or it will be built twice.
**(7) Missing diagrams.** Reporting data-flow per stage (v1: replica+views; v2: warehouse); drill-down navigation map.
**(8) Missing business rules.** Comparable-period rules (this month vs last month with different day counts; year-over-year across leap years; the hotel-business-date boundary again); currency of aggregation for multi-currency branches (26.72's base-currency rule — restate the binding here).
**(9) Missing technical standards.** The KPI dictionary format (definition, formula, grain, inclusions/exclusions, owner, version).
**(10) Missing operational processes.** Metric-discrepancy investigation runbook (pairs with Ch 20 finding 10).
**(11) Missing governance.** KPI change control (changing occupancy's definition restates history — approval + annotation required).
**(12) Missing engineering standards.** Report query review gate (cost limits); snapshot tests for KPI formulas against fixture datasets.
**(13) Missing monitoring.** Scheduled-report delivery success rate; report latency percentiles.
**(14) Missing observability.** Usage analytics on reports themselves (which reports nobody opens — 47's product analytics applied inward).
**(15) Missing automation.** Alert-on-threshold for any saved report metric (generalizes 26.43's hardcoded alerts into a user feature — cheap, high value).
**(16) Missing AI opportunities.** 27.26 covers AI insights adequately; add narrative auto-annotation of period comparisons ("revenue -12% driven by branch X occupancy") — bind to 40.24 rather than building separately.
**(17) Missing integrations.** BI-tool egress (38.11 read-only analytics access) — the contract (views? API? warehouse share?) is undefined in both chapters.
**(18) Missing APIs.** Reports API for 37.7's "Reports" resource — parameterization and async-delivery contract unwritten.
**(19) Missing deployment considerations.** Report workload isolation (separate pool/replica) so a heavy export can't degrade check-in.
**(20) Missing documentation requirements.** Report catalog with KPI-dictionary links; "how to read your daily report" owner documentation (49.13).

---

## Chapter 28 — Multi-Hotel Management (Parts 1–2)

**Scores & deduction rationale:** Architecture 5/10 — clean org hierarchy, but the chapter's every promise rests on an unmade tenancy decision; Enterprise 5/10; Scalability 5/10; Maintainability 5/10; Security 5/10 (isolation asserted, not designed); Cloud 5/10; Future Proof 6/10; Overall 5/10.

**(1) Missing architectural concepts.** The tenancy data model (pooled + RLS vs schema-per-tenant vs DB-per-tenant, possibly tiered by plan) — this chapter and Ch 48 both need it, neither makes it; context-propagation design (tenantId through request → services → jobs → events — one forgotten filter = cross-tenant leak; RLS exists precisely to make that structural); config-inheritance engine (org → hotel → branch with deterministic resolution order and effective-config audit).
**(2) Weak decisions.** 28.30 "failures in one hotel must not affect others" stated absolutely — impossible on shared monolith + shared DB; restate honestly as blast-radius reduction (per-tenant rate limits, query quotas, circuit breaking) with true isolation (cell-based) as a defined future stage.
**(3) Missing enterprise best practices.** Tenant-scoped testing discipline (every integration test asserts cross-tenant invisibility — the test class that catches the worst bug category); noisy-neighbor SLOs (per-tenant fairness metrics).
**(4) Scalability issues.** 28.29's ladder (10,000 hotels, 100,000 branches) with cross-hotel search (28.9/28.27) and a global dashboard (28.8) — both are aggregation workloads that must ride the Ch 40 platform, not OLTP; dependency unmarked. Hotel switching (28.7) "loads new context" — session/permission cache invalidation design absent.
**(5) Security concerns.** Cross-hotel guest CRM (28.10) — define its legal boundary (within one organization = controller continuity, defensible; document it); global audit (28.21) readable by whom (org admin sees all hotels' actions — insider-threat surface; scope carefully); search results "indicate the originating hotel" — must also *filter* by accessor's scope (stated in 27.33; restate here where the cross-hotel surface lives).
**(6) Future limitations.** Franchise model (hotels sharing a brand but legally separate entities — data sharing ≠ ownership) — the hierarchy assumes ownership; franchising breaks it; note it before a franchise deal forces improvisation.
**(7) Missing diagrams.** Tenancy model diagram (the missing ADR's picture); config-inheritance resolution diagram; context-switch sequence.
**(8) Missing business rules.** Which standards are centrally-locked vs overridable (28.11/28.26 say "where permitted" — the permission matrix for configuration itself is undefined); guest-profile merge across hotels (dedup at org level — who owns the merged record).
**(9) Missing technical standards.** Tenant identifier standard (in every table? every event? every log line? — yes, and say so once).
**(10) Missing operational processes.** New-hotel onboarding runbook (create branch, rooms, users, channel mappings, pricing — the 49.4 checklist's multi-hotel variant); hotel offboarding/archival (data export, retention, subscription end).
**(11) Missing governance.** Org-level admin governance (who at the customer may create hotels/grant org-wide roles — delegated administration model).
**(12) Missing engineering standards.** Repository-layer tenant-guard convention (no query without tenant predicate — lint/wrapper enforced).
**(13) Missing monitoring.** Cross-tenant access attempt alerts (should be zero; any nonzero = code bug or attack); per-tenant resource dashboards.
**(14) Missing observability.** Tenant dimension on every metric/trace (cost attribution and per-tenant debugging both need it).
**(15) Missing automation.** Bulk standard-propagation jobs (28.26 "hotels inherit updates" — the rollout mechanism with per-hotel failure reporting).
**(16) Missing AI opportunities.** 28.28 covers network insights adequately as future.
**(17) Missing integrations.** None beyond platform-wide.
**(18) Missing APIs.** Organization/hotel management API (37.7 lists resources — the org-admin operations contract is unwritten).
**(19) Missing deployment considerations.** Whether large customers get dedicated instances (single-tenant deployment option — enterprise buyers ask; the tenancy ADR must answer).
**(20) Missing documentation requirements.** Multi-hotel administration guide; tenancy ADR (the document this chapter is waiting for).

---

## Chapter 29 — User Roles & Permission System (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10 (temporary permissions, delegation, break-glass, approval workflows — unusually complete); Scalability 6/10 (evaluation cost undesigned); Maintainability 6/10; Security 7/10; Cloud 6/10; Future Proof 7/10; Overall 7/10. One of the document's best chapters.

**(1) Missing architectural concepts.** Policy-engine decision (OPA/Cedar/Casbin vs specified in-house evaluator) — RBAC + ABAC + scopes + temporal grants + delegation + deny-precedence is a policy language; hand-rolled conditionals will diverge from the 29.16 matrix; permission-evaluation caching with invalidation on role change (per-request evaluation across org→hotel→branch inheritance at scale needs a design).
**(2) Weak decisions.** None significant. 29.12's deny > allow > inherited > no-access resolution is correct and deterministic — credit.
**(3) Missing enterprise best practices.** Executable permission matrix (29.16 as a CI test suite asserting every role × permission against the API — the only way the matrix UI and reality stay synchronized); periodic access review/recertification campaigns (SOC 2 control; quarterly manager attestation of team permissions); SoD (segregation-of-duties) rules as first-class constraints (creator-of-payment ≠ approver-of-refund — 29.25 implies, never formalizes).
**(4) Scalability issues.** Effective-permission computation for a user with 5 roles across 3 hotels on every request — cache design + staleness bound required (interlocks the Ch 15 JWT finding: permissions live server-side).
**(5) Security concerns.** Privilege-escalation paths (who can grant which roles — a role-granting matrix, not just action permissions; "Manage Users" as a single permission is too coarse: managing housekeepers ≠ granting Owner); API keys (29.27) need scope ceilings (a key can never exceed its creator's permissions — say it).
**(6) Future limitations.** Customer-facing roles (guest portal 31.19 users are principals too — the model covers staff only; guests need a parallel lightweight identity domain, or the staff RBAC gets polluted).
**(7) Missing diagrams.** Permission-evaluation flow (request → cache → engine → decision → audit); role-inheritance diagram.
**(8) Missing business rules.** Default-deny stated? (Implied by 29.12's "No Access" terminal — make explicit); approval-quorum rules (one approver? two for large refunds?); delegation limits (can a delegate re-delegate? — say no).
**(9) Missing technical standards.** Permission naming convention (module.action.scope — 29.8/29.9 imply the grid; the string standard binds code to matrix).
**(10) Missing operational processes.** Access-review campaign procedure; emergency-access (29.26) post-hoc review procedure (who reviews break-glass usage, within what SLA).
**(11) Missing governance.** Role catalog ownership (who approves new custom roles at platform level vs org level).
**(12) Missing engineering standards.** Authorization test template per endpoint (44.6 lists "Authorization" — the matrix-driven generation makes it real).
**(13) Missing monitoring.** Permission-denied burst alerts (probing signal); dormant-privileged-account detection.
**(14) Missing observability.** Decision logging with matched-rule identification (debugging "why can't I…" tickets — 49's support depends on it).
**(15) Missing automation.** Auto-expiry sweeps (temporary grants, delegations — stated as automatic; the job that does it lives in the missing job infrastructure); SCIM-driven deprovisioning (cross-ref Ch 15 finding 17).
**(16) Missing AI opportunities.** Role-mining (suggest role consolidation from usage patterns) — genuine enterprise feature, appropriately future.
**(17) Missing integrations.** IdP group → role mapping (38.13 SSO providers send groups; the mapping config is the integration's hard part).
**(18) Missing APIs.** Roles/permissions management API (partially implied by 37.7 "Users" — separate the resource).
**(19) Missing deployment considerations.** None material.
**(20) Missing documentation requirements.** Permission catalog documentation (auto-generated from the registry); security-model explainer for enterprise security reviews (procurement artifact).

---

## Chapter 30 — Channel Manager & OTA Integration (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10; Enterprise 5/10 (certification programs and reconciliation absent — both gate real OTA go-live); Scalability 6/10 (queue model present); Maintainability 6/10; Security 6/10; Cloud 6/10; Future Proof 6/10; Overall 6/10.

**(1) Missing architectural concepts.** Transactional outbox for sync-job creation (30.16's "reservation changes → jobs are created" is a dual-write without it); delivery-semantics contract (at-least-once + idempotent apply, per-channel ordering keys — rapid price updates arriving out of order at an OTA is silent rate corruption); **ARI at room-type level** (30.6 maps physical rooms 1:1 to channel rooms — Booking.com/Expedia sell type-level counts; the mapping model is structurally wrong for the two biggest channels); periodic full reconciliation (nightly ARI audit vs each channel with drift correction — retries fix transient failures, only reconciliation heals divergence).
**(2) Weak decisions.** Fixed retry ladder (30.14) is fine, but "Manual Review" as the terminal state needs an SLA and an owner (an unsynced stop-sell aging in a review queue = overbooking clock ticking).
**(3) Missing enterprise best practices.** Overbooking-window mitigation (availability buffers, auto stop-sell above occupancy threshold — the industry-standard belt-and-suspenders absent); channel certification planning (Booking.com Connectivity Partner / Expedia EQC programs impose technical requirements and months of lead time — unmentioned, they gate the roadmap); iCal-based sync fallback for Airbnb (its common integration mode) unconsidered.
**(4) Scalability issues.** 30.29's "millions of daily updates" — per-channel rate-limit budgets vs update volume needs arithmetic (100 hotels × 30 room types × 365 days × price changes = the batching strategy in 30.22 must be designed, not listed); fan-out on org-wide price changes (28.16 central pricing → thousands of channel updates) unanalyzed.
**(5) Security concerns.** OTA credentials in the (undecided) secret store; inbound webhook authenticity per provider (37.17's HMAC standard is for *outbound* — inbound verification per channel's scheme needs its own spec); guest PII from OTAs (data-processing terms, minimization).
**(6) Future limitations.** Metasearch (Google Hotels in 30.28) has a different integration model (price feeds + booking links) than OTA push — the "channel" abstraction should be typed now.
**(7) Missing diagrams.** Sync sequence (booking → outbox → queue → channel, with failure branches); reconciliation flow; mapping model ERD (hotel/room-type/rate-plan ↔ channel entities).
**(8) Missing business rules.** Conflict precedence (30.19: duplicate OTA vs manual reservation — who wins pending review; is the room double-held meanwhile?); rate-parity policy hooks (34's dynamic pricing vs OTA parity clauses); channel-specific cancellation-policy mapping (22's missing policy engine again — OTAs demand it structurally).
**(9) Missing technical standards.** Message schema for sync jobs; channel-adapter interface contract (each new OTA implements one interface — implied by 30.3's "without redesign," never specified).
**(10) Missing operational processes.** Channel onboarding runbook (mapping, test bookings, go-live checklist per channel); overbooking incident procedure (cross-ref Ch 22 finding 10).
**(11) Missing governance.** Who may connect/disconnect channels and change mappings (revenue-critical config — approval workflow).
**(12) Missing engineering standards.** Channel-adapter test kits (record/replay of provider APIs; sandbox accounts per provider).
**(13) Missing monitoring.** Sync-lag SLO per channel (seconds from local change to channel-confirmed); queue-depth alerts; drift metrics from reconciliation (count of corrected discrepancies — the health number that matters most).
**(14) Missing observability.** Correlation from a guest-facing overbooking back through sync history (the forensic path for the worst incident type).
**(15) Missing automation.** Auto stop-sell triggers; auto-pause of a misbehaving channel (circuit breaker at channel granularity).
**(16) Missing AI opportunities.** None material — determinism is the virtue here.
**(17) Missing integrations.** Covered by the chapter's own scope; GDS (Amadeus/Sabre — corporate travel) absent from all lists; note for enterprise-hotel roadmap.
**(18) Missing APIs.** Channel-manager admin API (mappings, health, manual sync) for 37 exposure.
**(19) Missing deployment considerations.** Sync workers as the first component to split from the monolith (natural Stage-2 seam per 50.11 — worth stating to guide the modular boundary now).
**(20) Missing documentation requirements.** Per-channel integration guides; mapping-workbook template for onboarding staff.

---

## Chapter 31 — Booking Engine (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10; Enterprise 5/10; Scalability 6/10; Maintainability 6/10; Security 5/10 (public + payments + no abuse/PCI spec); Cloud 6/10; Future Proof 6/10; Overall 6/10.

**(1) Missing architectural concepts.** Inventory hold with TTL through checkout (search → pay is minutes; without a hold, payment for a vanished room is a designed-in failure); quote integrity (price signed/expiring between display and confirm — silent repricing at pay is a conversion killer and a consumer-protection issue); payment saga with all failure branches (auth-ok/confirm-fail → void; webhook-after-abandon; double-submit — 31.17 draws only the happy path); deployment separation decision (public engine as separate app/read-model vs same monolith — public internet traffic against the OLTP DB is a availability and security coupling that needs an explicit choice).
**(2) Weak decisions.** None wrong; 31.2's <3min goal and minimal required fields are right.
**(3) Missing enterprise best practices.** PCI SAQ-A architecture statement (hosted fields/redirect only); 3-D Secure flow (SCA is mandatory for EU cards — never mentioned); GDPR cookie consent for the public site (analytics in 31.30 requires it).
**(4) Scalability issues.** Availability search burst traffic (marketing campaign → thousands of searches) — cacheable availability read-model with bounded staleness + transactional recheck at hold time; the design is implied by nothing.
**(5) Security concerns.** Bot/abuse protection (carding attacks on the payment form, inventory-hold DoS via checkout spam, scraping) — WAF/bot management absent document-wide (cross-ref Ch 41 finding); guest-portal auth (31.19: magic links? account? — reservation-lookup by number+name is enumerable; specify the access token design); reservation links in email (31.31 lists them — signed, expiring links, say so).
**(6) Future limitations.** Multi-property booking (one stay across sister hotels) and packages (room+extras bundles priced as one) — common direct-booking differentiators; the flow forecloses neither but reserves neither.
**(7) Missing diagrams.** Booking-flow sequence with hold/payment/failure branches (the diagram that would have exposed the saga gap); deployment topology for the public surface.
**(8) Missing business rules.** Hold TTL and re-offer policy; children pricing/occupancy in search (adults+children in 31.5 — pricing effect undefined, same as Ch 22 finding 8); tax-inclusive vs exclusive display per jurisdiction (legal in EU — display rules are law, not preference); overbooking-at-confirm handling (last room taken between hold-miss and confirm → the apology flow).
**(9) Missing technical standards.** SEO structured data spec (schema.org/Hotel, room offers); payment-provider abstraction interface (38.6 "payment abstraction layer" is named — its contract is unwritten and this chapter is its main consumer).
**(10) Missing operational processes.** Payment-provider outage degraded mode (offer pay-at-hotel? queue?); booking-engine content management (photos, descriptions — who edits, how it publishes; ties 24.10 media).
**(11) Missing governance.** Rate/photo content approval (brand governance for the public surface, 48.16 white-label interplay).
**(12) Missing engineering standards.** Conversion-funnel event schema (31.30's analytics needs an event taxonomy standard).
**(13) Missing monitoring.** Conversion-rate and payment-success-rate alerts (a broken payment provider shows as conversion collapse before anyone reports it); Core Web Vitals field monitoring against 31.25's targets.
**(14) Missing observability.** Session replay/error correlation for abandoned bookings (debugging the funnel).
**(15) Missing automation.** Abandoned-booking recovery is future-flagged (31.28) — fine; auto-expiring holds is v1 (same job infra dependency).
**(16) Missing AI opportunities.** 31.27 covers upselling as future — adequately scoped.
**(17) Missing integrations.** Payment providers enumerated (31.16) — credit; add Google Hotels free booking links (direct-channel volume, cheap); email deliverability (SPF/DKIM/DMARC for confirmation mail — Notification Center consumes, booking engine depends).
**(18) Missing APIs.** The booking API itself (search/quote/hold/confirm) — should be the same public API surface partners use (37), not a private twin; state the single-API principle.
**(19) Missing deployment considerations.** CDN + edge caching for the public pages; separate scaling group from the PMS app.
**(20) Missing documentation requirements.** Hotelier setup guide (rate plans, photos, policies — 49.4 onboarding consumes); booking-terms/legal templates per jurisdiction.

---

## Chapter 32 — Notification Center (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10 (hub-and-spoke with templates/queue/retry/failover is the right shape); Enterprise 6/10; Scalability 6/10; Maintainability 7/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 6.5/10.

**(1) Missing architectural concepts.** Reliable event ingestion (the outbox, again — "modules publish events" needs the mechanism); deduplication (at-least-once delivery upstream → exactly-once *notification* requires idempotency keys on notification requests); suppression-list architecture (bounces, complaints, opt-outs — 32.29 names opt-out handling; the list infrastructure and its precedence over sends is undesigned).
**(2) Weak decisions.** None significant; quiet hours with critical override (32.18) is thoughtfully scoped.
**(3) Missing enterprise best practices.** Structural separation of transactional vs marketing mail (separate sending domains/IP pools; marketing suppression must not block invoices — legal and deliverability, not preference); email authentication (SPF/DKIM/DMARC per sending domain, including white-label domains from 48.17 — a real operational trap: every custom domain needs DNS setup workflow).
**(4) Scalability issues.** 32.30 targets (millions of messages) vs the missing queue infrastructure (Ch 12); bulk sends (32.20) need provider-rate-aware batching — named, not designed.
**(5) Security concerns.** Template injection (user-influenced variables → HTML email injection/phishing vectors — escape-by-default rendering standard); PII in notification payloads at rest (delivery history 32.13 stores message content? — retention and masking policy); webhook channel (32.3) — outbound webhooks need the same SSRF/egress controls as Ch 33's.
**(6) Future limitations.** Guest-facing two-way messaging (WhatsApp replies — inbound routing to staff) — one-way architecture now; the moment a guest replies, you need an inbox product; flag the boundary explicitly.
**(7) Missing diagrams.** Event → rule → template → queue → provider → status-webhook sequence; suppression-precedence decision tree.
**(8) Missing business rules.** Notification-fatigue budgets (max non-critical notifications per user per day); locale fallback chain (guest prefers Uzbek, template exists in RU/EN — order?); which events are guest-visible vs staff-only by default.
**(9) Missing technical standards.** Template syntax standard (the {{var}} dialect, escaping rules, i18n pluralization in templates); event-payload schema binding (which event fields templates may reference — schema registry dependency).
**(10) Missing operational processes.** Deliverability operations (blacklist monitoring, bounce-rate response, warmup for new domains); provider onboarding checklist.
**(11) Missing governance.** Template change approval (a bad template reaches every guest — review gate for guest-facing templates); marketing-consent governance (who may launch campaigns 32.22).
**(12) Missing engineering standards.** Template testing (render tests per language with fixture data; screenshot tests for email HTML across clients).
**(13) Missing monitoring.** Delivery-rate SLOs per channel with alerts (32.23 has analytics — bind thresholds); provider-failover trigger metrics.
**(14) Missing observability.** End-to-end trace: business event → notification → provider response → open (32.19 has states; correlate them to the originating transaction for support).
**(15) Missing automation.** Covered well by the chapter (scheduling, retries, failover) — credit.
**(16) Missing AI opportunities.** 32.28 covers generation with human review — appropriately governed.
**(17) Missing integrations.** Providers enumerated in 38.8 — consistent; add inbound-status webhooks per provider (bounce/complaint ingestion) as required integrations, not optional.
**(18) Missing APIs.** Notification API for extensions (46) and public API consumers (send-on-behalf with template governance) — reserve the contract.
**(19) Missing deployment considerations.** Sending-domain DNS automation for white-label tenants (48.17 interplay — manual DNS per tenant does not scale).
**(20) Missing documentation requirements.** Template-authoring guide; notification-event catalog (which business events can notify whom — governed list).

---

## Chapter 33 — Automation Engine (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10 (correct trigger/condition/action model, sandbox, versioning); Enterprise 5/10; Scalability 5/10 (durable long-waits undesigned); Maintainability 6/10; **Security 4/10** (SSRF surface unmitigated); Cloud 5/10; Future Proof 7/10; Overall 5.5/10.

**(1) Missing architectural concepts.** Durable-execution engine (33.18's "wait until check-in" = workflows sleeping weeks, surviving deploys/migrations, resuming exactly once — Temporal-class problem; the largest unacknowledged ADR in the document); execution identity model (actions run as whom? workflow author's permissions frozen at publish? a service identity with granted scopes? — every authorization property of Ch 29 depends on the answer); in-flight versioning (33.29 versions definitions; executions mid-delay when the definition changes need pinning semantics).
**(2) Weak decisions.** Exposing raw HTTP request nodes (33.22) to tenant authors *before* the egress-control layer exists — feature order inverted; ship webhook-to-allowlisted-integrations first, raw HTTP later behind egress proxy.
**(3) Missing enterprise best practices.** Per-tenant execution quotas/budgets (runaway loop over every guest × SMS = provider bill + reputation damage — 33.20 prevents infinite recursion, not expensive finite stupidity); kill switch (org admin and platform operator can halt a workflow and its queued executions instantly); dry-run against production data snapshots (33.30 sandbox is isolated — good; authors also need "what *would* this have done yesterday" replay).
**(4) Scalability issues.** 33.32's "millions of executions, distributed workers" — the worker architecture, queue partitioning (per-tenant fairness), and hot-trigger amplification (one org-wide event triggering thousands of workflows) undesigned.
**(5) Security concerns.** **SSRF** (HTTP nodes reaching cloud metadata endpoints, internal services, other tenants — egress allowlist/proxy, private-IP blocking: mandatory, absent); credential handling in workflows (33.21 "authentication methods remain configurable" — secrets must come from the vault by reference, never inline in workflow definitions); template/variable injection in actions (workflow variables into notification bodies — same sanitization as Ch 32).
**(6) Future limitations.** Cross-tenant/marketplace workflow templates (33.28) importing third-party logic = supply-chain risk class — signing/review pipeline (46.17–18's machinery) must extend to workflow templates; unlinked.
**(7) Missing diagrams.** Execution lifecycle state machine (queued → running → waiting → resumed → completed/failed/compensated); worker architecture diagram.
**(8) Missing business rules.** Trigger-loop prevention across workflows (workflow A's action fires workflow B's trigger fires A — cycle detection at publish + runtime depth caps; 33.20 covers loops *within* one workflow only); execution-order guarantees when multiple workflows match one event (priority? parallel? deterministic order?).
**(9) Missing technical standards.** Workflow definition format (versioned JSON schema — the export/import/marketplace unit); expression language for conditions (33.7's examples imply one — specify it, sandbox it).
**(10) Missing operational processes.** Failed-execution triage (dead-letter review ownership); tenant-support debugging access to execution logs (with PII scoping).
**(11) Missing governance.** Publish approval for workflows touching money/PII (a workflow applying discounts is a pricing control — route through 29.25 approvals); platform-level action allowlist governance (which action types tenants get by plan).
**(12) Missing engineering standards.** Action-implementation contract (idempotent, timeout-bounded, compensable where possible) — the internal SDK for adding actions.
**(13) Missing monitoring.** Execution success-rate/latency per workflow; queue depth; per-tenant execution-volume anomaly alerts (the runaway detector).
**(14) Missing observability.** Execution traces linked to the triggering business transaction (guest asks "why did I get this SMS" → support finds the workflow + trigger in one query — 33.14 logs exist; the correlation contract doesn't).
**(15) Missing automation.** Meta-level: auto-disable of consistently failing workflows with owner notification.
**(16) Missing AI opportunities.** 33.31 (NL → workflow with review) is well-scoped — credit; add AI-assisted failure explanation of execution logs.
**(17) Missing integrations.** Action library for the 38 catalog (each official integration should contribute actions — the extension point is implied by 33.9 "future actions," not contracted).
**(18) Missing APIs.** Workflow management API (CRUD, execute, logs) for 37 — the automation-as-code path enterprises want (Terraform-style workflow provisioning).
**(19) Missing deployment considerations.** Worker isolation from the web tier (an execution storm must not degrade check-in — separate deployment/scaling unit; the Stage-2 seam again).
**(20) Missing documentation requirements.** Workflow-authoring guide with the action/trigger/variable catalog; security guide for automation authors.

---

## Chapter 34 — Dynamic Pricing Engine (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10 (layered hierarchy, guardrails, four autonomy modes, explainability — mature framing); Enterprise 6/10; Scalability 6/10; Maintainability 6/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 6.5/10.

**(1) Missing architectural concepts.** Price-computation architecture (on-demand per request vs precomputed price calendar per room-type × date × rate-plan — 34.29's "millions of daily calculations" implies precomputed with event-driven invalidation; the choice shapes storage and the Ch 30 propagation pipeline); ordered propagation to channels (price for date D changed twice in a minute — last-write-wins tokens per (type, date, channel) or the OTA ends up with the stale price).
**(2) Weak decisions.** "Dynamic pricing is the default" (34.2) as philosophy — for the SMB segment entering the product, *recommendation-only* must be the default autonomy mode (34.21 has the ladder — state the default explicitly; trust is earned).
**(3) Missing enterprise best practices.** Guardrail testing (backtests proving rules never breach min/max under historical scenarios); price-change velocity limits (max % change per day — protects against rule interactions producing oscillation); holdout evaluation (was the engine actually better than static? — a permanent control group or before/after methodology; 34.24's A/B is the tool, bind it).
**(4) Scalability issues.** Recompute fan-out (occupancy change → repricing 90 days × N types × M rate plans × K channels) — batching and debounce design absent.
**(5) Security concerns.** Price manipulation as insider fraud (employee drops price, accomplice books — velocity alerts + approval thresholds on manual overrides; 34.12 audits, doesn't gate); competitor-data scraping legality (34.22 — source via licensed providers only; note it).
**(6) Future limitations.** Per-person occupancy pricing and length-of-stay pricing (common in the region and in OTA rate structures) — the 34.4 hierarchy is per-night-per-room only; extending the price dimensions later touches every layer; reserve the dimensions now.
**(7) Missing diagrams.** Pricing-pipeline flow (base → rules → final, with rule-precedence and short-circuit conditions); propagation sequence to channels.
**(8) Missing business rules.** Repricing of *existing* reservations (price rules change — booked reservations keep their snapshot: interlocks Ch 22's rate-snapshot doctrine; say it here too); rate-parity constraints as a rule layer (contractual floor/ceiling per channel); currency of rules in multi-currency orgs (rule says "+$10" — in which currency, converted when?).
**(9) Missing technical standards.** Rule definition format (versioned, effective-dated — same discipline as workflow definitions); rounding of computed prices (psychological rounding to .90? — configurable, but the mechanism must exist).
**(10) Missing operational processes.** Pricing-incident runbook (wrong price published and booked — honor vs cancel policy per jurisdiction's consumer law); seasonal-calendar maintenance ownership.
**(11) Missing governance.** Who may change guardrails (min price is the fraud floor — owner-level only); strategy-change approval (34.19 switching strategies mid-season is a revenue event).
**(12) Missing engineering standards.** Golden-dataset regression tests for the pricing function (same inputs → same prices across releases — determinism as a test).
**(13) Missing monitoring.** Price-anomaly alerts exist (34.25 — credit); add propagation-lag monitoring (computed price vs channel-confirmed price age).
**(14) Missing observability.** Decision trace persisted per published price (34.27 explains recommendations — persist the explanation with the price for later disputes: "why was Saturday $70").
**(15) Missing automation.** Covered by the chapter's modes — credit.
**(16) Missing AI opportunities.** Well-covered (34.20/34.30) with explainability requirements — the document's best AI governance instance.
**(17) Missing integrations.** Event-data providers (34.9 local events — PredictHQ-class feeds); competitor-rate shoppers (34.22) — both named as future, acceptable.
**(18) Missing APIs.** Pricing API (get computed price + explanation for date/type/plan) — consumed by booking engine, wizard, channel manager; specify once.
**(19) Missing deployment considerations.** Pricing engine as a candidate Stage-2 service (compute-isolated from OLTP) — flag the seam.
**(20) Missing documentation requirements.** Revenue-manager user guide (the persona is new to the product's SMB base — adoption depends on education); rule-authoring reference.

---

## Chapter 35 — Inventory & Procurement Management (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 6/10; Scalability 6/10; Maintainability 7/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 6.5/10.

**(1) Missing architectural concepts.** Three-way match (PO ↔ goods receipt ↔ supplier invoice — the standard control against overbilling; PO and receiving exist, invoice matching doesn't); GL integration (receipts capitalize inventory, consumption expenses it — without the Ch 26 ledger, "Total Inventory Value" 35.13 and P&L 26.36 will disagree permanently); reserved-stock semantics (35.10 lists "Reserved" — reserved by what? future POs? pending transfers? define the reservation object).
**(2) Weak decisions.** LIFO offered (35.25) — not permitted under IFRS; the "(where applicable)" hedge needs a jurisdiction guard so an org can't misconfigure into non-compliance.
**(3) Missing enterprise best practices.** Inventory period close (counts and adjustments locked to accounting periods — same close discipline as finance); negative-stock policy (block issue when stock hits zero vs allow-and-flag — operational reality needs the explicit choice); supplier performance scoring methodology (35.16 stores a score — computed how?).
**(4) Scalability issues.** Concurrent consumption (two housekeepers scanning the last item — same optimistic/constraint pattern as rooms; cheap to state, expensive to retrofit); movement-history volume (partition/archive strategy, shared with audit).
**(5) Security concerns.** Inventory shrinkage controls (adjustment approvals above thresholds, count-variance investigation trail — 35.23 requires explanation; add approval tiers); barcode spoofing (scanning the wrong item's code — periodic blind counts as detective control).
**(6) Future limitations.** Recipe/BOM consumption (restaurant inventory 35.3 implies dish → ingredients explosion — a different consumption model; scope the boundary: LBL tracks stock, POS integration owns recipes, or LBL grows a BOM module — decide before the restaurant module is promised).
**(7) Missing diagrams.** Procurement lifecycle (request → approval → PO → receipt → invoice match → payment); stock-movement state diagram; warehouse-hierarchy ERD.
**(8) Missing business rules.** Expiry/batch tracking (mini-bar food, chemicals — FEFO issuance; "Expired" is a movement type in 35.9 but batch/expiry data isn't in the 35.4 item model — inconsistency); unit conversions (buy by box, consume by piece — conversion factors per item; units are "standardized" 35.5 but conversion is unmodeled).
**(9) Missing technical standards.** SKU/barcode format governance; supplier data standards (dedup by tax ID).
**(10) Missing operational processes.** Physical-count scheduling and freeze procedure (movements blocked during count?); goods-receiving inspection SOP.
**(11) Missing governance.** Budget-approval matrix (35.29 budgets exist — who approves overruns); procurement-policy ownership (thresholds requiring competitive quotes — enterprise buyers have procurement policies; the system should model approval tiers by amount).
**(12) Missing engineering standards.** Stock-math invariant tests (sum of movements = current stock — the inventory analog of ledger balancing).
**(13) Missing monitoring.** Stock-drift detector (computed vs stored quantity); stuck-PO alerts (approved, never received, aging).
**(14) Missing observability.** Consumption-anomaly surfacing (35.26 has analytics — bind alert thresholds for spikes = leak/theft signal).
**(15) Missing automation.** Auto-replenishment exists (35.22, review-gated — correctly conservative); add auto-PO-from-approved-request (the clerical step between 35.18 and 35.19).
**(16) Missing AI opportunities.** 35.27 forecast is scoped — fine; receipt OCR for invoice matching (39.22/23 — cross-link, don't rebuild).
**(17) Missing integrations.** Supplier e-catalogs/EDI (enterprise procurement — future, note it); POS for restaurant consumption.
**(18) Missing APIs.** Inventory resource in 37.7 exists — the movement-posting contract (idempotent, batch) is the part worth specifying.
**(19) Missing deployment considerations.** Offline counting (43.19 covers it — credit for cross-volume consistency).
**(20) Missing documentation requirements.** Inventory-setup guide (categories, units, warehouses) for onboarding; costing-method decision guide for owners (FIFO vs weighted-average consequences, in owner language).

---

## Chapter 36 — Maintenance & Asset Management (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10; Scalability 7/10; Maintainability 7/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 7/10. Coherent EAM scope, well-tiered futures.

**(1) Missing architectural concepts.** GL/depreciation integration (36.4 stores depreciation method; the engine that posts monthly depreciation lives in the missing Ch 26 ledger — third module blocked on it); contractor/vendor work-order model (external technicians without employee accounts: access, insurance docs, sign-off — same contractor gap as Chs 25/35, now load-bearing since elevators and boilers are *always* serviced by vendors).
**(2) Weak decisions.** None significant. Work-order state set (36.9) is complete and practical.
**(3) Missing enterprise best practices.** SLA clock semantics (business hours vs calendar; clock pause in Waiting-Parts/Waiting-Approval — every SLA dispute lives in this definition; 36.12 gives targets, not clock rules); root-cause coding on closures (failure-code taxonomy per asset category — feeds MTBF meaningfully; without codes, 36.26's metrics are shallow).
**(4) Scalability issues.** None material at spec level — 36.31's targets are plausible for this workload shape.
**(5) Security concerns.** Safety-critical assets (boilers, elevators) — certification/inspection compliance tracking with legal deadlines (36.16 lists "Annual Certification" as an example; make regulatory inspections a first-class, non-deletable schedule type with escalation); photo/document attachments need the same storage-security spec as Ch 23 (private buckets, EXIF).
**(6) Future limitations.** IoT-triggered work orders (36.28 predictive) will need telemetry ingestion (device identity, signal thresholds) — reserved in 24.33; neither chapter owns the pipeline; assign it (Missing Documents: IoT architecture note).
**(7) Missing diagrams.** Work-order state machine with SLA clock annotations; preventive-schedule → WO generation flow.
**(8) Missing business rules.** Guest-impacting maintenance (WO on an occupied room — guest-move workflow trigger, compensation policy hooks); warranty-claim-first rule (36.23 identifies warranty coverage — enforce "claim before paying" as a workflow gate, not a display).
**(9) Missing technical standards.** Asset-tag/QR standard (shared with 24.12 — signed tokens); failure-code taxonomy.
**(10) Missing operational processes.** Emergency out-of-hours dispatch (36.12's 15-minute Emergency SLA at 3 AM — on-call rotation for technicians, escalation to external vendors); asset onboarding on purchase (link from 35 receiving → asset registry creation — the handoff exists in neither chapter).
**(11) Missing governance.** Capex vs opex classification rules (repair vs upgrade — affects 36.24 lifecycle and the ledger); disposal approval (asset write-off is a financial event needing authorization).
**(12) Missing engineering standards.** None beyond platform-wide.
**(13) Missing monitoring.** SLA-breach prediction alerts (WO at 80% of SLA unassigned — escalate before breach, not after; 36.12 notifies on violation only).
**(14) Missing observability.** Asset downtime attribution into room availability (OOO rooms by maintenance cause — feeds the Ch 24 OOO finding and revenue-loss reporting).
**(15) Missing automation.** Preventive schedules auto-generate WOs (36.17 — credit); add parts auto-reservation on WO assignment (reserve stock when WO is accepted — ties 35.10's reserved-stock object).
**(16) Missing AI opportunities.** 36.28 well-scoped as future.
**(17) Missing integrations.** Vendor portals (dispatch to external service companies — email-based at minimum); utility-meter integration (energy per asset — future, note only).
**(18) Missing APIs.** Maintenance resource exists in 37.7 — the mobile technician contract (43.18) is the priority surface; specify with the offline sync design.
**(19) Missing deployment considerations.** None material.
**(20) Missing documentation requirements.** Asset-category setup guide; technician mobile quick-reference (feeds 49.13).

---

## Chapter 37 — Public API & Integration Platform (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10 (API-as-product posture, sandbox, portal, deprecation policy — genuinely strong); Scalability 6/10; Maintainability 7/10; Security 7/10 (HMAC + replay protection + idempotency — best security specificity in the document); Cloud 7/10; Future Proof 7/10; Overall 7/10.

**(1) Missing architectural concepts.** API gateway decision (where authN, rate limiting, quotas physically execute — Kong/Envoy/cloud gateway; neither this chapter nor Ch 42 places it); event replay API ("give me events since cursor X" — the feature webhook consumers need most, because consumers *will* miss deliveries; absent); tenant model for API credentials (an API key belongs to an organization and is scoped to hotels — the multi-tenant key model interlocks the missing tenancy ADR).
**(2) Weak decisions.** Cursor pagination deferred to "future" (37.11) — for a *public* API, offset pagination becomes a permanent compatibility burden; make cursor the v1 contract; SDK breadth (37.22: six languages) — over-commitment; generate from OpenAPI (TS + Python first), expand by demand.
**(3) Missing enterprise best practices.** Breaking-change CI tooling (oasdiff/Spectral gates — 37.27's policy needs the machine); API versioning *of webhooks* (event payload evolution rules — 46.9 says "events remain versioned" for plugins; the public webhook contract needs the same statement); uptime SLA for the API as a product (enterprise integrators contract on it).
**(4) Scalability issues.** Webhook fan-out at scale (one busy hotel = thousands of events/day × N subscribers — delivery worker pool, per-endpoint circuit breaking on dead consumers, retry backpressure) — the outbound delivery infrastructure is unspecified.
**(5) Security concerns.** OAuth 2.0 named (37.5) — specify grant types (client credentials for servers; authorization code + PKCE if user-context apps come); scope taxonomy for tokens (read:reservations vs write:payments — 37.6 binds to RBAC; the public scope names are the contract, undefined); API-key display/rotation UX (show-once, rotation with overlap window).
**(6) Future limitations.** GraphQL/gRPC/event-streaming futures (37.28–29) are correctly deferred with rationale — no finding; rate-limit tiers by plan (free/partner/enterprise) — monetization interlock with the missing platform-billing spec.
**(7) Missing diagrams.** Gateway topology; webhook delivery pipeline with retry/DLQ; sandbox-vs-production environment map.
**(8) Missing business rules.** Data-visibility rules for partner apps (an OTA-connected partner sees which guest fields? — field-level scoping policy per scope); fair-use policy text (what triggers key suspension).
**(9) Missing technical standards.** Idempotency-key standard is named — add the storage/TTL/conflict-response spec (409 vs replay — pick replay); webhook event envelope schema (id, type, occurred_at, data, tenant) as a fixed contract.
**(10) Missing operational processes.** Partner incident communication (API outage → developer notification path, status-page integration 49.21); abuse response (key compromise procedure).
**(11) Missing governance.** API review board for new public endpoints (once public, forever public — the gate matters most here).
**(12) Missing engineering standards.** Public-API test suite as certification (the same tests partners' integrations are validated against in sandbox).
**(13) Missing monitoring.** 37.25 covers usage analytics — credit; add per-consumer error-rate alerting (partner integration breaks after a deploy → proactive outreach beats support tickets).
**(14) Missing observability.** Request-ID round-trip contract (client sends ID, all logs/traces carry it, support queries by it — 37.13 includes Request ID in responses; state the client-supplied propagation rule).
**(15) Missing automation.** SDK auto-generation + publication pipeline from OpenAPI; docs auto-deploy on spec merge (37.20 says docs update automatically — name the toolchain).
**(16) Missing AI opportunities.** AI-assisted integration debugging in the developer portal (paste a failing request, get the diagnosis) — differentiator-class, appropriately future.
**(17) Missing integrations.** None — this chapter *is* the integration surface.
**(18) Missing APIs.** The resource list (37.7) omits: Availability (the most-wanted public read), Rates, Webhook-subscription management as a resource — add all three.
**(19) Missing deployment considerations.** Sandbox infrastructure (persistent demo tenants, reset automation 37.23 — the reset machinery is an ops system of its own; assign ownership).
**(20) Missing documentation requirements.** Well-covered by 37.20/26 — credit; add integration-pattern cookbooks (build a channel connector, build a POS sync — task-oriented guides).

---

## Chapter 38 — Enterprise Integrations (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10; Enterprise 6/10; Scalability 6/10; Maintainability 6/10; Security 6/10; Cloud 6/10; Future Proof 7/10; Overall 6/10.

**(1) Missing architectural concepts.** Payment abstraction layer (38.6 names it — its interface contract: authorize/capture/refund/void/webhook-normalization across Stripe/Payme/Click, plus tokenization boundaries — is the platform's most consequential unwritten interface); secret-store technology decision (third mention in the document — Chs 12/41/42 all wait on it); integration-runtime placement (do connectors run in-process, as workers, or per-integration containers? — blast-radius and dependency-conflict question, unanswered).
**(2) Weak decisions.** "Last Write Wins" offered as a conflict mode (38.21) — silent data loss as a configurable default; require explicit opt-in with a warning and per-field granularity where possible.
**(3) Missing enterprise best practices.** Data-mapping governance (field mappings per provider API version — versioned, tested, migration-noted when providers deprecate); integration contract tests against recorded provider fixtures (providers change APIs; record/replay catches it before customers do).
**(4) Scalability issues.** Covered adequately by 38.30's posture plus the queue findings from Chs 30/32 — shared infrastructure, restated dependency.
**(5) Security concerns.** OAuth token refresh lifecycles per provider (expiry storms when a provider invalidates grants — refresh monitoring exists in 38.19; add expiry-horizon dashboards); least-privilege scopes requested per integration (wizard 38.17 should show and justify scopes — permission transparency for admins).
**(6) Future limitations.** Government-service integrations (38.3 lists the category; Ch 22.59's registration systems) — per-jurisdiction adapters with legal change-tracking; the category with the highest maintenance burden gets no special treatment.
**(7) Missing diagrams.** Integration-runtime topology; conflict-resolution decision flow; credential lifecycle.
**(8) Missing business rules.** Sync-scope defaults per category (accounting gets financial aggregates, not guest PII — data-minimization defaults per integration category).
**(9) Missing technical standards.** Connector interface (the internal SDK contract each integration implements — 38.26's Extension SDK is for partners; the *internal* connector standard is distinct and missing).
**(10) Missing operational processes.** Provider-deprecation response process (Booking.com announces API sunset → tracked migration project); integration health-check runbooks per category.
**(11) Missing governance.** Integration approval (connecting an accounting system = financial-data egress — owner-level approval, logged).
**(12) Missing engineering standards.** Sandbox accounts per provider maintained as team infrastructure (test credentials rot — ownership assignment).
**(13) Missing monitoring.** Covered well (38.24) — credit; add cost monitoring per integration (provider API fees, SMS costs — FinOps at integration granularity).
**(14) Missing observability.** Correlation ID across system boundaries (38.23 stores it — mandate propagation *into* provider calls where providers support it).
**(15) Missing automation.** Auto-disable on sustained auth failure with admin notification (state transition exists in 38.5; the automation rule doesn't).
**(16) Missing AI opportunities.** 38.28 (setup assistant) — appropriately future.
**(17) Missing integrations.** POS systems absent from 38.3's categories (restaurant/spa charges to room folio — the most-requested hotel integration after OTAs; glaring omission); door locks appear in 22.45/24.33 but not in the category registry — reconcile the lists.
**(18) Missing APIs.** Integration management API (list/configure/health) for enterprise IaC-style administration.
**(19) Missing deployment considerations.** Per-region provider availability (Payme/Click exist in UZ; Stripe doesn't — provider matrix per deployment region, ties 48.18).
**(20) Missing documentation requirements.** Per-integration setup guides (38.17 wizards + docs); provider compatibility matrix (versions, regions, features).

---

## Chapter 39 — AI Platform & Intelligent Assistant (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10 (orchestrator + permission-aware context + provider independence — the right skeleton); Enterprise 6/10; Scalability 6/10; Maintainability 6/10; **Security 5/10** (prompt injection and PII egress unaddressed); Cloud 6/10; Future Proof 8/10 (MCP awareness, RAG, governance — ahead of most 2026 specs); Overall 6.5/10.

**(1) Missing architectural concepts.** Prompt-injection defense (untrusted content — guest notes, OTA special requests, uploaded documents — enters context; injection via that content against a tool-capable assistant is the canonical attack: content/instruction separation, tool allowlists per role, output validation before any action, injection red-team suite); PII boundary layer (redaction/pseudonymization before provider egress + DPA per provider + regional inference routing to satisfy 48.20 residency); grounded-numbers rule (financial/operational figures must come from deterministic queries — the LLM narrates, never computes; without this rule the AI Financial Assistant 39.10 will eventually tell an owner a hallucinated revenue number).
**(2) Weak decisions.** None wrong; "AI never receives unnecessary information" (39.6) is the right principle — it needs the enforcement mechanism (context builder with field-level allowlists per feature, tested).
**(3) Missing enterprise best practices.** Evaluation framework (golden datasets per feature, regression evals on prompt/model changes, quality metrics — "explainable" needs measurement); model/prompt change management (a prompt edit is a behavior deploy — version, test, canary it: 39.28 versions prompts, nothing gates them); fallback UX when providers are down (degrade to non-AI paths gracefully — availability posture for a dependency you don't control).
**(4) Scalability issues.** Token-cost amplification (context engine stuffing reservation + guest + screen state per request — context budgets per feature; 39.30 tracks spend, nothing caps context size); vector-index freshness at scale (39.26 "remain synchronized" — the sync pipeline is another consumer of the missing event backbone).
**(5) Security concerns.** Tenant isolation of vector stores (per-tenant namespaces/keys — cross-tenant retrieval leakage is the worst possible AI bug; unstated); AI audit specificity (prompt + context fingerprint + response + actions taken — 39.3 ends in "Audit Log"; define the record); conversation-memory retention (39.27 "expires per policy" — bind to Ch 41.21's retention framework explicitly, AI conversations *are* listed there — credit for consistency).
**(6) Future limitations.** Agentic actions (39.2 forbids irreversible actions without authorization — good; the *authorization protocol* for AI-proposed actions — propose → human approve → execute with attribution "AI-proposed, human-approved" in audit — is the design that makes agents shippable later; sketch it now).
**(7) Missing diagrams.** Orchestrator sequence with trust boundaries marked (where untrusted content enters, where PII exits); RAG pipeline (ingest → chunk → index → retrieve → cite).
**(8) Missing business rules.** Which roles get which AI features (AI capabilities as permissions in the 29.8 catalog — implied by 39.7, not enumerated); human-review thresholds (which AI outputs require review before guest-facing use — 32.28 says "when required": define when).
**(9) Missing technical standards.** Provider adapter interface (the abstraction that makes 39.5's provider list real); citation format for RAG answers (39.25 "reference authoritative content" — the UI contract for citations).
**(10) Missing operational processes.** AI incident response (harmful/wrong output reported → triage, prompt fix, eval-suite addition — the feedback loop); provider outage runbook.
**(11) Missing governance.** 39.29 covers policy well — credit; add a model-risk register (which features use which models with which failure modes — the artifact enterprise AI governance reviews ask for).
**(12) Missing engineering standards.** Prompt-engineering conventions (structure, variable injection, language handling); eval-first development rule for AI features.
**(13) Missing monitoring.** Quality metrics in production (thumbs-up rate, correction rate, retrieval hit rate) — 39.30 counts cost; nothing counts quality.
**(14) Missing observability.** Full request tracing through the orchestrator (context assembly → provider latency → validation) — the debugging surface for "why did it say that."
**(15) Missing automation.** Eval runs on every prompt/model change (CI for AI behavior).
**(16) Missing AI opportunities.** N/A — the chapter is the opportunity catalog, and it's comprehensive.
**(17) Missing integrations.** Provider list (39.5) is sound; local/on-prem model deployment for data-sovereign customers — listed ("Local Models") — needs a feasibility note (GPU infra vs Ch 42's stack; one line prevents a sales promise engineering can't keep).
**(18) Missing APIs.** AI features via public API (partner apps invoking AI search/summaries — quota and billing implications) — explicitly defer or design; silence invites scope creep.
**(19) Missing deployment considerations.** Regional inference routing (EU tenant → EU inference endpoint) — named above under PII; it is also an infrastructure topology item for Ch 42/48.
**(20) Missing documentation requirements.** AI transparency documentation (what the AI can access, per feature — for enterprise security reviews *and* end-user trust); AI section of the user guide (capability boundaries honestly stated).

---

## Chapter 40 — Data Platform, Analytics & Business Intelligence (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10 (right shape: separation, semantic layer, RLS, lineage); Enterprise 5/10; Scalability 5/10 (no technology, no numbers reachable); Maintainability 5/10 (no transform tooling = untestable pipelines); Security 6/10 (RLS + catalog sensitivity — credit); Cloud 5/10; Future Proof 6/10; Overall 5.5/10.

**(1) Missing architectural concepts.** Every technology decision: warehouse (Postgres-based for Stage 1 → ClickHouse/BigQuery at scale), ingestion (CDC/Debezium vs the event stream vs batch ELT — deeply coupled to the outbox decision), transformation (dbt-class tooling with tested models), orchestration (Dagster/Airflow); dimensional model (facts: reservations-nights, folio postings, payments; dimensions: date, room, room-type, guest, source, hotel — grain statements per fact table; the warehouse's actual design, absent); data contracts (producing modules guarantee event/table schemas with evolution rules — otherwise every upstream refactor silently breaks dashboards).
**(2) Weak decisions.** "Historical data remains immutable" (40.4) — correct for facts, but GDPR erasure must propagate (anonymize dimensions, keep aggregates) — the same Ch 23 collision, restated because the warehouse is where erasure is hardest.
**(3) Missing enterprise best practices.** Data-quality testing (freshness, uniqueness, referential checks with alerting — dbt tests-class); backfill/reprocessing procedures (bug in transform → recompute history — the operation every pipeline needs and no one specifies); environment separation for analytics (dev/staging warehouses with synthetic data).
**(4) Scalability issues.** "Billions of records / real-time" (40.32) — cost and architecture unbridged to any stage (D-5's sharpest instance); real-time (40.6) vs batch boundaries per dashboard (which widgets are streaming, which hourly — freshness SLA table).
**(5) Security concerns.** PII minimization in the warehouse (analytics rarely needs names/passports — pseudonymous keys by default, PII join only for authorized use cases); export controls on warehouse egress (38.11 BI tools read it — DLP at the analytics boundary).
**(6) Future limitations.** ML feature infrastructure (Chs 34/39 forecasting will need features/backtests — the platform should declare whether it serves ML or only BI; scope now, or two data platforms will grow).
**(7) Missing diagrams.** Pipeline architecture (sources → ingestion → staging → marts → semantic → consumers); dimensional model ERD.
**(8) Missing business rules.** The KPI dictionary (third and final owner candidate — put it here, referenced by 20/26/27/34); business-date alignment (warehouse dates = hotel business dates — the Ch 48.10 finding propagates here; occupancy by UTC date is simply wrong data).
**(9) Missing technical standards.** Naming conventions for datasets/models; slowly-changing-dimension policy (room type changes → SCD2 for historical accuracy — ties the Ch 24 effective-dating finding).
**(10) Missing operational processes.** Pipeline-failure runbook (stale dashboard SLA, comms to affected users); cost management for analytics compute.
**(11) Missing governance.** Data ownership per domain (each module owns its marts' correctness — data-mesh-lite accountability); access-request workflow for analysts.
**(12) Missing engineering standards.** Transform code review + tests as merge gates (analytics code is code).
**(13) Missing monitoring.** Freshness/volume anomaly alerts per dataset; semantic-layer query performance.
**(14) Missing observability.** Lineage (40.30) — credit; add usage tracking per dataset (deprecate unused marts).
**(15) Missing automation.** Scheduled quality reports; auto-documentation from the semantic layer into the catalog.
**(16) Missing AI opportunities.** 40.24 insights — adequately scoped; natural-language query (39.13) should compile through the *semantic layer* (governed definitions), not raw SQL — the one-line rule that keeps NL-BI trustworthy.
**(17) Missing integrations.** BI tools listed (38.11) — the access mechanism (SQL endpoint? governed views?) undefined in both chapters.
**(18) Missing APIs.** Metrics API (programmatic KPI access for partners/embedded use) — reserve it.
**(19) Missing deployment considerations.** Warehouse region vs data residency (48.20 — tenant data in-region includes analytical copies; multi-region warehouse strategy is hard and unmentioned).
**(20) Missing documentation requirements.** Data dictionary/catalog population standards (40.29 names the catalog — the authoring discipline fills it); analyst onboarding guide.

---

## Chapter 41 — Enterprise Security, Compliance & Governance (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10 (Zero Trust, RBAC+ABAC, risk engine, SIEM — right breadth); Enterprise 6/10 (compliance treated as feature, not program); Scalability 6/10; Maintainability 6/10; Security 6/10 (practice-layer gaps: threat modeling, vuln mgmt, supply chain, WAF); Cloud 6/10; Future Proof 7/10; Overall 6.5/10.

**(1) Missing architectural concepts.** Edge protection (WAF, DDoS, bot management — absent from the entire document while Chs 31/37 expose public surfaces); the policy engine (41.3 shows "Policy Engine" in the pipeline — same unmade decision as Ch 29; one engine must serve both); per-tenant encryption keys (enabler for crypto-shredding — Ch 23 — and enterprise BYOK asks).
**(2) Weak decisions.** None wrong; ambition without practice layer is the pattern.
**(3) Missing enterprise best practices.** Threat-modeling practice (STRIDE per module at design time, findings tracked); vulnerability management SLAs (critical CVE → patched in X days; scanner → triage → verify pipeline); penetration-test cadence + remediation SLAs; responsible-disclosure/bug-bounty policy; supply-chain security (SBOM, pinned dependencies, artifact signing, CI hardening — SLSA-informed).
**(4) Scalability issues.** Risk engine (41.23) real-time scoring per session at scale — event pipeline dependency, unbound; SIEM streaming volume/cost governance.
**(5) Security concerns.** DLP futures (clipboard/screenshot controls 41.19) — flag as end-point-management territory (realistic only for managed devices, ties 43.22 MDM); honest scoping prevents a paper control.
**(6) Future limitations.** Compliance-as-program: SOC 2 Type II and ISO 27001 are 12–18-month organizational undertakings (policies, evidence, auditors) — the spec treats them as architecture attributes; the roadmap dependency (start before enterprise sales) is the finding.
**(7) Missing diagrams.** Trust-boundary diagram (the security diagram — where untrusted input enters, tenant boundaries, secret perimeters); incident-response swimlanes.
**(8) Missing business rules.** Data-classification → handling matrix (41.18 defines five levels; the per-level rules — encryption, export, retention, AI-context eligibility — are the useful half, absent).
**(9) Missing technical standards.** Secure-coding standard reference (OWASP ASVS level target); crypto standards doc (approved algorithms, TLS config, key lengths — 41.12 names AES-256/TLS; the full profile belongs in the Security Handbook).
**(10) Missing operational processes.** Security on-call and alert triage runbooks; access-review campaigns (cross-ref 29); vendor security assessment process (for the Ch 38 provider list).
**(11) Missing governance.** Security review gate in SDLC (50.4 lists "Security Reviews" — trigger criteria: what changes require one); risk-acceptance process (who signs residual risk, with expiry).
**(12) Missing engineering standards.** Security test requirements per module (44.13 exists — bind ASVS-derived checklists).
**(13) Missing monitoring.** 41.14/41.16 dashboards — credit; add detection-coverage mapping (which attack techniques are actually detectable — ATT&CK-informed honesty about blind spots).
**(14) Missing observability.** Security-event taxonomy standard (normalized event schema for SIEM — 41.24 streams; the schema makes it usable).
**(15) Missing automation.** Automated compliance-evidence collection (access reviews, backup attestations, deploy approvals auto-archived — the difference between painful and routine audits).
**(16) Missing AI opportunities.** Anomaly detection is covered (41.23/39.18); AI-assisted alert triage — future, fine.
**(17) Missing integrations.** SIEM list (41.24) — credit; add SOAR hooks (automated response playbooks) as future.
**(18) Missing APIs.** Security-events export API for enterprise customers' own SOCs (they will ask).
**(19) Missing deployment considerations.** Security posture per evolution stage (Stage-1 Render reality vs this chapter's aspirations — an honest current-state assessment prevents false assurance).
**(20) Missing documentation requirements.** Security Handbook, incident-response plan, compliance roadmap (Missing Documents #7/#15); trust-center page content (public security posture — sales artifact).

---

## Chapter 42 — DevOps, Platform Engineering & Infrastructure (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 6/10; Scalability 7/10; Maintainability 6/10; Security 6/10; Cloud 7/10; Future Proof 7/10; Overall 6.5/10.

**(1) Missing architectural concepts.** The Stage-1→Stage-N bridge (this chapter describes the destination; the document deploys on Render today — per-stage infrastructure definitions with promotion triggers, the D-5 resolution, belongs here); DB-migration-under-CD discipline (expand/contract, decoupled schema/code deploys, rollback-with-migration procedure — the hardest zero-downtime problem, unaddressed); API gateway placement (third chapter that implies one).
**(2) Weak decisions.** Multi-cloud "no vendor lock-in" (42.30) as an absolute — multi-cloud portability has real costs (lowest-common-denominator services); the pragmatic stance (portable core, provider-managed databases/queues accepted with exit plans) deserves an ADR rather than a slogan.
**(3) Missing enterprise best practices.** Environment-promotion policy (what qualifies a build for staging→prod beyond 44's gates — bake time, approval); infrastructure testing (Terraform plan review, policy-as-code — OPA/Sentinel on infra changes); golden-path templates (new service scaffold with observability/security baked in — platform engineering's actual product).
**(4) Scalability issues.** Kubernetes workload multi-tenancy (namespace strategy, per-tenant quotas — the infra face of the tenancy ADR); database scaling path (managed Postgres → replicas → partitioning → the day sharding is discussed — the data-tier growth story is nobody's chapter).
**(5) Security concerns.** CI/CD supply chain (runner isolation, secret scoping in pipelines, artifact signing — cross-ref 41 finding 3); cluster security baseline (Pod Security Standards, network policies, image policy) — one line each suffices at spec level, zero lines exist.
**(6) Future limitations.** Serverless posture (none stated — fine; state it to prevent drift).
**(7) Missing diagrams.** Deployment topology per environment per stage; pipeline flow with gates; network diagram (zones, ingress/egress).
**(8) Missing business rules.** Maintenance-window policy (hotels run 24/7 — zero-downtime is not optional; deploy freeze during regional peak seasons — an operations-business rule the platform should encode).
**(9) Missing technical standards.** SLO targets with numbers (42.25 lists the acronyms — fill: API availability 99.9%, P95 targets per class); resource-request/limit standards; image standards (distroless, non-root).
**(10) Missing operational processes.** On-call rotation, paging policy, alert-severity matrix, escalation (Ch 49 covers *customer* support; nobody owns the pager — the largest operational gap in the volume); incident command process for platform incidents (45.18 has response stages — assign the roles).
**(11) Missing governance.** Infra change approval (prod Terraform applies — who, when, with what review); cost governance (42.28 tracks — budgets and alerts per team/tenant close the loop).
**(12) Missing engineering standards.** Runbook-as-code convention (alerts link to runbooks — enforced metadata); Terraform module standards.
**(13) Missing monitoring.** Alert catalog with severities and runbook links (42.22 "alerts generated automatically" — the catalog is the deliverable); synthetic monitoring (external probes of booking flow/API from multiple regions — user-perspective uptime).
**(14) Missing observability.** Trace-sampling policy (100%? tail-based? — cost/utility decision); observability-data retention tiers.
**(15) Missing automation.** Auto-rollback on error-budget burn (44.28 monitors, 42.9 can roll back — wire the trigger); dependency-update automation (Renovate) platform-wide.
**(16) Missing AI opportunities.** AIOps (anomaly detection on golden signals) — future, fine.
**(17) Missing integrations.** Status page automation (incident → 49.21 status page — manual updates during incidents always lag; automate).
**(18) Missing APIs.** Internal platform API (deploy status, feature flags, tenant ops — the 12.20/48 admin surface; assign ownership).
**(19) Missing deployment considerations.** The chapter is deployment — the gap is sequencing (per-stage reality, once more).
**(20) Missing documentation requirements.** Infrastructure guide per stage (Missing Documents #9); on-call handbook (#10); architecture-runtime docs auto-generated from IaC (drift-proof documentation).

---

## Chapter 43 — Mobile Platform & Offline Architecture (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10 (right priorities: offline-first for field roles, encrypted local store, MDM); Enterprise 5/10; Scalability 6/10; Maintainability 5/10 (framework undecided = everything undecided); Security 6/10; Cloud 6/10; Future Proof 6/10; Overall 5.5/10.

**(1) Missing architectural concepts.** Framework ADR (React Native vs Flutter vs native — determines hiring, offline DB options, web code sharing, delivery pipeline; the chapter's foundational decision, absent); sync-protocol design (43.8/43.16 name capabilities — the actual protocol: per-entity version vectors or server-sequenced op logs, tombstones for deletes, idempotent server apply, and *schema migration of queued offline operations* when the app updates — one of the hardest problems in the document, currently one sentence); offline scope boundary (payments/refunds/check-in-with-payment must be online-only — an offline payment that fails to sync is lost money; the line is never drawn).
**(2) Weak decisions.** "Mobile is not a simplified web app" (43.2) — right sentiment; ensure it doesn't fork business logic (validation/rules shared via API contracts, not reimplemented per platform — state the single-source rule).
**(3) Missing enterprise best practices.** Release engineering (app-store review latency vs continuous backend deploys — API version-skew tolerance policy: server supports app versions N and N−1; forced-upgrade mechanism for security fixes); certificate pinning policy; jailbreak/root detection posture (with MDM interplay).
**(4) Scalability issues.** Sync-storm behavior (Monday morning: 500 housekeepers reconnect and sync — server-side sync endpoint throughput and backoff coordination).
**(5) Security concerns.** Offline authorization staleness (revoked employee keeps working offline — offline lease/expiry: cached credentials valid ≤N hours); local-data scope minimization (43.7 "permitted data only" — define per role: housekeeper device holds task data, never guest financials); device-loss procedure (remote wipe exists 43.22 — the *response runbook* and guest-data breach-assessment linkage don't).
**(6) Future limitations.** Guest-facing mobile app (the chapter is staff-only — correctly scoped; say explicitly that guest mobile is a separate future product so nobody bolts it onto the staff app).
**(7) Missing diagrams.** Sync-protocol sequence (offline op → queue → reconnect → conflict → resolution); offline data-scope map per role.
**(8) Missing business rules.** Conflict-resolution *defaults per entity type* (43.9 lists five policies — bind them: room status = server wins; checklist completion = client wins; notes = merge; the table is the deliverable).
**(9) Missing technical standards.** Offline DB choice (SQLite/WatermelonDB/Realm — follows framework ADR); sync payload format (versioned, compressed).
**(10) Missing operational processes.** App-release train (cadence, beta channels, staged rollout %); crash-triage ownership (43.24 collects — who acts).
**(11) Missing governance.** App-store account/signing-key custody (a real single-point-of-failure — key escrow policy).
**(12) Missing engineering standards.** Mobile test strategy (device farm, offline-scenario test suite — 44 covers web/API; mobile E2E is its own discipline, unmentioned in either chapter).
**(13) Missing monitoring.** Sync success-rate and pending-queue-age metrics (a housekeeper's unsynced completions aging = the incident to catch); 43.23 covers usage analytics — credit.
**(14) Missing observability.** Offline-session diagnostics (operation logs shipped on reconnect for support debugging).
**(15) Missing automation.** None material beyond release automation (10).
**(16) Missing AI opportunities.** None material at architecture level.
**(17) Missing integrations.** Push infrastructure (FCM/APNs — implied by 43.10 via 38.8's FCM mention; note APNs explicitly); MDM vendors (43.22 — name the integration standard, e.g., AppConfig).
**(18) Missing APIs.** The mobile sync API contract (delta endpoints, batch op submission) — the platform's second-most-critical unwritten contract after the calendar data API.
**(19) Missing deployment considerations.** Covered under release engineering (3/10).
**(20) Missing documentation requirements.** Mobile developer guide; field-staff quick-start (translated — the housekeeping persona reads Uzbek/Russian, ties 48.9).

---

## Chapter 44 — Quality Engineering, Testing & Release Management (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10; Scalability 7/10; Maintainability 7/10; Security 7/10; Cloud 7/10; Future Proof 7/10; Overall 7/10. With Ch 45, the most complete process chapter.

**(1) Missing architectural concepts.** Contract testing (consumer-driven, Pact-class — web, mobile, public-API consumers, and plugins all consume one backend; the highest-leverage missing test type for this topology); **concurrency/invariant test suite as a first-class category** (parallel booking of one room, parallel payments on one folio, shift-close races — the tests that verify the document's core promises; no category in 44.3's pyramid owns them).
**(2) Weak decisions.** None — the pyramid, gates, and canary/blue-green validation are orthodox and right.
**(3) Missing enterprise best practices.** Numbers for gates (coverage %, P95 thresholds, flake budgets — gates without thresholds are ornaments); flaky-test policy (quarantine workflow, ownership, fix SLA — the thing that actually preserves CI trust); test-impact analysis at scale (run affected tests on PR, full suite on merge — keeps 44.30's "thousands of tests" fast).
**(4) Scalability issues.** Test-environment cost/contention (44.18 lists six environments — ephemeral preview environments per PR vs shared staging: the modern answer, unmentioned).
**(5) Security concerns.** Anonymized-production-data standard (44.17 permits it — define the anonymization method and verification, or it's a compliance hole; GDPR applies to test data too).
**(6) Future limitations.** Plugin/marketplace testing (46.17's app review needs an automated test harness for third-party extensions — neither chapter owns it).
**(7) Missing diagrams.** Pipeline-with-gates diagram; environment topology.
**(8) Missing business rules.** Release-freeze windows (regional high seasons, New Year — hotel-business-aware release calendar).
**(9) Missing technical standards.** Test-naming/structure conventions; fixture/factory standards (one blessed way to make a test reservation); seed-data versioning.
**(10) Missing operational processes.** Hotfix path (expedited pipeline with post-hoc review — production burns sometimes; the exception process prevents gate-bypassing culture); release-notes production workflow (47.18 defines content; who writes, when).
**(11) Missing governance.** Quality-gate exception approval (who may ship with a failing gate, logged with expiry).
**(12) Missing engineering standards.** Test-code review standards (test code is code); mutation testing consideration for the money/reservation cores (coverage lies; mutation scores don't — worth it for the two critical modules).
**(13) Missing monitoring.** CI health metrics (pipeline duration, queue time, flake rate) as team-facing SLOs.
**(14) Missing observability.** Test-failure analytics (which modules fail most — investment signal); 44.27's DORA metrics — credit.
**(15) Missing automation.** Auto-bisection of regressions; PR preview environments (again — the automation with the highest developer-experience yield).
**(16) Missing AI opportunities.** AI-assisted test generation for the permission matrix (29.16 × endpoints = thousands of cases — mechanical, generatable); flaky-test triage assistance.
**(17) Missing integrations.** Device farms for mobile (43 finding 12 — shared).
**(18) Missing APIs.** None material.
**(19) Missing deployment considerations.** Covered by the chapter — credit.
**(20) Missing documentation requirements.** Test strategy doc per module (which risks are covered where); QA onboarding runbook.

---

## Chapter 45 — Disaster Recovery, Backup & Business Continuity (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10; Scalability 7/10; Maintainability 7/10; Security 7/10 (immutable + air-gapped + encrypted backups — best-practice complete); Cloud 7/10; Future Proof 7/10; Overall 7/10. Quantified RTO/RPO is the document's best NFR moment.

**(1) Missing architectural concepts.** Third-party dependency continuity (payment gateway down, OTA down, SMS provider down — hotel business continuity is mostly *degraded-mode operations*: offline check-in procedure, cash-only mode, manual room board; 45.24's BIA should explicitly enumerate external dependencies and their degraded modes); per-tenant recovery (customer admin deletes everything → restore *one tenant* to T-1 without touching others — a different and harder problem than platform DR; multi-tenant PITR granularity depends on the tenancy ADR and is unmentioned).
**(2) Weak decisions.** None — the strategy content is orthodox and correct.
**(3) Missing enterprise best practices.** Restore-test *frequency* commitments (45.25 "regularly" — write quarterly-full/monthly-sample); disaster-declaration authority matrix (who declares, who decides failover — 45.14 classifies; the authority column is missing); backup monitoring *of the monitoring* (silent backup-job death is the classic failure — heartbeat-style dead-man alerts).
**(4) Scalability issues.** Backup windows and restore duration at data scale (RTO of 15 minutes for critical systems requires warm standby, not backup-restore — the RTO table implies architecture per tier; make the implication explicit so nobody thinks nightly dumps satisfy a 15-minute RTO).
**(5) Security concerns.** Backup access control (backups are full-PII copies — access to restore = access to everything; separate credentials named for air-gap 45.21 — extend the principle to all tiers); ransomware runbook specifically (immutable backups are the control — the response procedure is the process; 45.20 has the control, not the procedure).
**(6) Future limitations.** Data-residency-constrained DR (EU tenant's DR copy must stay in-region — 48.20 interlock; DR region selection per residency zone, unaddressed).
**(7) Missing diagrams.** Replication/failover topology per stage; recovery decision tree (incident class → runbook).
**(8) Missing business rules.** Data-loss communication policy (RPO consumed: 5 minutes of reservations lost — customer notification obligations, re-entry procedure); SLA credits linkage (49.8 SLAs × availability incidents — the commercial consequence mapping).
**(9) Missing technical standards.** Backup encryption/key custody specifics (keys must not live with the backups — stated for air-gap; generalize); runbook format standard (45.17 lists contents — good; add the testing-attestation field).
**(10) Missing operational processes.** Chapter's strength — drills, runbooks, reviews all present; add game-day cadence with rotating scenarios and *unannounced* elements (announced drills overfit).
**(11) Missing governance.** BCP ownership role; annual BIA refresh requirement; board/management reporting on recovery posture (enterprise governance asks).
**(12) Missing engineering standards.** Recovery automation as code (runbook steps scripted where possible — manual runbooks rot; scripted ones get tested by execution).
**(13) Missing monitoring.** Replication-lag alerts against RPO budgets (RPO 5 min + lag 7 min = already in breach before any disaster — the alert that makes RPO real).
**(14) Missing observability.** Recovery-readiness dashboard exists (45.13) — credit; add per-tier RTO/RPO attainment tracking from drills (measured, not aspired).
**(15) Missing automation.** Automated failover exists (45.9); add automated restore verification (periodic restore-to-sandbox with checksum/row-count validation — 45.12 requires verification; automate it).
**(16) Missing AI opportunities.** None material — determinism again.
**(17) Missing integrations.** Status page + notification center during DR (comms automation under degraded infrastructure — the status page must not depend on the failed platform; external hosting note).
**(18) Missing APIs.** None material.
**(19) Missing deployment considerations.** DR environment cost strategy (pilot-light vs warm standby vs hot — per stage and tier; the money question the RTO table implies).
**(20) Missing documentation requirements.** DR procedures document with drill attestations (Missing Documents #14); customer-facing continuity summary (enterprise procurement artifact).

---

## Chapter 46 — Extensibility, Marketplace & Plugin Ecosystem (Parts 1–2)

**Scores & deduction rationale:** Architecture 6/10; Enterprise 6/10; Scalability 6/10; Maintainability 6/10; Security 6/10 (signing + scanning + permissions — good instincts; runtime undefined); Cloud 6/10; Future Proof 8/10; Overall 6/10.

**(1) Missing architectural concepts.** Sandbox runtime ADR (V8 isolates vs WASM vs containers vs **webhook/iframe-hosted** — each has order-of-magnitude different security/latency/cost; recommendation: start webhook+iframe — extensions run on the partner's infrastructure, LBL provides APIs/events/UI slots — the Shopify/Slack path that defers the hardest problem); UI-extension isolation model (third-party frontend code → sandboxed iframes with postMessage contracts + CSP; 46.10 lists extension points with no isolation design); extension data-store contract (46.13 "Storage API" — quotas, tenancy, backup/restore inclusion, deletion on uninstall).
**(2) Weak decisions.** Both in-process capabilities (46.7's sandbox restrictions imply in-process execution) *and* marketplace-scale third-party distribution in one phase — sequencing risk; the runtime ADR should stage them.
**(3) Missing enterprise best practices.** Kill-switch propagation SLA (compromised extension → disabled everywhere in minutes — 46.29 lists revocation; the latency target and mechanism are the control); plugin data-processing agreements (installing a plugin makes its vendor a processor of guest PII — DPA flow, scope-consent screens, offboarding data deletion; the legal architecture of the marketplace, absent).
**(4) Scalability issues.** Event fan-out to plugins (busy hotel × N installed plugins × M subscribed events — same delivery infrastructure as public webhooks 37.16; state that they share it).
**(5) Security concerns.** Review + scanning (46.17/46.26) — credit; add runtime behavioral monitoring (post-approval malice/compromise — anomalous API usage per extension, alerting); permission-escalation on update (new version requests more scopes → re-consent required, not silent grant; 46.19 checks compatibility, not permission diffs).
**(6) Future limitations.** Extension-to-extension interop (plugins consuming each other's data — combinatorial permission problem; explicitly forbid until designed).
**(7) Missing diagrams.** Runtime topology per extension type; permission-grant flow; marketplace publish pipeline.
**(8) Missing business rules.** Refunds for paid extensions (46.24 lists refunds — grounds/mechanics per 46.21 license models); trial-expiry behavior (data written during trial after lapse — retained read-only? deleted?); revenue-share percentages and payout terms (governance placeholder needed, not numbers).
**(9) Missing technical standards.** Manifest schema (46.6 lists fields — versioned JSON schema is the contract artifact); extension API-surface freeze policy (which platform APIs are extension-stable vs internal — the boundary that makes "no core modifications" true).
**(10) Missing operational processes.** Marketplace support triage (plugin breaks a customer — LBL support vs vendor support boundary, SLA hand-off; 49's ticket flow needs a partner lane).
**(11) Missing governance.** 46.29 covers moderation — credit; add conflict-of-interest policy (LBL first-party extensions competing with partners — platform-neutrality stance, the trust foundation of any marketplace).
**(12) Missing engineering standards.** Extension development standards published with the SDK (lint rules, security checklist — the partner-facing engineering bar).
**(13) Missing monitoring.** Per-extension health (46.25 analytics — credit; bind customer-facing status: "this plugin is failing" visible to the org admin, not just the vendor).
**(14) Missing observability.** Extension-attributed audit (actions taken by plugin X on behalf of org Y — 46.5 audits lifecycle; runtime actions need attribution in the main audit trail).
**(15) Missing automation.** Auto-suspend on anomalous behavior; compatibility re-validation on platform releases (46.19 checks at install — platform upgrades must re-check the installed base).
**(16) Missing AI opportunities.** AI review-assist for marketplace submissions (static analysis summarization) — future, fine.
**(17) Missing integrations.** Marketplace payments (partner payouts — ties the missing platform-billing spec; 46.24 stores records, nothing moves money).
**(18) Missing APIs.** The extension-facing API surface itself (which subset of Ch 37 + which extension-only APIs — the SDK's actual contents; 46.13 lists categories, not contracts).
**(19) Missing deployment considerations.** Extension asset hosting/CDN (UI bundles served from where, versioned how).
**(20) Missing documentation requirements.** Partner developer guide, review-criteria publication (46.17's checklist made public — fairness and quality both improve), marketplace policies document.

---

## Chapter 47 — Product Management, Feature Lifecycle & Roadmap (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10; Maintainability 7/10; Future Proof 7/10; Overall 7/10. Process-complete; findings are about activation, not design.

**(1) Missing architectural concepts.** Product-analytics event pipeline (47.14's metrics need client/server instrumentation, an event taxonomy, and storage — the same missing telemetry as Chs 11/31; three chapters wait on one unbuilt pipeline — assign it to Ch 40).
**(2) Weak decisions.** None.
**(3) Missing enterprise best practices.** ADR practice activation (47.21 prescribes; zero exist — seed retroactively with the ~15 foundational decisions this review names); RFC-to-ADR linkage rules (which RFCs must conclude in ADRs).
**(4) Scalability issues.** None material.
**(5) Security concerns.** Feedback-hub PII (customer feedback contains guest stories — retention/scrubbing policy for 47.16).
**(6) Future limitations.** Multi-product roadmap governance (when clinics/warehouses arrive per 50.2 — portfolio-level prioritization across verticals; the framework is single-product today; one paragraph future-proofs it).
**(7) Missing diagrams.** Lifecycle flow with gate criteria between states.
**(8) Missing business rules.** Deprecation timelines quantified (47.19 stages without durations — "minimum 6 months' notice for breaking changes" is the kind of number customers contract on).
**(9) Missing technical standards.** Feature-flag naming/lifecycle standard (max lifetime, cleanup owner — flag debt is real debt).
**(10) Missing operational processes.** Beta-program operations (47.11/47.26 — enrollment, feedback SLA, exit criteria).
**(11) Missing governance.** 47.22 covers it — credit.
**(12) Missing engineering standards.** Definition-of-Done alignment (every chapter has "Definition of Completion" — bind them to 47.4's lifecycle states so "Released" means the checklist passed; the meta-connection between the document's own DoCs and its process chapter is missing).
**(13) Missing monitoring.** Adoption-metric plumbing (same as finding 1).
**(14) Missing observability.** Experiment-integrity monitoring (sample-ratio mismatch detection for 47.12's A/B tests — the check that keeps experiment results honest).
**(15) Missing automation.** Changelog generation from conventional commits/PR labels (47.17's discipline, automated).
**(16) Missing AI opportunities.** Feedback clustering/deduplication (47.16 at volume) — cheap, real.
**(17) Missing integrations.** Feedback-hub ↔ support-ticket linkage (49.6) — stated as "linked where applicable"; define the mechanism.
**(18) Missing APIs.** None material.
**(19) Missing deployment considerations.** Covered via flags/experiments.
**(20) Missing documentation requirements.** 47.28 covers the catalog — credit; add the RFC/ADR templates as artifacts (25.607/25.631 list contents — publish the templates).

---

## Chapter 48 — Globalization, Localization & Multi-Tenant Enterprise (Parts 1–2)

**Scores & deduction rationale:** Architecture 5/10 (owns the platform's biggest unmade decision); Enterprise 5/10; Scalability 5/10; Maintainability 5/10; Security 5/10; Cloud 6/10; Future Proof 6/10; Overall 5/10.

**(1) Missing architectural concepts.** **The tenancy ADR** (pooled+RLS / schema-per-tenant / DB-per-tenant / tiered — stated for the final time: this chapter claims isolation "at every architectural layer" 48.4 and never chooses the layer mechanics; everything else here — residency 48.20, migration 48.23, per-tenant restore, noisy-neighbor control — is downstream); tenant provisioning automation (signup → functioning tenant in minutes: migrations, seeds, domains, quotas — the operational heart of SaaS, unspecified); per-tenant encryption keys (BYOK path for enterprise, crypto-shredding enabler).
**(2) Weak decisions.** **48.10 "store timestamps in UTC" applied universally** — correct for instants (payments, logins), *wrong for stay dates*: a hotel night is a business date in hotel-local terms rolling at the night-audit hour, not midnight UTC; arrival "2026-07-02" must never shift by viewer timezone. Reservations, occupancy, and revenue attribution need explicit DATE + hotel-timezone modeling. Misapplied UTC here permanently corrupts occupancy/revenue data — a subtle, expensive, irreversible class of bug. Interlocks the Night Audit gap (Ch 22).
**(3) Missing enterprise best practices.** Translation operations (TMS, translator workflow, review, glossary, AI-translation QA — 48.9's language packs are the artifact; the pipeline that fills them is the work); locale QA matrix (pseudo-localization testing to catch layout breaks before real translations).
**(4) Scalability issues.** Cross-region replication (48.19) vs residency (48.20) tension — replicating for availability while honoring "data stays in region" requires region-scoped replication topologies per tenant class; the two sections contradict silently.
**(5) Security concerns.** Cross-tenant administration (48.22) — elevated platform-staff access to customer data needs the same consent/time-box/audit regime as support impersonation (Ch 49 finding); tenant-migration integrity (48.23 — checksum verification, downtime windows, rollback).
**(6) Future limitations.** Tax-engine depth (48.13 lists tax types — real jurisdictions need compound taxes, tax-on-tax, exemptions, registration thresholds; scope honestly: built-in basics + integration path to tax services); federation (48.26) correctly deferred.
**(7) Missing diagrams.** Tenancy model (the ADR's diagram); region topology with residency zones; config-inheritance tree (shared with Ch 28).
**(8) Missing business rules.** Tenant-suspension semantics (nonpayment → suspended: staff locked out, but guests still need check-out? — grace behavior protecting *hotel guests* from the *hotel's* billing dispute; a hospitality-specific suspension policy the generic SaaS playbook doesn't cover); organization merge/split (48.23 names them — data-ownership rules within).
**(9) Missing technical standards.** Locale data standards (CLDR-based formatting, ICU message format for pluralization — 48.7 lists requirements; name the standards); currency-precision table (JPY 0 decimals, BHD 3 — ties the Ch 26 money standard).
**(10) Missing operational processes.** Regional launch checklist (new region = residency setup, providers, tax rules, language, legal review); tenant lifecycle runbooks (48.28's states — the procedures between them).
**(11) Missing governance.** 48.30 covers global governance — credit; add residency-commitment tracking (which tenants were promised which regions — a contractual register).
**(12) Missing engineering standards.** i18n lint rules (no hardcoded strings — CI-enforced); timezone-handling code standards (the "no naive datetime" rule).
**(13) Missing monitoring.** Per-region health dashboards; replication-lag per region against residency-safe topologies.
**(14) Missing observability.** Tenant dimension on all telemetry (shared with Ch 28 finding — stated once more because this chapter owns tenancy).
**(15) Missing automation.** Provisioning (finding 1); SSL automation exists (48.17 — credit); DNS-verification automation for custom domains.
**(16) Missing AI opportunities.** AI-assisted translation with human review for language packs — cheap, appropriate.
**(17) Missing integrations.** Exchange-rate providers (48.12 lists sources — name the integration contract); tax services (Avalara-class) as the tax-engine escape hatch.
**(18) Missing APIs.** Tenant-administration API (provisioning, configuration — for enterprise customers' own automation and for 49's tooling).
**(19) Missing deployment considerations.** Region rollout order and per-region cost model (which regions at which customer thresholds — the FinOps face of 48.18).
**(20) Missing documentation requirements.** Localization guide for translators; residency/compliance matrix per region (sales + legal artifact); tenancy ADR (the document the whole chapter awaits).

---

## Chapter 49 — Enterprise Operations, Support & Customer Success (Parts 1–2)

**Scores & deduction rationale:** Architecture 7/10; Enterprise 7/10; Scalability 7/10; Maintainability 7/10; Future Proof 7/10; Overall 7/10. ITIL-shaped and internally consistent.

**(1) Missing architectural concepts.** Support-tooling integration with the platform (the one architectural feature support needs: **impersonation/"view as tenant"** — consented, time-boxed, fully audited, PII-scoped; without it support either can't see the problem or gets dangerous raw DB access; security-critical and absent); support-data boundary (what customer data support tools may hold — tickets contain guest PII → retention/scrubbing).
**(2) Weak decisions.** None.
**(3) Missing enterprise best practices.** Platform on-call vs customer support separation (this chapter owns tickets; nobody owns the pager — assign platform incident response to 42, integrate escalation here; the seam is the gap); support-tier definitions (L1/L2/L3 skills and hand-off criteria — 49.9 escalates by title; the capability matrix makes it real).
**(4) Scalability issues.** Support scaling model (tickets per 100 orgs, staffing ratios — capacity planning for the support org itself; 49.29 asserts scale, no model).
**(5) Security concerns.** Impersonation regime (finding 1); support-staff access reviews (same 29-recertification applied to internal staff — insider risk lives here).
**(6) Future limitations.** Multi-language support operations (49.29 lists it — knowledge base translation workflow ties 48's TMS; shared pipeline, unlinked).
**(7) Missing diagrams.** Escalation swimlanes (customer ticket ↔ platform incident crossover — the diagram that fixes the pager gap).
**(8) Missing business rules.** SLA calendars (business hours per plan/timezone — hotels run nights and weekends; "24×7" 49.29 needs plan-tier binding); breach remedies (credits policy — commercial rule the system must compute).
**(9) Missing technical standards.** Ticket-classification taxonomy (product area × severity — feeds 47.16 and problem management 49.11).
**(10) Missing operational processes.** Chapter's strength — onboarding, incident, problem, change all present; add customer-data handling SOP for support staff (the operational face of finding 1).
**(11) Missing governance.** 49.28 covers it — credit.
**(12) Missing engineering standards.** None material.
**(13) Missing monitoring.** 49.23 covers ops analytics — credit; add deflection metrics (KB-resolved vs ticketed — the self-service ROI number).
**(14) Missing observability.** Ticket ↔ traceId linkage (16.13's traceId surfaced in error UIs so customers quote it — the support loop-closer; both chapters have the halves, neither joins them).
**(15) Missing automation.** Ticket auto-triage/routing by classification; health-score-triggered playbooks (49.17 scores — the automated outreach it should trigger).
**(16) Missing AI opportunities.** Support copilot (KB-grounded draft responses via 39.25's RAG — the highest-ROI internal AI application; unmentioned despite the platform having the exact machinery).
**(17) Missing integrations.** Support-desk platform choice/build decision (Zendesk-class vs in-platform — an ADR affecting data boundaries).
**(18) Missing APIs.** Support API (ticket creation from within the product, status retrieval — in-app support UX).
**(19) Missing deployment considerations.** Status page hosted *off-platform* (must survive platform outage — one line, easily missed, operationally vital).
**(20) Missing documentation requirements.** Support handbook (Missing Documents #19); customer-facing SLA documents per plan.

---

## Chapter 50 — Enterprise Architecture Principles & Vision

**Scores & deduction rationale:** Architecture 7/10; Enterprise 6/10; Scalability 7/10; Maintainability 7/10; Security 7/10; Cloud 7/10; Future Proof 8/10; Overall 7/10.

**(1) Missing architectural concepts.** Stage-transition criteria for 50.11's evolution ladder (Modular Monolith → … → Distributed Platform: entry/exit conditions, trigger metrics — e.g., "extract channel-sync workers when sync volume > X/day or sync latency SLO breached" — the bridge that resolves D-5; this chapter is where it belongs and it is one arrow-chain short of existing); principle enforcement mechanisms (each principle needs its gate: API-First → OpenAPI CI check; Loose Coupling → module-boundary linting; Backward Compatibility → contract tests; a principle without a gate is a poster).
**(2) Weak decisions.** "Configuration over Customization" (50.3) vs the entire Ch 46 extension ecosystem — reconcile explicitly: configuration first, extension second, core customization never; as written the principle and the marketplace chapter can be quoted against each other.
**(3) Missing enterprise best practices.** Architecture-review board mechanics (50.17 lists required reviews — cadence, quorum, decision authority, appeal); fitness functions (automated architecture-conformance checks — the modern enforcement of exactly these principles).
**(4) Scalability issues.** None — this is the chapter that names them; adequately.
**(5) Security concerns.** Covered by principle; enforcement gap noted in (1).
**(6) Future limitations.** Multi-industry vision (50.2: clinics, warehouses, logistics) — the *domain-core vs vertical-module* split that would make it real (which capabilities are industry-neutral: parties, resources, scheduling, billing; which are hospitality-specific) is never sketched; without it "future business domains without redesign" is aspiration. One page of layering would convert the vision from marketing to architecture.
**(7) Missing diagrams.** The evolution roadmap as a staged diagram with triggers; the platform-core vs vertical-module layering.
**(8) Missing business rules.** N/A at this altitude.
**(9) Missing technical standards.** Principle-to-gate mapping table (the enforcement matrix from finding 1).
**(10) Missing operational processes.** Annual architecture review of the principles themselves (principles age; schedule their re-examination).
**(11) Missing governance.** 50.17 covers decision governance — credit; add technical-debt register mechanics (50.18 says "visible and prioritized" — the register format, review cadence, and budget allocation rule make it true).
**(12) Missing engineering standards.** 50.4 lists them — the pointers to the concrete documents (Missing Documents #12) are the gap.
**(13–14) Missing monitoring/observability.** Architecture-health metrics (module-coupling trends, boundary-violation counts from lint — measuring the principles).
**(15) Missing automation.** Fitness functions (finding 3).
**(16) Missing AI opportunities.** N/A.
**(17–18) Missing integrations/APIs.** N/A.
**(19) Missing deployment considerations.** The stage-trigger table (finding 1) — this chapter's core deliverable.
**(20) Missing documentation requirements.** The ADR corpus this chapter's governance presupposes; the master architecture index (D-3).

---

# Closing Statistics

| Metric | Value |
|---|---|
| Chapters in source file | 39 unique (Ch 11–50; Ch 12 duplicated, Ch 13 absent) |
| Chapters reviewed | 39 of 39 — none skipped |
| Criteria applied per chapter | 20 (grouped into 20 numbered findings sections per chapter) |
| Highest-scoring chapters | 25, 29, 36, 37, 44, 45, 49 (7/10) |
| Lowest-scoring chapters | 12 (4.5), 26 (5), 28 (5), 48 (5) |
| Most-repeated cross-cutting gap | Transactional outbox / reliable events (required by Chs 17, 26, 30, 32, 33, 39, 40, 46) |
| Second most-repeated gap | Tenancy data model ADR (blocks Chs 28, 40, 42, 45, 48) |
| Third most-repeated gap | Double-entry ledger (blocks Chs 22, 26, 35, 36, 38, 46) |
| Verdict | Unchanged from the executive report: NOT APPROVED as-is; maturity 40/100; approvable at 65–70/100 after the Immediate + Before-MVP roadmap |

*End of detailed per-chapter review.*

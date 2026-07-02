# ADR-013: API Gateway Placement & Rate-Limiting Enforcement

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 14.18, 37.19 (rate limiting), 12.19 (brute force/abuse), 41 (WAF/DDoS gap), 48.17 (custom domains/SSL), 31 (public booking engine protection), 42.18–19 (LB/CDN) |
| **Review findings resolved** | Top-100 items 33 (WAF/DDoS/bot), 52 (gateway placement); Detailed review Ch 37 finding 1, Ch 41 finding 1 |
| **Depends on** | ADR-004 (identity for authenticated limits), ADR-001 (per-tenant quotas) |
| **Depended on by** | Public API GA (Ch 37), booking engine launch (Ch 31), white-label domains (48.17) |

---

## 1. Context

Three chapters demand rate limiting (12.19, 14.18, 37.19) and the review found **no WAF, DDoS, or bot protection anywhere in the document** despite two public surfaces (booking engine, public API). Nobody states *where* these controls physically execute. Meanwhile 48.17 requires custom domains with automatic SSL — an edge-layer capability. The trap to avoid: adopting a heavyweight gateway product (Kong/Envoy fleet) at Stage 1, or the opposite — believing Express middleware alone can absorb a DDoS.

### Decision drivers

1. Edge-class threats (volumetric DDoS, bots, carding on the payment form — Ch 31 finding 5) must be stopped **before** they reach Node processes.
2. Identity-aware limits (per user / per API key / per organization / per plan — 37.19) require authentication and therefore must live **behind** authentication — the edge can't do them.
3. Custom-domain SSL automation (48.17) without manual certificate operations.
4. Stage-1 honesty: one monolith + workers; no service mesh to justify a gateway fleet.
5. Public API monetization later needs per-plan quotas and usage metering (37.25, billing spec).

---

## 2. Options considered

### Option A — Everything in application middleware
- ❌ Node absorbs volumetric attacks it should never see; no WAF/bot signatures; SSL-for-custom-domains DIY. **Rejected as sole layer.**

### Option B — Dedicated gateway product now (Kong / Envoy / Tyk)
- ❌ A fleet to operate, configure, and upgrade — for one upstream service. Its real value (routing/mTLS across many services) arrives at Stage 3. **Deferred with triggers.**

### Option C — Two-layer: managed edge (Cloudflare-class) + in-app policy middleware — **chosen**
Split the problem along the identity line: the edge handles what doesn't need identity; the application handles what does.

---

## 3. Decision

### 3.1 Edge layer (managed, Cloudflare-class) — v1, before any public surface ships

- **TLS termination + automatic certificates for custom domains** (Cloudflare for SaaS / equivalent) — 48.17's SSL automation becomes configuration; DNS-verification workflow per tenant domain (Ch 48 finding 15).
- **WAF** (managed rulesets: OWASP, known CVEs), **DDoS absorption**, **bot management** on the booking engine and auth endpoints (login, password reset — 12.19/15.15's brute-force line of defense at volume).
- **Coarse anonymous limits**: per-IP request ceilings on public endpoints; geo/ASN rules if abuse demands.
- CDN for static assets (42.19) and cache rules for public booking pages (Ch 31 finding 4's burst absorber).
- Edge config lives in IaC (Terraform provider) — reviewed like code (42.5).

### 3.2 Application policy layer (middleware in the API, after authentication)

- **Identity-aware rate limits**: per user, per API key, per organization, per plan tier — the 14.18/37.19 matrix. Categories with defaults: auth endpoints (strict), public API (per-key plan quota), internal app traffic (generous), webhooks-in (per source).
- **Response contract**: `429` + `Retry-After` + `X-RateLimit-Limit/Remaining/Reset` on every limited surface (the header standard Ch 14 finding 5 demanded).
- **Counter store**: Postgres (fixed-window with token-bucket smoothing) at Stage 1 — honest about its ceiling; **the first named Redis trigger**: when limiter write volume becomes measurable OLTP load or multi-instance accuracy matters commercially (plan quotas), move counters to Redis — the interface is one `RateLimiter` module so the swap is internal.
- **Per-tenant quotas** beyond rate: concurrent exports, report cost budgets, automation execution budgets (ADR-001 §3.4's noisy-neighbor toolbox) — enforced here, configured per plan.
- **Usage metering** for the public API (37.25/billing): the same middleware emits usage events via outbox (ADR-003) — metering and limiting share one counting point, so invoices and 429s can never disagree.

### 3.3 What we deliberately do NOT deploy yet

No standalone gateway product at Stage 1–2. **Adoption triggers (feed ADR-015):** (a) second independently-deployed backend service (routing/mTLS need), (b) public API GA with contractual per-plan SLAs, (c) K8s adoption (Stage 3) where an ingress-native gateway (Envoy-based) is idiomatic. When triggered, the gateway takes over §3.2's *transport* concerns (routing, retries, coarse auth) — but plan quotas and metering stay application-owned, because they are business logic.

### 3.4 Non-bypass guarantee

Origin accepts traffic **only from the edge** (mTLS origin pull / allowlist + header secret) — otherwise the WAF is decorative. Verified by an external probe test (direct-to-origin request must fail).

---

## 4. Consequences

**Positive** — the review's WAF/DDoS/bot gap closes with a managed service instead of new ops burden; 48.17 SSL automation solved by the same layer; limiting and metering share one source of truth; the gateway decision is staged instead of prematurely bought.
**Negative / accepted** — edge vendor dependency (config portable via IaC; exit = another edge or Stage-3 gateway); Postgres counters are approximate across instances (acceptable for abuse control; commercial quotas get Redis precision when they exist).
**Risks** — *origin bypass misconfig*: the §3.4 probe test runs in CI/synthetics permanently. *Edge cache serving stale availability* (Ch 31): booking availability responses are explicitly `no-store`; only static/page shells cache — cache rules are code-reviewed.

## 5. Compliance checks (CI-enforceable)

1. Header conformance test: every rate-limited endpoint returns the 429 contract (`Retry-After`, `X-RateLimit-*`).
2. Origin-bypass probe: direct origin requests rejected (runs as scheduled synthetic, not just CI).
3. Limit-matrix test: per-category fixture principals hit their configured ceilings and recover per window.
4. Metering consistency test: N metered calls produce exactly N usage events (shared counting point asserted).
5. Edge-config drift check: live edge configuration matches IaC state.

## 6. Open questions

1. Edge vendor selection (Cloudflare vs Fastly vs cloud-native) — procurement at implementation; requirements above are vendor-portable.
2. Per-plan quota numbers — commercial decision with the billing spec.
3. mTLS service-to-service (Stage 3) — arrives with the gateway/mesh, out of v1 scope.

## 7. References
PMS-1.2-Architecture-Review.md Top-100 #33, #52; Detailed review Ch 31 findings 4–5, Ch 37 finding 1, Ch 41 finding 1, Ch 48 finding 15. ADR-003 (usage events), ADR-004 (identity), ADR-015 (stage triggers).

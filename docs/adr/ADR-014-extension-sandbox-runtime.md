# ADR-014: Extension Sandbox Runtime (Remote-First)

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 46 (all — runtime made concrete), 37 (API/webhooks as the extension surface), 33.21–22 (shared egress infrastructure), 38.25–26 (plugin architecture/SDK) |
| **Review findings resolved** | Top-100 item 94; Detailed review Ch 46 findings 1–2 (runtime ADR, sequencing), 3 (kill switch), Ch 33 finding 5 (SSRF — shared egress control) |
| **Depends on** | ADR-003 (event delivery), ADR-008 (permission ceilings), ADR-012 (plugin config encryption), ADR-013 (edge for extension traffic) |
| **Depended on by** | Marketplace program (Ch 46), Extension SDK (38.26/46.13) |

---

## 1. Context

Chapter 46 specifies a plugin ecosystem with sandbox restrictions ("no direct database access, no file system access, no unauthorized network calls, limited runtime resources" — 46.7) without choosing a runtime — and the choice spans an order of magnitude in security engineering: in-process JS sandboxes, WASM isolates, per-extension containers, or not hosting third-party code at all. The review recommended the Shopify/Slack path: **extensions run on the partner's infrastructure**; the platform provides APIs, events, and embedded UI. This ADR formalizes that and its consequences.

### Decision drivers

1. Hosting third-party code is the single largest security liability a platform can acquire; every in-process sandbox (vm2 history is instructive) eventually publishes an escape CVE.
2. Small team: the marketplace must not require building a serverless platform before it sells its first extension.
3. Extension capability floor: react to events (46.9), call the platform API within granted scopes (46.8), extend the UI (46.10), store configuration — all achievable remotely.
4. Kill-switch latency and blast radius (46.29): disabling a misbehaving extension must be fast and total.
5. The Automation Engine's HTTP node (33.22) and outbound webhooks share the same egress-security problem — one control, not three.

---

## 2. Options considered

### Option A — In-process JS sandbox (isolated-vm class)
- ❌ Escape risk lives in *our* process with *our* tenant data; dependency/version support burden for partner code; resource-limits engineering. **Rejected.**

### Option B — WASM isolates
- ✅ Better isolation than A. ❌ Partner DX (toolchains, language limits) is hostile in 2026 for this audience; capability system still bespoke. **Rejected for now** — the strongest future candidate if hosted execution is ever justified.

### Option C — Container-per-extension on our infra
- ❌ A hosting business bolted onto a PMS: orchestration, billing, abuse, patching. **Rejected.**

### Option D — Remote-first: partner-hosted compute + platform-brokered surfaces — **chosen**
Extensions are external applications: they subscribe to webhooks, call the public API under OAuth-scoped service principals, and render UI in sandboxed iframes. LBL executes **no third-party code server-side**.

---

## 3. Decision

### 3.1 Extension = manifest + three brokered surfaces

The manifest (46.6) declares everything the platform enforces:

1. **Events out:** webhook subscriptions to catalog events (ADR-003 §3.4 — same envelope as public webhooks, HMAC-signed per 37.17, per-extension endpoint + secret, retries/DLQ from the shared delivery infrastructure).
2. **API in:** an extension installation creates a **service principal** with the granted permission subset (ADR-008 ceiling: never exceeding what the installing admin approved, 46.8); OAuth client-credentials against the public API (Ch 37); per-extension rate limits and usage metering (ADR-013 §3.2 — marketplace analytics 46.25 fall out of the same counters).
3. **UI extensions (46.10):** declared **slots** (dashboard widget, reservation-drawer panel, navigation item, settings page) rendering **sandboxed iframes** (`sandbox` attribute, strict CSP, no same-origin): the platform passes a short-lived **signed context token** (current org/hotel/entity id + the extension's scopes) via a versioned postMessage bridge; the iframe app exchanges it at the API for data it is scoped to see. No third-party JS executes in the host page — the host ships only the slot/bridge code (the extension points Ch 11 finding 6 asked to reserve).

### 3.2 Configuration & data

- Per-installation config KV, stored encrypted via ADR-012 (`tenant_secrets` machinery — plugin credentials are tenant credentials).
- **No platform-hosted plugin database in v1** (46.13's "Storage API" scoped down to config KV). Extensions persist their own data on their side — which makes the vendor a data processor: **installation flow includes DPA acceptance + data-scope consent screen** (the legal architecture Ch 46 finding 3 demanded), and uninstall triggers config deletion + a contractual vendor-deletion obligation with attestation.

### 3.3 Lifecycle, review, kill switch

- Publish pipeline: manifest validation → automated security scan (46.26: permission sanity, webhook endpoint verification, iframe CSP compliance) → human review for public listing (46.17) → **digital signing of the manifest** (46.18) — installs verify signature; unsigned = private-org-only per policy.
- **Update with scope escalation ⇒ re-consent** by an org admin; silent permission growth is impossible (Ch 46 finding 5).
- **Kill switch** (platform- and org-level): disable ⇒ revoke the service principal's tokens, pause webhook delivery, unload UI slots. Propagation ≤ 5 minutes (token cache TTL bound — aligned with ADR-004/008 sensitive-path checks). Marketplace-wide revocation for compromised publishers (46.29) is the same operation fanned out.
- Runtime behavioral monitoring: per-extension API anomaly alerts (volume spikes, scope-probing 403 bursts) — the post-review control from Ch 46 finding 5.

### 3.4 Shared egress control (closes Ch 33's SSRF finding here)

All **platform-initiated outbound HTTP** — extension webhooks, Automation Engine HTTP nodes (33.22), integration connectors — flows through one **egress proxy component**: DNS-pinned resolution, private-IP/link-local/metadata-range blocking, per-tenant destination allowlists (automation), TLS-only, response-size and timeout caps, full audit (38.23). One implementation, three consumers; the Automation Engine's raw-HTTP node ships **only after** this component exists (sequencing rule from Ch 33 finding 2).

### 3.5 Sequencing (resolves Ch 46 finding 2)

Marketplace capability ships in this order, each stage sellable: (1) private org extensions (webhooks+API only) → (2) iframe UI slots → (3) public marketplace with review/signing/billing (46.21 billing arrives with the platform-billing spec) → (4) *hosted* execution (WASM) **only if** partner demand proves it — an explicit future ADR, not scope creep.

---

## 4. Consequences

**Positive** — LBL never executes third-party server code: the catastrophic risk class is absent by architecture; extension infrastructure reuses what already exists (webhooks, OAuth, permissions, metering) so the marketplace is mostly *policy*, not new machinery; the egress proxy fixes the Automation SSRF hole with one shared component.
**Negative / accepted** — partners must host something (barrier for hobbyists; mitigated later by stage 4 or partner-friendly templates/Workers examples); UI extensions are iframe-bounded (no deep host-DOM integration — accepted deliberately; the slot catalog grows by design, not by exception); event-driven-only means no synchronous in-request plugin hooks in v1 (workflow extension points 46.11 arrive via the Automation Engine's approval/webhook nodes instead).
**Risks** — *iframe token leakage*: short TTL, audience-bound, entity-scoped tokens; bridge messages schema-validated. *Vendor data sprawl*: DPA + scope consent + uninstall attestation are governance mitigations — technical enforcement beyond scope reduction is impossible in a remote model and is stated honestly.

## 5. Compliance checks (CI-enforceable)

1. Manifest schema validation + signature verification in the install path (unsigned public install impossible).
2. Scope-ceiling test: extension principal can never act beyond manifest grants ∩ installer's rights (extends ADR-008 check 6).
3. Kill-switch drill: disable ⇒ API 401s, webhook pause, UI slot removal — all within the 5-minute bound (scheduled synthetic).
4. Iframe CSP/sandbox conformance test per slot; postMessage fuzzing against the bridge schema.
5. Egress-proxy tests: metadata/private ranges blocked; allowlist enforced; audit record per call.
6. Re-consent test: manifest update with new scopes blocks activation until admin approval.

## 6. Open questions

1. Revenue share/billing mechanics (46.21/46.24) — platform-billing spec.
2. Slot catalog v1 (which four slots ship first) — product decision with the design system.
3. Hosted execution (stage 4) — separate future ADR with WASM as the working hypothesis.

## 7. References
PMS-1.2-Architecture-Review.md Top-100 #94, #14; Detailed review Ch 46 all findings, Ch 33 findings 2/5, Ch 11 finding 6. ADR-003 (delivery), ADR-008 (ceilings), ADR-012 (config encryption), ADR-013 (metering). Prior art: Shopify Apps, Slack platform.

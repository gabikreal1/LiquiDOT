# PRD — Review Readiness (LiquiDOT): Correctness, Safety, Evidence, Refactors

Date: 2025-12-22
Owner: LiquiDOT Team
Status: Draft (implementation started)

## 1) Summary
This PRD converts the current reviewer feedback and risk items into an actionable, testable plan.

It covers five pillars:
1. **Correctness**: liquidation-only lifecycle + Asset Hub settlement must be correct.
2. **Safety**: quote/slippage protection, idempotency, and controlled automation.
3. **Evidence**: no runtime claims without proofs; provide manifests and reproducible verification.
4. **Maintainability**: backend blockchain layer refactor + contracts precompile abstraction.
5. **Docs**: clear “Repo Fact vs Network Claim” wording + verification procedures.

## 2) Goals
- Reviewer confidence: at least one clear, reproducible end-to-end flow.
- No double-crediting or accounting drift.
- Minimal operational surprises: consistent errors, diagnostics endpoints, and deployment manifests.

## 3) Non-goals
- Partial position reduction rebalances.
- Multi-hop routing or complex path finding.
- Full on-chain proof system for XCM messages.

## 4) Milestones

### M1 — Stop overclaiming runtime support (Docs + Evidence)
**Problem:** Paseo/AssetHub PolkaVM precompile address/ABI and inbound `Transact` support are runtime-dependent.

**Requirements**
- Docs must separate:
  - **Repo Fact** (proven by this repo)
  - **Network Claim** (must include citation, tx hash, or “how to verify” procedure)
- Introduce an “assumptions manifest” per deployment environment.

**Acceptance criteria**
- `gitbook/basics/paseo-assethub-polkavm-xcm.md` is the single source of truth.
- Every runtime-dependent claim includes either a citation or a verification procedure.

---

### M2 — Settlement correctness + idempotency (Highest risk)
**Problem:** liquidation settlement on Asset Hub is the custody/accounting truth.

**Requirements**
- Enforce idempotency for:
  - liquidation initiation
  - settlement finalization
- Ensure settlement cannot double-credit (race/retry safe).

**Acceptance criteria**
- Unit tests proving:
  - settlement is idempotent
  - repeated event delivery does not change final balance twice

---

### M3 — Quote-gated liquidation / slippage protection
**Problem:** liquidation-only exits must protect users from slippage.

**Requirements**
- Add `liquidationMaxSlippageBps` preference.
- Quote before liquidation; compute min-outs; fail safely if quote fails.

**Acceptance criteria**
- Tests covering:
  - minOut computation
  - quote failure handling

---

### M4 — Automation triggers + monitoring
**Problem:** reviewers want the system to feel real and operational.

**Requirements**
- Document and implement stop-loss / take-profit liquidation triggers.
- Ensure `LIQUIDATION_PENDING` is respected by sync processes.

**Acceptance criteria**
- A documented trigger flow.
- A test (or deterministic mocked test) showing automation calls the right liquidation path.

---

### M5 — Contracts refactor: precompile/host-function abstraction
**Problem:** different chains expose different “precompile” semantics; contracts must not hardcode incorrect assumptions.

**Requirements**
- Introduce adapter layer:
  - `IXcmSender`
  - Asset Hub sender adapter
  - Moonbeam sender adapter (narrow initially)
- Refactor `AssetHubVault` to send XCM through adapter while keeping backwards compatibility.

**Acceptance criteria**
- Adapter unit tests pass.
- `AssetHubVault` can be configured to use adapter and still works in test mode.

---

### M6 — Backend blockchain integration refactor
**Problem:** integration code must be robust and observable.

**Requirements**
- Establish clear I/O boundary, error taxonomy, startup validation.
- Keep diagnostics endpoint stable.

**Acceptance criteria**
- Unit tests remain green.
- No API behavior regressions.

## 5) Evidence package (for reviewers)
For each network deployment (e.g. Paseo Asset Hub, Moonbase):
- contract addresses
- runtime specVersion
- configured precompile/adapter addresses
- tx hashes for:
  - a liquidation initiation
  - a settlement

## 6) Implementation status
- ✅ Docs page created: `gitbook/basics/paseo-assethub-polkavm-xcm.md`
- ✅ Backend diagnostics endpoint: `GET /api/blockchain/diagnostics`
- ✅ SmartContracts adapters started: `contracts/V1(Current)/xcm/*`

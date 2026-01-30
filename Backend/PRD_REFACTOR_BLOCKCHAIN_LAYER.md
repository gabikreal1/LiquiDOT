# PRD — Refactor: Backend Blockchain Integration Layer

Date: 2025-12-22
Owner: LiquiDOT Team
Status: Draft

## 1) Summary
LiquiDOT’s NestJS backend currently has multiple blockchain-facing services (`AssetHubService`, `MoonbeamService`, `XcmBuilderService`, event listeners, and new diagnostic endpoints). This PRD defines a refactor to:

- Make chain interactions **safer** (typed, consistent errors, retries, idempotency).
- Make chain configuration **explicit and environment-scoped**.
- Make chain operations **observable** (structured logs, consistent telemetry context, diagnostics).
- Make contract ABIs + network assumptions **verifiable**.

The intent is to reduce integration risk as we move deeper into PolkaVM/Paseo and liquidation-only flows.

## 2) Goals
1. **Single integration surface**: a clear boundary between business logic and chain I/O.
2. **Configuration correctness**: all addresses, chain IDs, and “precompile/host function” config validated on boot.
3. **Operational robustness**: standardized retries/backoff for reads, and controlled timeouts for writes.
4. **Deterministic error semantics**: callers can classify failures (misconfig vs transient vs revert).
5. **Better test ergonomics**: contract service fakes/mocks without huge boilerplate.

## 3) Non-goals
- Changing core product behavior (decision logic, liquidation-only lifecycle) beyond necessary wiring.
- Rewriting contracts.
- Building a full indexer.

## 4) Current pain points (as observed in repo)
- **Service shape drift**: services contain a mix of read methods, admin writes, and “business-ish” operations.
- **Ambiguous runtime assumptions**: e.g. “precompile address” means different things on Moonbeam vs Asset Hub.
- **Error strings** are inconsistent, making alerting/triage difficult.
- **Testing** requires mocking deep providers and contracts; easy to regress.

## 5) Proposed architecture

### 5.1 Layering contract
Define a strict boundary:

- **Business modules** (decisions, positions, execution): may call a small set of chain APIs.
- **Blockchain integration layer**: owns all behavior dealing with RPC, contracts, ABI decoding, retries, and mapping.

### 5.2 New internal APIs (interfaces)
Create interfaces so business code depends on small abstractions:

- `IAssetHubVaultReader`
- `IAssetHubVaultWriter`
- `IMoonbeamProxyReader`
- `IMoonbeamProxyWriter`

And optionally a combined façade:

- `IBlockchainGateway` (or `BlockchainGatewayService`) that composes both chains.

### 5.3 Consistent error taxonomy
Introduce a shared error type hierarchy:

- `BlockchainMisconfigurationError` (missing env, invalid address)
- `BlockchainRpcUnavailableError` (network down, timeout)
- `BlockchainRevertError` (contract revert / EVM error)
- `BlockchainRateLimitedError`
- `BlockchainUnexpectedError`

All errors should include:
- `chain: 'assetHub' | 'moonbeam'`
- `operation: string`
- `details?: Record<string, unknown>`

### 5.4 Startup validation
On app boot, validate:
- configured RPC endpoints are reachable
- configured contract addresses have code (where supported)
- configured chain IDs match expected
- `AssetHubVault.XCM_PRECOMPILE()` is set if required for operations

Startup validation must be **configurable**:
- `BLOCKCHAIN_VALIDATION=warn|fail|off`

### 5.5 Observability
- Structured logging fields: `chain`, `txHash`, `positionId`, `userId`, `operation`
- Add a health/diagnostics payload:
  - `GET /api/blockchain/diagnostics` exists already; formalize it.

## 6) Functional requirements

### 6.1 Contract I/O wrappers
- All calls should go through a wrapper providing:
  - timeouts
  - retry policy (reads only)
  - consistent error mapping

### 6.2 Strict config objects
- Replace scattered env reads with typed config providers:
  - `AssetHubConfig`
  - `MoonbeamConfig`

### 6.3 Deterministic idempotency utilities
- Shared helper to compute and persist idempotency keys for:
  - liquidation initiation
  - settlement calls

### 6.4 Test harness
- Add integration-layer unit tests for:
  - error mapping
  - startup config validation
  - a few representative read/write flows

## 7) API changes
- None required for business endpoints.
- Diagnostic endpoints may expand fields, but keep backwards compatible.

## 8) Data model changes
- Optional future (not required now): add a `BlockchainOperationLog` entity.

## 9) Rollout plan
1. Introduce new interfaces + wrapper utilities.
2. Migrate `AssetHubService` methods to readers/writers.
3. Migrate `MoonbeamService` methods to readers/writers.
4. Update dependent modules (`InvestmentDecisionService`, `PositionEventsService`) to use the façade.
5. Remove deprecated methods and update tests.

## 10) Acceptance criteria
- All existing unit + e2e tests pass.
- No API behavior change for current endpoints.
- Any misconfiguration produces a precise error with chain + operation.
- A single place documents chain assumptions (addresses, chain IDs, precompile semantics).

## 11) Open questions
- Do we want runtime validation to block startup in production, or warn-only?
- Which operations are “must have” for `IBlockchainGateway` vs direct per-chain services?

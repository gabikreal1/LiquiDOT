# PRD: Passet Hub SCALE-encoded Settlement Transact (Moonbeam → Passet Hub)

## Problem
LiquiDOT needs to settle liquidation results on Asset Hub/Passet Hub by returning the **output amount** from Moonbeam in a way that works even when “asset return via XCM” is not reliable on testnet.

The intended transport is **XCM Transact** from Moonbeam using Moonbeam’s **XCM Transactor precompile** (already integrated in `SmartContracts/contracts/V1(Current)/XCMProxy.sol`).

However, current docs / draft reports contain a set of correctness issues that block implementation:

- **Precompile ABI mismatch**: drafts reference `transactThroughSigned` + multilocations, while LiquiDOT currently uses `transactThroughDerivative(uint32 paraId, uint16 feeLocation, uint64 transactRequiredWeightAtMost, bytes call, uint256 feeAmount, uint64 overallWeight)`.
- **Settlement ABI mismatch**: drafts reference `settleLiquidation(address,uint256)` but LiquiDOT’s vault uses `settleLiquidation(bytes32,uint256)`.
- **ParaID / chainId confusion**: chainId (EVM) was incorrectly used as paraId in places.
- **Unverified runtime assumptions**: pallet/call names like `revive.call`, `revive.mapAccount`, and batching (`utility.forceBatch`) must be proven from Passet Hub metadata.

## Goal
Deliver a repo-aligned, reproducible workflow to generate the **SCALE-encoded destination call bytes** (`innerCall`) for Passet Hub, and a backend + contract invocation path that can dispatch it via Moonbeam’s XCM Transactor.

## Non-goals
- This PRD does **not** attempt to prove Passet Hub accepts inbound Transact to EVM at runtime — instead it produces the tooling and evidence to validate it.
- This PRD does not implement a full cross-chain “return asset + settle” in one XCM program (may be impossible/unstable on testnet). It focuses on **returning the amount via Transact**.

## Users / Stakeholders
- Protocol developers (contracts + backend)
- Reviewers (need evidence pack + testable scripts)
- Operators (need a robust procedure for mapping/setup and settlement execution)

## Success Criteria (Acceptance)
### A) Correctness / repo alignment
- Docs and examples reference the **actual repo ABI**:
  - `XCMProxy` uses `transactThroughDerivative(...)` (paraId + feeLocation index + bytes call).
  - Settlement target is `AssetHubVault.settleLiquidation(bytes32,uint256)`.

### B) Deterministic “innerCall” generation
- A script exists that connects to Passet Hub WS, confirms/prints:
  - runtime specName/specVersion
  - whether pallets/calls exist (`revive.call`, `revive.mapAccount`, `utility.forceBatch`, etc.)
  - outputs:
    - `innerCallHex` for the settlement call
    - optional `innerCallHex` for `utility.forceBatch([revive.mapAccount(), revive.call(...)])`

### C) Backend integration
- Backend has a method that builds `innerCallHex` using metadata (no hardcoded pallet indices).
- Backend can pass that `innerCall` into the existing Moonbeam call path (XCMProxy remote call) behind a feature flag.

### D) Security / access control
- AssetHubVault settlement authorization must remain explicit:
  - `settleLiquidation` callable by `operator` or a configured `trustedSettlementCaller` (already implemented).
- Documentation clearly states that Transact-based settlement is “trusted origin” accounting.

### E) Tests
- Backend includes idempotency tests ensuring repeated settlement signals do not double-credit.

## Requirements
### R1: Metadata inspection tooling
Create a script (Node/TS) that:
- takes `PASSET_HUB_WS` env var
- connects via `@polkadot/api`
- prints pallets and call signature shapes for:
  - `api.tx.revive.call`
  - `api.tx.revive.mapAccount` (or variants)
  - `api.tx.utility.forceBatch` / `batchAll` / `batch`
- prints runtime:
  - `api.runtimeVersion.specName`, `specVersion`

### R2: Settlement payload builder
Tooling must build EVM calldata (ABI) for:
- `settleLiquidation(bytes32,uint256)`

Then wrap it into the destination extrinsic:
- Preferred (robust): `utility.forceBatch([revive.mapAccount(), revive.call(...)])`
- Fallback: `revive.call(...)` only

Output should include:
- `innerCallHex`
- `innerCallBytesLength`

### R3: Backend service method
Add a backend method:
- `buildPassetHubSettleLiquidationInnerCall({ vaultAddress, positionId, amount, includeMapAccount }): Promise<string>`
- Must use metadata-driven encoding via polkadot-js extrinsics and `.method.toHex()`.

### R4: Invocation wiring (behind flag)
Backend should be able to call Moonbeam’s `XCMProxy.remoteCallAssetHub(...)` or equivalent.
- Use config flag `ENABLE_PASSETHUB_TRANSACT_SETTLEMENT`.
- In “dry-run” mode, only log the generated `innerCallHex`.

### R5: Documentation correction
Update any internal docs claiming wrong ABI:
- Replace `transactThroughSigned` references with the repo’s `transactThroughDerivative`.
- Replace wrong settlement function signature.
- Explicitly label unknowns (paraId, mapping requirement) as “runtime-dependent; verified via script output”.

## Edge Cases
- `revive.mapAccount` not present (runtime changed) → script should detect and recommend using only `revive.call`.
- `utility.forceBatch` not present → script should try `batch`/`batchAll`.
- contract call args type mismatch → script must print the method meta and error loudly.
- runtime upgrade changes call type layout → metadata-driven encoding should still work.

## Implementation Plan
### M1: Add inspection + builder script
- Add `Backend/scripts/passetHub-inspect-and-build-settlement-innercall.ts`.

### M2: Add backend service method
- Extend `Backend/src/modules/blockchain/services/xcm-builder.service.ts` (or a new service if preferred) with builder method.

### M3: Add tests
- Add unit tests for idempotency in settlement handling.

### M4: Docs updates
- Update relevant docs to remove ABI mismatches.

## Open Questions
- Does Passet Hub accept inbound XCM Transact that successfully dispatches `revive.call` into the EVM environment?
- Is account mapping required for the XCM origin on this runtime version?
- What is the correct paraId for Passet Hub on the relevant relay (must be confirmed via metadata/docs)?

## Evidence to collect
- Script output committed in `deployments/paseo/assumptions.generated.json` or a log snapshot in `deployments/paseo/evidence/`.
- Transaction hashes once first successful end-to-end Transact is observed.

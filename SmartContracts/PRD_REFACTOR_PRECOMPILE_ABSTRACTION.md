# PRD — Refactor: Precompile / Host-Function Abstraction (Moonbeam vs Asset Hub PolkaVM)

Date: 2025-12-22
Owner: LiquiDOT Team
Status: Draft

## 1) Summary
LiquiDOT spans multiple execution environments:

- Moonbeam-family (EVM + known precompile set like XTokens)
- Asset Hub (PolkaVM/revive + runtime-specific host functions / “precompile-like” addresses)

Today, the repo mixes concepts:

- `0x…0804` appears in Moonbeam context as **XTokens**.
- The Asset Hub custody contract (`AssetHubVault.sol`) uses a configurable `XCM_PRECOMPILE` and a minimal interface `send(bytes destination, bytes message)`.

This PRD defines a refactor to ensure:

- We do not hardcode ecosystem assumptions incorrectly.
- We can validate per-network “precompile” addresses & ABIs.
- We can upgrade without rewriting business logic or every contract call.

## 2) Goals
1. **Explicitly separate** Moonbeam precompiles from Asset Hub host functions.
2. **Network config** is discoverable and stored in one place (deployment config + on-chain storage where needed).
3. **ABI compatibility guardrails**: avoid shipping a vault that calls the wrong XCM API.
4. **Testability**: local tests can mock the precompile/host function.

## 3) Non-goals
- Solving general XCM message building inside Solidity (we’ll continue to build destination/message bytes off-chain in backend).
- Building a full cross-chain message SDK.

## 4) Proposed design

### 4.1 Introduce an adapter contract layer
Add a dedicated adapter contract per environment, with a uniform interface the rest of the system uses.

Example conceptual interface:

- `IXcmSender.sendXcm(bytes destination, bytes message)`

Implementations:

- `XcmSenderMoonbeam` – wraps XTokens / XCM Transactor precompiles as needed.
- `XcmSenderAssetHubRevive` – wraps the revive XCM host function (address + ABI runtime-specific).

`AssetHubVault` and `XCMProxy` depend on the adapter, not directly on a precompile.

### 4.2 ABI detection / versioning
Add an explicit on-chain “ABI version” for Asset Hub precompile/host function:

- `enum XcmApiKind { Unknown, SendBytesBytes, SendParaIdBytesWeight }`

Store:
- `xcmApiKind`
- `xcmApiAddress`

and require the admin to set them once (and freeze).

### 4.3 Deployment-time verification
Deployment scripts should:

- verify target chain properties (chainId, rpc)
- verify the precompile address returns expected behavior (dry run)
- set vault config accordingly

If we cannot programmatically verify on-chain without sending XCM, we accept a manual step but must record evidence:

- tx hashes
- runtime version

### 4.4 Local testing strategy
- Provide mock contracts that emulate:
  - XTokens transfer
  - AssetHub send host function

Contract unit tests should validate:
- correct call encoding and control flow
- that the vault refuses to operate if the precompile config is missing or mismatched

## 5) Functional requirements

1. `AssetHubVault` should not assume a universal address like `0x…0804`.
2. The system should support multiple Asset Hub runtimes by selecting the correct adapter/API kind.
3. A misconfigured ABI must fail fast (revert with a specific error) rather than silently sending wrong calldata.
4. Deployment tooling must produce a “network assumptions manifest” that can be attached to reviewer docs.

## 6) Acceptance criteria
- Existing test suite remains green.
- A new test proves:
  - vault refuses to send when `xcmApiKind=Unknown`
  - vault can send using mocked `SendBytesBytes` kind
- The deployed addresses / API kind can be read via view functions.

## 7) Open questions
- Does the target Asset Hub runtime expose an EVM-style selector ABI at all, or is it special-cased by revive host functions?
- Should the adapter be upgradeable (proxy) or frozen immutable per deployment?
- Do we want the backend to compute SCALE encoding or keep that entirely on-chain/off-chain?

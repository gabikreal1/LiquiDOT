# LiquiDOT Smart Contract Security Audit

| Field | Detail |
|-------|--------|
| **Scope** | `contracts/V1(Current)/AssetHubVault.sol` and `contracts/V1(Current)/XCMProxy.sol` |
| **Date** | February 2026 |
| **Auditor** | Internal Security Review |
| **Solidity** | ^0.8.20 (Compiler 0.8.28) |
| **Frameworks** | OpenZeppelin Contracts, Algebra Integral Core/Periphery |

---

## Summary

| Severity | Count | Actionable |
|----------|-------|------------|
| HIGH | 4 | 4 fixes |
| MEDIUM | 7 | 7 fixes |
| LOW/INFO | 6 | Documented |

---

## HIGH Findings

### H-1: Missing beneficiary validation in liquidateSwapAndReturn / swapAndReturn (XCMProxy)

| Field | Detail |
|-------|--------|
| **Contract** | `XCMProxy.sol` |
| **Location** | `liquidateSwapAndReturn()` (line 919), `swapAndReturn()` (line 1011) |
| **Severity** | HIGH |

**Issue:**
The `beneficiary` parameter is passed freely by the operator in both `liquidateSwapAndReturn()` and `swapAndReturn()`. There is no validation that the beneficiary matches the position owner. A compromised or malicious operator can redirect liquidation proceeds to any arbitrary address instead of the rightful position owner.

```solidity
// XCMProxy.sol, line 919
function liquidateSwapAndReturn(
    uint256 positionId,
    address baseAsset,
    address beneficiary,   // <-- no validation against position.owner
    ...
) external onlyOperator whenNotPaused nonReentrant {
```

**Impact:** Direct fund theft by a compromised operator. All liquidation proceeds for any position can be redirected to an attacker-controlled address on Asset Hub.

**Fix:** Added owner validation after the status check in both functions:

```solidity
if (beneficiary != position.owner) revert InvalidUser();
```

**Status:** Fixed

---

### H-2: Zero-address check in XCM encoding (XCMProxy)

| Field | Detail |
|-------|--------|
| **Contract** | `XCMProxy.sol` |
| **Location** | `_encodeDepositAssetXcm()` (line 387) |
| **Severity** | HIGH |

**Issue:**
The `_encodeDepositAssetXcm()` function accepts `address(0)` as a beneficiary without any validation. When `address(0)` is passed, the function constructs a SCALE-encoded XCM `DepositAsset` instruction targeting an AccountId32 that is 20 zero bytes followed by 12 `0xEE` bytes. This address is uncontrollable on Asset Hub, resulting in permanent and irrecoverable fund loss.

```solidity
// XCMProxy.sol, line 387
function _encodeDepositAssetXcm(address beneficiary) internal pure returns (bytes memory) {
    // No zero-address check -- will encode to all-zero AccountId32
    bytes20 addr = bytes20(beneficiary);
    ...
}
```

This function is called by `_xcmTransferToAssetHub()` (line 418), which is in turn called by `liquidateSwapAndReturn()`, `swapAndReturn()`, `returnAssets()`, and `cancelPendingPosition()`.

**Impact:** Permanent fund loss. Tokens sent via XCM to an all-zero AccountId32 on Asset Hub cannot be recovered.

**Fix:** Added zero-address validation at the start of the function:

```solidity
if (beneficiary == address(0)) revert InvalidUser();
```

**Status:** Fixed

---

### H-3: Liquidated amounts not zeroed in swapAndReturn (XCMProxy)

| Field | Detail |
|-------|--------|
| **Contract** | `XCMProxy.sol` |
| **Location** | `swapAndReturn()` (lines 1025-1026) |
| **Severity** | HIGH |

**Issue:**
In the `swapAndReturn()` function, `position.liquidatedAmount0` and `position.liquidatedAmount1` are read into local variables but never zeroed in storage. While the status transition from `Liquidated` to `Returned` (line 1087) prevents a straightforward re-entry in normal flow, failing to zero these values violates the checks-effects-interactions pattern and exposes the contract to edge cases where storage state does not reflect reality.

```solidity
// XCMProxy.sol, lines 1025-1026
uint256 amount0 = position.liquidatedAmount0;  // read but never zeroed
uint256 amount1 = position.liquidatedAmount1;  // read but never zeroed
```

By contrast, `liquidateSwapAndReturn()` (line 919) does not have this issue because it calls `_liquidatePosition()` and uses the return values directly rather than reading from storage.

**Impact:** Potential reentrancy edge case. If any future code path or upgrade allows a position to re-enter the `Liquidated` state, the stale non-zero amounts could be exploited to double-spend liquidation proceeds.

**Fix:** Added zeroing of both fields after reading, before any external calls:

```solidity
position.liquidatedAmount0 = 0;
position.liquidatedAmount1 = 0;
```

**Status:** Fixed

---

### H-4: No settledAmount tracking in AssetHubVault Position

| Field | Detail |
|-------|--------|
| **Contract** | `AssetHubVault.sol` |
| **Location** | Position struct (line 152) and `settleLiquidation()` (line 556) |
| **Severity** | HIGH |

**Issue:**
The `Position` struct in `AssetHubVault` does not contain a `settledAmount` field. When `settleLiquidation()` is called, the `receivedAmount` is credited to the user's balance and events are emitted, but the settled amount is not persisted in the position record itself. This makes it impossible to audit or dispute settlements on-chain by reading position state alone.

```solidity
// AssetHubVault.sol, line 152
struct Position {
    address user;
    address poolId;
    address baseAsset;
    uint32 chainId;
    int24 lowerRangePercent;
    int24 upperRangePercent;
    uint64 timestamp;
    PositionStatus status;
    uint256 amount;
    bytes32 remotePositionId;
    // No settledAmount field
}
```

While events (`LiquidationSettled`) do record the amount, events are not queryable on-chain by other contracts and are not part of the verifiable state root.

**Impact:** No on-chain auditability of settlements. Disputes cannot be resolved by reading contract state. Any future contract that needs to verify settlement amounts cannot do so.

**Fix:** Added `uint256 settledAmount` to the Position struct and set it in `settleLiquidation()`:

```solidity
position.settledAmount = receivedAmount;
```

**Status:** Fixed

---

## MEDIUM Findings

### M-1: Silent receive() in AssetHubVault

| Field | Detail |
|-------|--------|
| **Contract** | `AssetHubVault.sol` |
| **Location** | `receive()` (line 799) |
| **Severity** | MEDIUM |

**Issue:**
The `receive()` function silently accepts all native token transfers with no event emission or accounting. It is impossible to distinguish between legitimate XCM asset returns and unexpected or accidental deposits. This complicates reconciliation and makes it harder to detect anomalous fund flows.

```solidity
// AssetHubVault.sol, line 799
receive() external payable {
    // Accept ETH transfers for XCM returns and testing.
}
```

**Impact:** Operational risk. Funds sent to the contract by mistake cannot be identified or attributed. Reconciliation between expected XCM returns and actual balance changes requires off-chain detective work.

**Fix:** Added a `NativeReceived` event:

```solidity
event NativeReceived(address indexed sender, uint256 amount);

receive() external payable {
    emit NativeReceived(msg.sender, msg.value);
}
```

**Status:** Fixed

---

### M-2: Uncapped maxSettlementMultiplierBps (AssetHubVault)

| Field | Detail |
|-------|--------|
| **Contract** | `AssetHubVault.sol` |
| **Location** | `setMaxSettlementMultiplier()` (line 264) |
| **Severity** | MEDIUM |

**Issue:**
The `setMaxSettlementMultiplier()` function enforces a minimum of 1000 bps (1x) but has no upper bound. The `uint16` type allows values up to 65535 (approximately 65x the original investment). Additionally, no event is emitted when the multiplier changes, making it difficult to monitor configuration changes.

```solidity
// AssetHubVault.sol, line 264
function setMaxSettlementMultiplier(uint16 bps) external onlyAdmin {
    require(bps >= 1_000, "min 1x"); // No upper bound check
    maxSettlementMultiplierBps = bps;
    // No event emitted
}
```

**Impact:** A compromised admin could set the multiplier to 65x, effectively neutering the settlement cap as a safety mechanism. Without event emission, such changes are invisible to monitoring systems.

**Fix:** Added upper bound validation and an event:

```solidity
require(bps >= 1_000 && bps <= 20_000, "range 1x-20x");
emit MaxSettlementMultiplierUpdated(bps);
```

**Status:** Fixed

---

### M-3: No pool validation in executePendingInvestment (XCMProxy)

| Field | Detail |
|-------|--------|
| **Contract** | `XCMProxy.sol` |
| **Location** | `executePendingInvestment()` (line 508) |
| **Severity** | MEDIUM |

**Issue:**
The `executePendingInvestment()` function uses `pending.poolId` without validating that it is a legitimate Algebra pool contract. If the pool address is an EOA or an incompatible contract, the subsequent calls to `IAlgebraPool(poolId).token0()`, `globalState()`, etc. will fail with generic reverts, leaving the pending position stuck and funds locked in the contract.

```solidity
// XCMProxy.sol, line 544
address token0 = IAlgebraPool(poolId).token0();  // Will revert opaquely if poolId is wrong
```

**Impact:** Positions can become permanently stuck if created with invalid pool addresses. While the operator controls position creation, a bug in the backend or a compromised operator could create positions with bad pool IDs that cannot be executed or easily recovered.

**Fix:** Added a zero-address check on poolId at the start of execution:

```solidity
if (poolId == address(0)) revert PendingPositionNotFound();
```

**Status:** Fixed

---

### M-4: Mixed error styles in AssetHubVault

| Field | Detail |
|-------|--------|
| **Contract** | `AssetHubVault.sol` |
| **Location** | Multiple functions |
| **Severity** | MEDIUM |

**Issue:**
The contract uses a mix of `require(condition, "string")` (revert with string) and `revert CustomError()` patterns. Require strings are stored as full ABI-encoded strings in the contract bytecode, consuming more gas for deployment and for reverts compared to custom errors (which use 4-byte selectors).

Examples of remaining `require()` with strings:

```solidity
require(!xcmPrecompileFrozen, "xcm precompile frozen");     // line 207
require(!xcmSenderFrozen, "xcm sender frozen");              // line 215
require(!testModeFrozen, "test mode frozen");                 // line 237
require(success, "TRANSFER_FAILED");                          // line 395
require(!supportedChains[chainId].supported, "Chain already supported"); // line 325
```

**Impact:** Increased bytecode size and gas costs. Inconsistent error handling makes integration and error decoding harder for frontend and backend consumers.

**Fix:** Converted all remaining `require()` statements to custom errors with descriptive names matching the existing error convention.

**Status:** Fixed

---

### M-5: No emergency token recovery in XCMProxy

| Field | Detail |
|-------|--------|
| **Contract** | `XCMProxy.sol` |
| **Location** | Contract-wide |
| **Severity** | MEDIUM |

**Issue:**
The XCMProxy contract has no mechanism to recover ERC20 tokens that are accidentally sent to the contract or that remain from failed liquidation/swap sequences. While the contract holds tokens during normal LP operations, there is no admin function to sweep tokens that are not associated with any active position.

The existing `returnAssets()` function (line 890) requires the token to be in the `supportedTokens` mapping, meaning unsupported tokens sent by mistake are permanently locked.

**Impact:** Permanent loss of any unsupported tokens sent to the contract. Supported tokens from failed operations may accumulate without a recovery mechanism.

**Fix:** Added `emergencyRecoverToken()` function restricted to `onlyOwner`:

```solidity
function emergencyRecoverToken(address token, address to, uint256 amount) external onlyOwner {
    IERC20(token).safeTransfer(to, amount);
}
```

**Status:** Fixed

---

### M-6: Silent range auto-widening in calculateTickRange (XCMProxy)

| Field | Detail |
|-------|--------|
| **Contract** | `XCMProxy.sol` |
| **Location** | `calculateTickRange()` (line 704) |
| **Severity** | MEDIUM |

**Issue:**
When a user's requested price range collapses to `bottomTick >= topTick` after tick-spacing snap and clamping, the function silently falls back to a one-spacing-wide range centered on the current tick. The caller (operator/backend) has no on-chain indication that the originally requested range was overridden.

```solidity
// XCMProxy.sol, line 704
if (bottomTick >= topTick) {
    bottomTick = _floorToSpacing(currentTick - spacing, spacing);
    topTick = _ceilToSpacing(currentTick + spacing, spacing);
    // No event or flag indicating fallback occurred
}
```

**Impact:** Users may end up with LP positions in a range they did not request, without any on-chain record of the deviation. This could lead to unexpected impermanent loss exposure.

**Fix:** Added a `RangeAutoWidened` event emitted when the fallback triggers:

```solidity
event RangeAutoWidened(int24 requestedLower, int24 requestedUpper, int24 actualLower, int24 actualUpper);
```

**Status:** Fixed

---

### M-7: Opaque XCM precompile revert in _xcmTransferToAssetHub (XCMProxy)

| Field | Detail |
|-------|--------|
| **Contract** | `XCMProxy.sol` |
| **Location** | `_xcmTransferToAssetHub()` (line 434) |
| **Severity** | MEDIUM |

**Issue:**
The call to `IPalletXcm.transferAssetsUsingTypeAndThenAddress()` is a fire-and-forget external call. If the precompile reverts, the raw error data bubbles up without any contract-level context, making it difficult to diagnose failures. Unlike `AssetHubVault.dispatchInvestment()` which wraps its XCM send in try/catch (line 464), this function provides no structured error.

```solidity
// XCMProxy.sol, line 434
IPalletXcm(xcmPrecompile).transferAssetsUsingTypeAndThenAddress(
    dest, assets, 2, 0, 2, xcmOnDest
);
// Raw revert if precompile fails -- no structured error
```

**Impact:** Operational difficulty in diagnosing XCM transfer failures. Backend monitoring cannot distinguish between different failure modes without parsing raw revert data.

**Fix:** Wrapped the precompile call in try/catch with a custom `XcmTransferFailed` error:

```solidity
try IPalletXcm(xcmPrecompile).transferAssetsUsingTypeAndThenAddress(...) {
    // success
} catch {
    revert XcmTransferFailed();
}
```

**Status:** Fixed

---

## LOW / INFORMATIONAL

### L-1: Settlement trust model (operator provides amount)

| Field | Detail |
|-------|--------|
| **Severity** | Design |
| **Contract** | `AssetHubVault.sol` |

**Description:**
In the MVP, the operator relays the settlement amount from Moonbeam events to `settleLiquidation()` on Asset Hub. The `receivedAmount` is not cryptographically verified on-chain against the Moonbeam state. The backend is trusted to pass the exact `totalBase` from the `LiquidationCompleted` event.

**Mitigation:**
- Settlement cap (`maxSettlementMultiplierBps`, default 10x) bounds the maximum damage from a dishonest operator.
- The production path is atomic XCM Transact, where Moonbeam's XCMProxy would construct a SCALE-encoded XCM message with the settlement amount on-chain, removing the backend from the trust path entirely.

**Status:** Documented, accepted for MVP.

---

### L-2: Single operator centralization

| Field | Detail |
|-------|--------|
| **Severity** | Design |
| **Contracts** | `AssetHubVault.sol`, `XCMProxy.sol` |

**Description:**
Both contracts use a single `operator` address that controls all critical operational functions: investment dispatch, execution confirmation, liquidation, swap-and-return, and settlement. Compromise of this single key grants full control over all user positions and fund flows.

**Mitigation:**
- Acceptable for MVP with limited TVL.
- Multi-sig (Gnosis Safe) planned for mainnet operator role.
- Emergency admin (separate key) can pause XCMProxy independently.

**Status:** Documented, accepted for MVP.

---

### L-3: XCM fire-and-forget (no delivery proof)

| Field | Detail |
|-------|--------|
| **Severity** | Design |
| **Contracts** | Both |

**Description:**
XCM messages sent from either chain cannot be verified for delivery on-chain. The `IXcm.send()` call on Asset Hub and the `IPalletXcm.transferAssetsUsingTypeAndThenAddress()` call on Moonbeam both succeed if the message is dispatched, but there is no on-chain proof that the remote chain received and executed the message.

**Mitigation:**
- Backend monitors events on both chains and implements retry logic via `XcmRetryService` with exponential backoff.
- `event-listener.service.ts` wraps all orchestration paths with `executeWithRetry()`.
- Failed XCM operations are logged and marked with FAILED status for manual review.

**Status:** Documented, accepted as inherent XCM limitation.

---

### L-4: `_splitForDualSided` in-range revert

| Field | Detail |
|-------|--------|
| **Severity** | Known Bug |
| **Contract** | `XCMProxy.sol` |
| **Location** | `_splitForDualSided()` (line 1193) |

**Description:**
The `_splitForDualSided()` function reverts with `InsufficientSwappedFunding` for in-range positions under certain market conditions. The swap-based token splitting logic does not account for all edge cases in the price impact / slippage interaction, causing the NFPM mint to fail when both tokens are required.

Single-sided (out-of-range) positions work correctly because they bypass `_splitForDualSided()` entirely.

**Status:** Known issue, requires separate investigation. Single-sided positions remain the primary supported path.

---

### L-5: emergencyCancelPending may orphan positions

| Field | Detail |
|-------|--------|
| **Severity** | Operational |
| **Contract** | `AssetHubVault.sol` |
| **Location** | `emergencyCancelPending()` (line 609) |

**Description:**
The `emergencyCancelPending()` function on Asset Hub marks a position as `Liquidated` and refunds the user's balance, but does not send any notification to the Moonbeam XCMProxy. If the XCM message had already arrived on Moonbeam and created a `PendingPosition`, that pending position will remain in the XCMProxy's state indefinitely.

**Mitigation:**
- This is an emergency-only function, not part of normal flow.
- Backend operational runbook covers cross-chain cleanup: after calling `emergencyCancelPending()` on Asset Hub, the operator must also call `cancelPendingPosition()` on Moonbeam XCMProxy.

**Status:** Documented, accepted for emergency use.

---

### L-6: Compiler runs=1 for production

| Field | Detail |
|-------|--------|
| **Severity** | Config |
| **Location** | `hardhat.config.js` |

**Description:**
The Hardhat configuration uses `optimizer_runs=1`, which optimizes for deployment cost (smaller bytecode) at the expense of runtime gas costs. For a production contract that will be called many times, `runs=200` (the Foundry default already in use for `forge build`) would reduce per-call gas costs for users and operators.

**Recommendation:**
Use `optimizer_runs=200` in the Hardhat config for mainnet deployments. The increase in deployment cost is negligible compared to cumulative gas savings across all future transactions.

**Status:** Documented, no code change required.

---

## Recommendations

1. **Multi-sig operator** -- Replace single EOA operator with Gnosis Safe for mainnet. Both `AssetHubVault.operator` and `XCMProxy.operator` should be multi-sig addresses to prevent single-key compromise from controlling all fund flows.

2. **Atomic XCM settlements** -- Implement SCALE-encoded XCM Transact for trustless settlement. The Moonbeam XCMProxy should construct an on-chain XCM message containing the computed settlement amount, calling `AssetHubVault.settleLiquidation()` atomically without backend involvement.

3. **Formal verification** -- Consider formal verification for the settlement accounting logic in `AssetHubVault.settleLiquidation()` and the token swap/split logic in `XCMProxy._splitForDualSided()`. These are the highest-value targets for mathematical proof of correctness.

4. **Time-locked admin** -- Add a timelock to admin operations (`setMaxSettlementMultiplier`, `addChain`, `removeChain`, `setXcmPrecompile`, etc.) for mainnet. This gives users time to react to configuration changes and exit positions if desired.

5. **Optimizer runs** -- Use `optimizer_runs=200` in the Hardhat configuration for mainnet deployments to reduce per-transaction gas costs. Align with the existing Foundry configuration.

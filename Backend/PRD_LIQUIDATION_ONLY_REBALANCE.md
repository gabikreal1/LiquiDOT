# PRD — Liquidation‑Only Rebalance (Quote‑Gated) + AssetHub Settlement

Date: 2025-12-21

## 1) Summary
LiquiDOT rebalancing cannot partially reduce LP positions. The only exit primitive is full liquidation on Moonbeam (via `XCMProxy.liquidateSwapAndReturn`) followed by settlement on Asset Hub (via `AssetHubVault.settleLiquidation`).

This PRD defines:
- A **liquidation-only rebalance lifecycle**.
- **Quote-before-swap** slippage protection for liquidations (and future swaps).
- Optional **auto-settlement** by backend relayer.
- Required backend persistence + API changes.

## 2) Goals
1. **Reliable exits**: Execute rebalances by exiting positions via liquidation only.
2. **User-protect slippage**: Liquidations should only execute if the quote-implied output is within user-defined slippage.
3. **Operational correctness**: Positions must reflect real on-chain state (pending liquidation → liquidated).
4. **Withdrawability**: After AssetHub settlement, users can withdraw from AssetHubVault.

## 3) Non‑Goals (for this milestone)
- Partial reductions/decreaseLiquidity rebalances.
- Advanced price protection (sqrt limits) beyond basic min-out.
- Multi-hop routing / dynamic path finding.
- Full off-chain USD pricing for liquidation proceeds.

## 4) System Model
### 4.1 Contracts
**Moonbeam**
- `XCMProxy.liquidateSwapAndReturn(positionId, baseAsset, destination, minOut0, minOut1, limitSqrtPrice, assetHubPositionId)`
  - Liquidates LP, swaps token0/token1 proceeds to `baseAsset`, then returns `baseAsset` to Asset Hub via XTokens.
  - Emits `LiquidationCompleted(positionId, assetHubPositionId, user, baseAsset, totalReturned)`.
- `XCMProxy.quoteExactInputSingle(tokenIn, tokenOut, amountIn, limitSqrtPrice)`
  - Returns expected `amountOut` using Algebra quoter.

**Asset Hub**
- `AssetHubVault.settleLiquidation(positionId, receivedAmount, ...)` (exact args per contract)
  - Finalizes liquidation accounting on AssetHub.
  - Emits `LiquidationSettled(positionId, user, receivedAmount, expectedAmount)`.

### 4.2 Backend
Key modules:
- Investment decision execution: `InvestmentDecisionService.executeDecision`
- Position tracking:
  - periodic sync (`PositionSyncService`)
  - event listeners (`PositionEventsService`)

## 5) User Experience
### 5.1 Preferences
User sets a liquidation slippage tolerance:
- `liquidationMaxSlippageBps` (0–10_000)

Meaning:
- slippage is enforced per swap in liquidation.
- liquidation reverts if realized output < `minOut`.

Defaults:
- 100 bps (1%) recommended default.

### 5.2 Rebalance execution
When user triggers (or system triggers) “rebalance”:
1) backend computes a decision
2) for each `toWithdraw`, backend attempts liquidation with quote-based min-outs
3) positions become LIQUIDATION_PENDING
4) later, status becomes LIQUIDATED when AssetHub settles

### 5.3 Withdraw
User can withdraw from AssetHubVault once liquidation is settled and funds are credited.

## 6) Functional Requirements
### 6.1 Quote‑gated liquidation
For each liquidation attempt:
1) Determine the expected amounts to swap:
   - token0, token1
   - amount0, amount1 (released by liquidation)
2) Quote expected outputs:
   - `quoteOut0 = quoteExactInputSingle(token0, baseAsset, amount0, limitSqrtPrice)` (if token0 != baseAsset)
   - `quoteOut1 = quoteExactInputSingle(token1, baseAsset, amount1, limitSqrtPrice)` (if token1 != baseAsset)
3) Compute min-outs from slippage bps:
   - `minOut = floor(quoteOut * (10000 - bps) / 10000)`
4) Call `liquidateSwapAndReturn` with `minOut0/minOut1`.

If quoting fails:
- do not liquidate
- log and keep the position active; retry next rebalance.

### 6.2 Position lifecycle persistence
Statuses:
- `ACTIVE`
- `LIQUIDATION_PENDING`
- `LIQUIDATED`

Transitions:
- ACTIVE → LIQUIDATION_PENDING when backend initiates liquidation
- LIQUIDATION_PENDING stays until AssetHub emits `LiquidationSettled`
- LIQUIDATED terminal

### 6.3 Settlement
Two modes:
- **Manual settlement** (default): operator calls AssetHub settle externally.
- **Auto settlement** (optional): backend relayer calls settle when Moonbeam emits `LiquidationCompleted`.

Config:
- `AUTO_SETTLE_LIQUIDATIONS=true|false`

Idempotency:
- settlement calls must be guarded to avoid double-settlement.

## 7) API changes
### 7.1 Preferences API
- Add `liquidationMaxSlippageBps` to preferences GET/PUT payload.

### 7.2 Decision execution
No new endpoints required, but execution logic changes:
- `executeDecision` must quote before liquidation per position.

## 8) Data Model changes
- `UserPreference.liquidationMaxSlippageBps: number` (int)
- `Position.status` includes `LIQUIDATION_PENDING`
- Optional: `Position.lastSettlementTxHash` / `Position.lastLiquidationTxHash` (future)

## 9) Observability
- Log per-position liquidation attempt with:
  - position ids
  - slippage bps
  - quoted outputs
  - min-outs
  - tx hash (if available)

Metrics (future):
- liquidation attempts / success / revert rate
- settlement lag time

## 10) Security & Safety
- Enforce `0 <= bps <= 10000`.
- If `minOut` computed is 0 while quoteOut > 0, proceed (minOut=0 means no safety); warn.
- Default configuration should favor safety (e.g., 1% limit).

## 11) Milestones
MVP (this PRD):
- store per-user slippage bps
- quote-gated liquidation attempts
- position lifecycle updates via events
- optional auto-settle behind env flag
- unit tests


## 12) Open Questions
1) How to obtain `amount0/amount1` to quote before liquidation?
   - Option A: add XCMProxy view/sim function to preview liquidation amounts.
   - Option B: estimate off-chain from NFPM + pool state.

This PRD assumes we will use **Option A** for correctness.

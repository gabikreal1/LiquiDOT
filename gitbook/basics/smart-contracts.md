---
icon: file-contract
---

# Smart Contracts

LiquiDOT uses two production-focused contracts that coordinate via XCM to create and manage liquidity positions across chains. This section documents only what’s implemented today.

## Contract overview

| Contract | Chain | Purpose |
|----------|-------|---------|
| AssetHubVault | Asset Hub (Paseo) | Custody, accounting, and XCM dispatch |
| XCMProxy | Moonbeam (Moonbase) | Execution engine for swaps, LP mint/burn, and XCM returns |

Links to source:
- AssetHubVault: `SmartContracts/contracts/V1(Current)/AssetHubVault.sol`
- XCMProxy: `SmartContracts/contracts/V1(Current)/XCMProxy.sol`

---

## AssetHubVault

Role: primary custody layer and orchestrator on Asset Hub. Holds user balances, starts cross-chain investments, confirms execution, and settles liquidations. Uses only the IXcm precompile available on Asset Hub.

### Access and roles
- admin: configuration and pausing
- operator: dispatch operations and confirmations
- emergency: emergency liquidation

### Key state
- userBalances: ETH/native balance per user
- positions: positionId => Position { user, poolId, baseAsset, chainId, range percents, status, amount, remotePositionId, timestamp }
- supportedChains: chainId => { supported, xcmDestination, chainName, timestamp }
- chainExecutors: chainId => authorized remote executor (optional)
- testMode: skips actual XCM send for local testing

### Events (selected)
- Deposit, Withdrawal
- InvestmentInitiated(positionId, user, chainId, poolId, amount)
- PositionExecutionConfirmed(positionId, chainId, remotePositionId, liquidity)
- LiquidationSettled(positionId, user, receivedAmount, expectedAmount)
- PositionLiquidated(positionId, user, finalAmount)
- ChainAdded/Removed, ExecutorUpdated
- XCMMessageSent, XcmSendAttempt

### Errors (selected)
NotAdmin, NotOperator, NotEmergency, Paused, ZeroAddress, AmountZero, InsufficientBalance, InvalidRange, XcmPrecompileNotSet, ChainNotSupported, ChainIdMismatch, ExecutorNotAuthorized

### External interface (what you can call)
- deposit() external payable
- withdraw(uint256 amount) external
- addChain(uint32 chainId, bytes xcmDestination, string chainName, address executor) external onlyAdmin
- removeChain(uint32 chainId) external onlyAdmin
- updateChainExecutor(uint32 chainId, address executor) external onlyAdmin
- dispatchInvestment(address user, uint32 chainId, address poolId, address baseAsset, uint256 amount, int24 lowerRangePercent, int24 upperRangePercent, bytes destination, bytes preBuiltXcmMessage) external onlyOperator
- confirmExecution(bytes32 positionId, bytes32 remotePositionId, uint128 liquidity) external onlyOperator
- settleLiquidation(bytes32 positionId, uint256 receivedAmount) external onlyOperator
- emergencyLiquidatePosition(uint32 chainId, bytes32 positionId) external payable onlyEmergency
- getUserBalance(address user) external view returns (uint256)
- isPositionActive(address user, bytes32 positionId) external view returns (bool)
- Pagination helpers: getUserPositionCount, getUserPositionIds, getUserPositionsPage, getUserPositionsByStatus, getUserPositionStats, getUserPositions
- getPosition(bytes32 positionId) external view returns (Position)
- receive() external payable

### Admin config
- setXcmPrecompile(address); freezeXcmPrecompile()
- setTestMode(bool)
- pause()/unpause()
- transferAdmin(address), setOperator(address), setEmergency(address)

---

## XCMProxy

Role: execution engine on Moonbeam. Receives assets and instructions via XCM, performs swaps and LP mint/burn with Algebra’s NFPM, tracks positions, and returns proceeds to Asset Hub. Includes optional Moonbeam XCM-Transactor integration for remote runtime calls.

### Access and roles
- owner: contract admin (can set integrations and XCM config)
- operator: executes investments and liquidations

### Key state
- supportedTokens: allowlist for inbound assets
- pendingPositions: assetHubPositionId => PendingPosition
- positions: local position registry (owner, pool, tokens, ticks, liquidity, nfpm tokenId, ranges, entryPrice, timestamp, active)
- Integrations: quoterContract, swapRouterContract, nfpmContract
- XCM config: xTokensPrecompile, defaultDestWeight, assetHubParaId, trustedXcmCaller, xcmTransactorPrecompile, defaultSlippageBps, testMode

### Events (selected)
- AssetsReceived, PendingPositionCreated, PositionExecuted, PositionCreated, LiquidityAdded
- PositionLiquidated, LiquidationCompleted, PendingPositionCancelled
- AssetsReturned, ProceedsSwapped
- Config events: XTokensPrecompileSet, DefaultDestWeightSet, AssetHubParaIdSet, TrustedXcmCallerSet, XcmConfigFrozen, XcmTransactorPrecompileSet, DefaultSlippageSet, OperatorUpdated

### External interface (what you can call)
Configuration:
- setIntegrations(address quoter, address router) onlyOwner
- setNFPM(address nfpm) onlyOwner
- setXTokensPrecompile, setDefaultDestWeight, setAssetHubParaId, setTrustedXcmCaller, freezeXcmConfig (onlyOwner)
- setXcmTransactorPrecompile(address), setDefaultSlippageBps(uint16) (onlyOwner)
- setOperator(address) onlyOwner, setTestMode(bool) onlyOwner, pause()/unpause() onlyOwner

XCM and execution:
- receiveAssets(address token, address user, uint256 amount, bytes investmentParams) external
  - Called via XCM; records a PendingPosition keyed by AssetHub position id and emits AssetsReceived/PendingPositionCreated.
- executePendingInvestment(bytes32 assetHubPositionId) external onlyOperator returns (uint256 localPositionId)
  - Swaps as needed, computes ticks from percent ranges, mints via NFPM, records Position, emits PositionExecuted/PositionCreated.
- cancelPendingPosition(bytes32 assetHubPositionId, bytes destination) external onlyOperator
  - Cancels pending and returns funds to Asset Hub via XCM.
- executeFullLiquidation(uint256 positionId) external onlyOperator returns (uint256 amount0, uint256 amount1)
  - Burns liquidity, collects tokens, optionally swaps to base asset, and prepares for return.
- liquidateSwapAndReturn(...) external onlyOperator
  - Burn → swap via router → send back via XCM; emits ProceedsSwapped/AssetsReturned.
- returnAssets(address token, address user, uint256 amount, bytes destination) external onlyOwner
  - Sends assets back to Asset Hub using XTokens/XCM when configured.

Queries and helpers:
- calculateTickRange(int24 lowerRangePercent, int24 upperRangePercent) public view returns (int24 bottomTick, int24 topTick)
- isPositionOutOfRange(uint256 positionId) public view returns (bool outOfRange, uint256 currentPrice)
- collectFees(uint256 positionId) external returns (uint256 amount0, uint256 amount1)
- swapExactInputSingle(..., uint160 limitSqrtPrice) external onlyOwner returns (uint256 amountOut)
- quoteExactInputSingle(..., uint160 limitSqrtPrice) external returns (uint256 amountOut)
- getActivePositions() external view returns (Position[] memory)
- getUserPositions(address user) external view returns (uint256[] memory)
- addSupportedToken/removeSupportedToken (onlyOwner)

Moonbeam XCM-Transactor helper:
- buildPalletCallBytes(uint8 palletIndex, uint8 callIndex, bytes args) pure returns (bytes)
- remoteCallAssetHub(uint16 feeLocation, uint64 weightAtMost, bytes call, uint256 feeAmount, uint64 overallWeight) external onlyOwner

---

## Flows (concise)

Investment
1) User deposits native asset to AssetHubVault (deposit)
2) Operator dispatches to a registered chain (dispatchInvestment)
3) Assets + instruction arrive on Moonbeam; XCMProxy receiveAssets → pending
4) Operator executes pending (executePendingInvestment) → LP minted via NFPM
5) Operator confirms on AssetHub (confirmExecution)

Liquidation
1) Operator triggers executeFullLiquidation/liquidateSwapAndReturn on XCMProxy
2) Proceeds are swapped to base asset and returned (returnAssets)
3) Operator settles on AssetHub (settleLiquidation) → user balance credited

---

## Addresses
See `SmartContracts/deployments/` for deployed testnet addresses and bootstrap configs.

## Notes
This documentation mirrors the current codebase. As features evolve (additional chains, new DEX integrations), this page should track function signatures and events from the Solidity sources referenced above.

---
icon: file-contract
---

# Smart Contracts

LiquiDOT uses two production-focused contracts that coordinate via XCM to create and manage liquidity positions across chains. This section documents only what’s implemented today.

## Contract Overview

### Deployed Contracts

| Contract | Chain | Network | Address |
|----------|-------|---------|---------|
| **AssetHubVault** | Asset Hub | Paseo Testnet | `0x3B0D87f3d0AE4CDC8C0102DAEfB7433aaED15CCF` |
| **XCMProxy** | Moonbeam | Moonbase Alpha | `0xf7749B6A5aD0EB4ed059620B89f14FA8e916ee41` |

### Contract Roles

| Contract | Purpose | Responsibilities |
|----------|---------|-----------------|
| **AssetHubVault** | Custody & Orchestration | • Holds user balances securely<br/>• Initiates cross-chain investments<br/>• Settles liquidation proceeds<br/>• Manages position lifecycle |
| **XCMProxy** | Execution Engine | • Receives assets via XCM<br/>• Executes DEX operations<br/>• Manages LP positions<br/>• Returns proceeds to Asset Hub |

### Source Code

- **AssetHubVault**: `SmartContracts/contracts/V1(Current)/AssetHubVault.sol`
- **XCMProxy**: `SmartContracts/contracts/V1(Current)/XCMProxy.sol`

---

## AssetHubVault

**Location:** Asset Hub (Paseo Testnet)  
**Address:** `0x3B0D87f3d0AE4CDC8C0102DAEfB7433aaED15CCF`

### Overview

Primary custody layer and orchestrator on Asset Hub. Holds user balances, starts cross-chain investments, confirms execution, and settles liquidations. Uses only the IXcm precompile available on Asset Hub.

### Access Roles

| Role | Permissions | Purpose |
|------|-------------|---------|
| **Admin** | Configuration & pausing | System configuration and emergency controls |
| **Operator** | Dispatch operations & confirmations | Execute investment flows and settle liquidations |
| **Emergency** | Emergency liquidation | Force liquidate positions in critical situations |

| Variable | Type | Description |
|----------|------|-------------|
| `userBalances` | `mapping(address => uint256)` | ETH/native balance per user |
| `positions` | `mapping(bytes32 => Position)` | Position details: user, poolId, baseAsset, chainId, range percents, status, amount, remotePositionId, timestamp |
| `supportedChains` | `mapping(uint32 => Chain)` | Registered chains: supported flag, xcmDestination, chainName, timestamp |
| `chainExecutors` | `mapping(uint32 => address)` | Authorized remote executor per chain (optional) |
| `testMode` | `bool` | Skips actual XCM send for local testing |

**User Operations:**
- `Deposit(address indexed user, uint256 amount)`
- `Withdrawal(address indexed user, uint256 amount)`

**Investment Lifecycle:**
- `InvestmentInitiated(bytes32 indexed positionId, address indexed user, uint32 chainId, address poolId, uint256 amount)`
- `PositionExecutionConfirmed(bytes32 indexed positionId, uint32 chainId, bytes32 remotePositionId, uint128 liquidity)`
- `LiquidationSettled(bytes32 indexed positionId, address indexed user, uint256 receivedAmount, uint256 expectedAmount)`
- `PositionLiquidated(bytes32 indexed positionId, address indexed user, uint256 finalAmount)`

**Chain Management:**
- `ChainAdded(uint32 indexed chainId, string chainName)`
- `ChainRemoved(uint32 indexed chainId)`
- `ExecutorUpdated(uint32 indexed chainId, address executor)`

**XCM Operations:**
- `XCMMessageSent(bytes32 messageHash, uint32 chainId)`
- `XcmSendAttempt(uint32 chainId, bool success, bytes reason)`

### Custom Errors

```solidity
NotAdmin, NotOperator, NotEmergency
Paused, ZeroAddress, AmountZero
InsufficientBalance, InvalidRange
XcmPrecompileNotSet, ChainNotSupported
ChainIdMismatch, ExecutorNotAuthorized
```
---

## XCMProxy

**Location:** Moonbeam (Moonbase Alpha)  
**Address:** `0xf7749B6A5aD0EB4ed059620B89f14FA8e916ee41`

### Overview

Execution engine on Moonbeam. Receives assets and instructions via XCM, performs swaps and LP mint/burn with Algebra's NFPM, tracks positions, and returns proceeds to Asset Hub. Includes optional Moonbeam XCM-Transactor integration for remote runtime calls.

### Access Roles

| Role | Permissions | Purpose |
|------|-------------|---------|
| **Owner** | Configuration & admin | Set integrations, XCM config, and system parameters |
| **Operator** | Investment & liquidation execution | Execute pending investments and liquidate positions |

| Variable | Type | Description |
|----------|------|-------------|
| `supportedTokens` | `mapping(address => bool)` | Allowlist for inbound assets |
| `pendingPositions` | `mapping(bytes32 => PendingPosition)` | Positions awaiting execution (keyed by Asset Hub position ID) |
| `positions` | `mapping(uint256 => Position)` | Active positions: owner, pool, tokens, ticks, liquidity, NFPM tokenId, ranges, entryPrice, timestamp, active |
| `quoterContract` | `address` | Algebra Quoter for price quotes |
| `swapRouterContract` | `address` | Algebra SwapRouter for token swaps |
| `nfpmContract` | `address` | Algebra NFPM for LP position management |
| `xTokensPrecompile` | `address` | XTokens precompile for cross-chain transfers |
| `xcmTransactorPrecompile` | `address` | XCM Transactor for remote calls |
| `defaultDestWeight` | `uint64` | Default XCM destination weight |
| `assetHubParaId` | `uint32` | Asset Hub parachain ID |
| `trustedXcmCaller` | `address` | Authorized XCM message sender |
| `defaultSlippageBps` | `uint16` | Default slippage tolerance (basis points) |
| `testMode` | `bool` | Skip XCM sends for local testing |

### Events
- AssetsReceived, PendingPositionCreated, PositionExecuted, PositionCreated, LiquidityAdded
- PositionLiquidated, LiquidationCompleted, PendingPositionCancelled
- AssetsReturned, ProceedsSwapped
- Config events: XTokensPrecompileSet, DefaultDestWeightSet, AssetHubParaIdSet, TrustedXcmCallerSet, XcmConfigFrozen, XcmTransactorPrecompileSet, DefaultSlippageSet, OperatorUpdated

```solidity
// DEX Integration
function setIntegrations(address quoter, address router) external onlyOwner
function setNFPM(address nfpm) external onlyOwner

// XCM Configuration
function setXTokensPrecompile(address xTokens) external onlyOwner
function setDefaultDestWeight(uint64 weight) external onlyOwner
function setAssetHubParaId(uint32 paraId) external onlyOwner
function setTrustedXcmCaller(address caller) external onlyOwner
function freezeXcmConfig() external onlyOwner
function setXcmTransactorPrecompile(address xcmTransactor) external onlyOwner

// System Settings
function setDefaultSlippageBps(uint16 slippageBps) external onlyOwner
function setOperator(address newOperator) external onlyOwner
function setTestMode(bool enabled) external onlyOwner

// Token Management
function addSupportedToken(address token) external onlyOwner
function removeSupportedToken(address token) external onlyOwner

// Emergency Controls
function pause() external onlyOwner
function unpause() external onlyOwner
```

#### XCM & Execution Functions

```solidity
// Receive assets and create pending position (called via XCM)
function receiveAssets(
    address token,
    address user,
    uint256 amount,
    bytes calldata investmentParams
) external

// Execute pending investment
function executePendingInvestment(
    bytes32 assetHubPositionId
) external onlyOperator returns (uint256 localPositionId)

// Cancel pending position and return funds
function cancelPendingPosition(
    bytes32 assetHubPositionId,
    bytes calldata destination
) external onlyOperator

// Full liquidation (burn LP, collect fees)
function executeFullLiquidation(
    uint256 positionId
) external onlyOperator returns (uint256 amount0, uint256 amount1)

// Liquidate, swap to base asset, and return via XCM
function liquidateSwapAndReturn(
    uint256 positionId,
    address baseAsset,
    uint256 minAmountOut,
    bytes calldata destination
) external onlyOperator

// Return assets to Asset Hub
function returnAssets(
    address token,
    address user,
    uint256 amount,
    bytes calldata destination
) external onlyOwner
```

#### Query & Helper Functions

```solidity
// Calculate tick range from percentage ranges
function calculateTickRange(
    int24 lowerRangePercent,
    int24 upperRangePercent
) public view returns (int24 bottomTick, int24 topTick)

// Check if position is out of range
function isPositionOutOfRange(
    uint256 positionId
) public view returns (bool outOfRange, uint256 currentPrice)

// Collect accumulated fees
function collectFees(
    uint256 positionId
) external returns (uint256 amount0, uint256 amount1)

// Execute swap
function swapExactInputSingle(
    address tokenIn,
    address tokenOut,
    address recipient,
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint160 limitSqrtPrice
) external onlyOwner returns (uint256 amountOut)

// Get swap quote
function quoteExactInputSingle(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint160 limitSqrtPrice
) external returns (uint256 amountOut)

// Get all active positions
function getActivePositions() external view returns (Position[] memory)

// Get user's positions
function getUserPositions(address user) external view returns (uint256[] memory)
```

#### Moonbeam XCM-Transactor Helpers

```solidity
// Build pallet call bytes for remote execution
function buildPalletCallBytes(
    uint8 palletIndex,
    uint8 callIndex,
    bytes calldata args
) external pure returns (bytes memory)

// Execute remote call on Asset Hub
function remoteCallAssetHub(
    uint16 feeLocation,
    uint64 weightAtMost,
    bytes calldata call,
    uint256 feeAmount,
    uint64 overallWeight
) external onlyOwner
```

---

## Contract Flows

### Investment Flow

```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'fontSize':'16px'}}}%%
sequenceDiagram
    autonumber
    participant User
    participant AVault as 💎 AssetHubVault
    participant XCM as 🔗 XCM Layer
    participant Proxy as 🌙 XCMProxy
    participant DEX as 💧 Algebra NFPM
    
    User->>+AVault: deposit()
    Note over AVault: Balance updated
    AVault-->>-User: Deposit confirmed
    
    User->>+AVault: Request investment
    AVault->>AVault: Lock funds
    AVault->>+XCM: dispatchInvestment()
    XCM->>+Proxy: receiveAssets()
    Note over Proxy: Create PendingPosition
    Proxy-->>-XCM: Assets received
    
    Proxy->>+Proxy: executePendingInvestment()
    Proxy->>Proxy: Swap tokens if needed
    Proxy->>+DEX: Mint LP position
    DEX-->>-Proxy: NFT tokenId, liquidity
    Note over Proxy: Position recorded
    Proxy-->>-Proxy: Position executed
    
    Proxy-->>XCM: Execution complete
    XCM-->>-AVault: Confirmation
    AVault->>AVault: confirmExecution()
    AVault-->>User: Investment active
```

### Liquidation Flow

```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'fontSize':'16px'}}}%%
sequenceDiagram
    autonumber
    participant Monitor as ⚡ Stop-Loss Worker
    participant Proxy as 🌙 XCMProxy
    participant DEX as 💧 Algebra NFPM
    participant XCM as 🔗 XCM Layer
    participant AVault as 💎 AssetHubVault
    participant User
    
    Monitor->>+Proxy: Trigger liquidation
    Note over Monitor: Out of range detected
    
    Proxy->>+Proxy: executeFullLiquidation()
    Proxy->>+DEX: Burn LP position
    DEX-->>-Proxy: Token0, Token1, fees
    
    Proxy->>Proxy: Swap to base asset
    Note over Proxy: Convert all to DOT
    
    Proxy->>+XCM: returnAssets()
    XCM->>+AVault: Transfer proceeds
    Note over AVault: Assets received
    AVault->>AVault: settleLiquidation()
    AVault->>AVault: Credit user balance
    AVault-->>-User: Proceeds available
    
    Proxy-->>-XCM: Return complete
    XCM-->>-Monitor: Liquidation confirmed
```

---

## Additional Resources

### Deployment Information

For complete deployment details including:
- Bootstrap configurations
- DEX integration addresses
- Testnet faucets
- Verification links

See: `SmartContracts/deployments/`

### Testing

Comprehensive test suites available:
- Unit tests: `SmartContracts/test/AssetHubVault/*.test.js`
- Integration tests: `SmartContracts/test/XCMProxy/*.test.js`
- E2E flows: `SmartContracts/test/Integration/*.test.js`

### Related Documentation

- [Contract Deployment Guide](contract-deployment.md) - Step-by-step deployment instructions
- [Testing Guide](testing-guide.md) - How to test the contracts
- [Architecture Overview](architecture.md) - System design and data flow

---

## Notes

This documentation mirrors the current codebase. As features evolve (additional chains, new DEX integrations), this page will be updated to track function signatures and events from the Solidity sources referenced above.

**Last Updated:** October 2025  
**Contract Version:** V1 (Current)

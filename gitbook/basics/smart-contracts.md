---
icon: file-contract
---

# Smart Contracts

LiquiDOT's smart contract architecture consists of two primary contracts that work in tandem through XCM messaging to enable secure cross-chain liquidity management.

## Contract Overview

| Contract | Chain | Purpose | Language |
|----------|-------|---------|----------|
| Asset Hub Vault | Asset Hub (Paseo) | Custody & Orchestration | Solidity |
| XCM Proxy | Moonbeam (Moonbase) | Execution & DEX Integration | Solidity |

## Asset Hub Vault Contract

### Location & Purpose

**Deployed on:** Asset Hub / Paseo testnet  
**Primary Role:** Secure custody and cross-chain orchestration

The Asset Hub Vault Contract serves as the primary custody and accounting layer for user deposits, implementing a secure vault pattern with integrated XCM messaging capabilities. This contract acts as the single source of truth for user balances and orchestrates all cross-chain operations.

### Core Responsibilities

* **User Balance Management** - Tracks individual user deposits and withdrawals
* **Asset Custody** - Securely holds user funds using battle-tested vault patterns
* **Investment Orchestration** - Initiates cross-chain LP investments via XCM
* **Proceeds Management** - Receives liquidation proceeds from cross-chain positions
* **Multi-Modal Liquidation** - Supports emergency and strategic operations
* **Operation State Tracking** - Maintains investment history
* **Access Control** - Implements role-based permissions

### Key Functions

#### User Operations

```solidity
function deposit(uint256 amount, address asset) external
```
Accept user deposits with automatic balance updates.

**Parameters:**
* `amount` - Amount to deposit (in wei/smallest unit)
* `asset` - Token contract address

**Events:** `Deposited(user, asset, amount, timestamp)`

---

```solidity
function withdraw(uint256 amount, address asset) external
```
Process withdrawals with safety checks and balance verification.

**Parameters:**
* `amount` - Amount to withdraw
* `asset` - Token contract address

**Requires:**
* Sufficient balance
* No active locks on funds

**Events:** `Withdrawn(user, asset, amount, timestamp)`

#### Investment Management

```solidity
function investInPool(
    uint256 chainId,
    address poolId,
    address baseAsset,
    uint256[] amounts,
    int24 lowerRange,
    int24 upperRange
) external onlyInvestmentWorker
```
Initiate cross-chain LP investment via XCM.

**Parameters:**
* `chainId` - Target parachain ID (e.g., Moonbeam)
* `poolId` - DEX pool address
* `baseAsset` - Initial deposit token
* `amounts` - Token amounts for LP
* `lowerRange` - Lower price range (percentage)
* `upperRange` - Upper price range (percentage)

**Access:** Investment Decision Worker only

**Process:**
1. Validates user has sufficient balance
2. Locks funds for investment
3. Constructs XCM message with investment instructions
4. Transfers assets + instructions to target chain
5. Records pending investment

**Events:** `InvestmentInitiated(user, chainId, poolId, amount, timestamp)`

---

```solidity
function receiveProceeds(
    uint256 chainId,
    bytes32 positionId,
    uint256[] finalAmounts
) external onlyXCMProxy
```
Receive liquidation proceeds from XCM Proxy.

**Parameters:**
* `chainId` - Source parachain
* `positionId` - LP position identifier
* `finalAmounts` - Returned token amounts

**Access:** XCM Proxy only (via XCM)

**Process:**
1. Validates position exists
2. Credits user's balance
3. Updates position status to 'closed'
4. Records final P&L

**Events:** `ProceedsReceived(user, positionId, amounts, profit, timestamp)`

#### Emergency Functions

```solidity
function emergencyLiquidatePosition(
    uint256 chainId,
    bytes32 positionId
) external onlyAdmin
```
Emergency liquidation override (admin only).

**Use Cases:**
* System security threats
* Critical bugs detected
* User protection

---

```solidity
function rebalancePosition(
    uint256 chainId,
    bytes32 positionId
) external onlyInvestmentWorker
```
Strategic position rebalancing for portfolio optimization.

---

```solidity
function emergencyPause() external onlyAdmin
```
Circuit breaker for system-wide operations.

#### Query Functions

```solidity
function getUserBalance(address user, address asset) 
    external view returns (uint256)
```
Query user balance for specific asset.

---

```solidity
function getActiveInvestments(address user) 
    external view returns (Investment[] memory)
```
Query user's active cross-chain positions.

### Contract Initialization

```solidity
function initialize(
    address[] memory _supportedAssets,
    XCMDestination[] memory _xcmDestinations,
    address _investmentDecisionWorker,
    address _feeCollector,
    address _emergencyAdmin
) external initializer
```

**Configuration:**
* List of supported tokens
* XCM destination configurations
* Authorized worker addresses
* Fee collection address
* Emergency admin

### State Variables

```solidity
// User balances: user => asset => amount
mapping(address => mapping(address => uint256)) public balances;

// Active investments: user => Investment[]
mapping(address => Investment[]) public activeInvestments;

// Position tracking: positionId => PositionData
mapping(bytes32 => PositionData) public positions;

// Access control
address public investmentDecisionWorker;
address public emergencyAdmin;
bool public paused;
```

## XCM Proxy Contract

### Location & Purpose

**Deployed on:** Moonbeam / Moonbase Alpha testnet  
**Primary Role:** Execution engine for DEX interactions

The XCM Proxy Contract functions as the execution engine for all DEX interactions, implementing sophisticated liquidity management with automated position monitoring.

### Core Responsibilities

* **Cross-Chain Asset Reception** - Receive assets via XCM
* **Token Swapping** - Execute optimal swaps for LP ratios
* **Asymmetric Range LP Management** - Handle flexible price ranges
* **Dynamic Tick Conversion** - Convert percentages to precise ticks
* **Position Tracking** - Maintain comprehensive position records
* **Advanced DEX Integration** - Full Algebra protocol integration
* **Multi-Source Liquidation** - Handle various liquidation triggers
* **Security Validation** - Verify position health before liquidation

### Key Functions

#### Cross-Chain Investment Execution

```solidity
function executeInvestment(
    address baseAsset,
    uint256[] amounts,
    address poolId,
    int24 lowerRangePercent,
    int24 upperRangePercent,
    address positionOwner
) external onlyOwner
```
Complete investment flow: receive assets, swap if needed, mint LP position.

**Process:**
1. Receive assets from Asset Hub via XCM
2. Calculate optimal token ratio for LP
3. Execute swaps if needed
4. Convert percentage ranges to ticks
5. Mint LP position on Algebra
6. Record position data

**Access:** Asset Hub Vault only (via XCM)

---

```solidity
function processSwapAndMint(
    IAlgebraPool pool,
    address token0,
    address token1,
    int24 lowerRangePercent,
    int24 upperRangePercent,
    uint128 liquidityDesired,
    address positionOwner
) internal returns (bytes32 positionId)
```
Internal function to handle token swapping and LP minting.

---

```solidity
function calculateOptimalSwap(
    address baseAsset,
    address targetToken0,
    address targetToken1,
    uint256[] amounts
) internal view returns (uint256 swapAmount)
```
Determine optimal swap amounts for LP position.

#### Liquidity Management

```solidity
function calculateTickRange(
    IAlgebraPool pool,
    int24 lowerRangePercent,
    int24 upperRangePercent
) internal view returns (int24 bottomTick, int24 topTick)
```
Convert asymmetric percentage ranges to precise tick boundaries.

**Example:**
```
Current price: $100
lowerRangePercent: -5 (5% below)
upperRangePercent: +10 (10% above)

Output:
bottomTick: tick at $95
topTick: tick at $110
```

---

```solidity
function executeBurn(
    IAlgebraPool pool,
    int24 bottomTick,
    int24 topTick,
    uint128 liquidity
) internal returns (uint256 amount0, uint256 amount1)
```
Remove liquidity from existing position with automatic token collection.

---

```solidity
function findPosition(
    IAlgebraPool pool,
    int24 bottomTick,
    int24 topTick
) public view returns (Position memory)
```
Locate specific position by pool and tick range.

---

```solidity
function getActivePositions() 
    external view returns (Position[] memory)
```
Query all active LP positions for stop-loss monitoring.

---

```solidity
function getUserPositions(address user) 
    external view returns (Position[] memory)
```
Get all positions owned by specific user with range details.

#### Stop-Loss & Liquidation

```solidity
function getPositionDetails(bytes32 positionId) 
    external view returns (PositionDetails memory)
```
Provide raw position data for backend analysis:
* Entry price
* Price ranges (percentage)
* Token amounts
* Pool information
* Current tick

---

```solidity
function executeFullLiquidation(
    bytes32 positionId,
    LiquidationType liquidationType
) external
```
Complete liquidation flow with validation.

**Process:**
1. Validate liquidation is authorized
2. Verify position is out of range (if stop-loss)
3. Burn LP position
4. Collect tokens
5. Swap to base asset
6. Return proceeds to Asset Hub via XCM

**Liquidation Types:**
* `STOP_LOSS` - Price hit stop-loss threshold
* `TAKE_PROFIT` - Price hit profit target
* `EMERGENCY` - Admin override
* `REBALANCE` - Strategic reposition

---

```solidity
function isPositionOutOfRange(bytes32 positionId) 
    internal view returns (bool)
```
Validate if position is actually beyond user's asymmetric range.

**Security Check:** Prevents unauthorized liquidations.

---

```solidity
function swapToBaseAsset(
    uint256 token0Amount,
    uint256 token1Amount,
    address baseAsset
) internal returns (uint256 baseAssetAmount)
```
Convert position tokens back to original base asset.

#### Asset Management

```solidity
function receiveAssets(
    address token,
    address user,
    uint256 amount,
    bytes calldata investmentParams
) external onlyOwner
```
Receive assets and investment instructions from Asset Hub via XCM.

**Access:** Asset Hub only

---

```solidity
function returnAssets(
    address token,
    address user,
    uint256 amount,
    address recipient
) external onlyOwner
```
Return liquidation proceeds to Asset Hub via XCM.

#### DEX Integration

```solidity
function swapExactInputSingle(
    address tokenIn,
    address tokenOut,
    address recipient,
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint160 limitSqrtPrice
) external returns (uint256 amountOut)
```
Execute exact input swaps for position liquidations.

---

```solidity
function quoteExactInputSingle(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint160 limitSqrtPrice
) external returns (uint256 amountOut)
```
Get real-time swap quotes without execution.

---

```solidity
function algebraMintCallback(
    uint256 amount0,
    uint256 amount1,
    bytes calldata data
) external override
```
Handle Algebra pool mint callbacks securely.

### Contract Initialization

```solidity
constructor(
    address _owner,           // Asset Hub contract address
    address _quoterContract,  // Algebra Quoter
    address _swapRouterContract // Algebra SwapRouter
) {
    owner = _owner;
    quoterContract = _quoterContract;
    swapRouterContract = _swapRouterContract;
}
```

### State Variables

```solidity
// Position tracking: positionId => Position
mapping(bytes32 => Position) public positions;

// User positions: user => positionId[]
mapping(address => bytes32[]) public userPositions;

// DEX integration
address public quoterContract;
address public swapRouterContract;

// Access control
address public owner; // Asset Hub contract
```

## Integration Architecture

### Cross-Chain Investment Flow

```
1. User deposits → Asset Hub Vault
2. Decision Worker → Asset Hub: investInPool()
3. Asset Hub → XCM Message → Moonbeam
4. XCM Proxy: executeInvestment()
   ├── Swap tokens (if needed)
   ├── Calculate tick ranges
   └── Mint LP on Algebra
5. Position active and monitored
```

### Liquidation Flow

```
1. Stop-Loss Worker detects trigger
2. Worker → XCM Proxy: executeFullLiquidation()
3. XCM Proxy validates position health
4. Burn LP → Collect tokens
5. Swap to base asset
6. XCM Proxy → Asset Hub: returnAssets()
7. Asset Hub credits user balance
```

## Security Features

### Access Control
* **Role-Based Permissions** - Only authorized contracts can call sensitive functions
* **XCM Validation** - Verify messages come from trusted sources
* **Owner-Only Functions** - Critical operations require owner authority

### Safety Mechanisms
* **Reentrancy Guards** - Protect against reentrancy attacks
* **Validation Checks** - Verify position health before liquidation
* **Emergency Pause** - Circuit breaker for system issues
* **Balance Verification** - Ensure sufficient funds before operations

### Testing Coverage
* **Unit Tests** - Individual function testing
* **Integration Tests** - Cross-contract testing
* **Testnet Deployment** - Real-world validation
* **Security Audits** - Professional code review (planned)

## Gas Optimization

* Efficient storage patterns
* Minimal cross-contract calls
* Batched operations where possible
* Optimized loop iterations
* Cached calculations

## Contract Addresses

### Testnet Deployments

**Moonbase Alpha:**
* XCM Proxy: `0x...` (see deployments/)
* Algebra Pool Factory: `0x...`
* Swap Router: `0x...`

**Paseo Asset Hub:**
* Asset Hub Vault: `0x...` (see deployments/)

## Next Steps

* [Contract Deployment Guide](contract-deployment.md)
* [Testing Guide](testing-guide.md)
* [API Reference](api-reference.md)
* [Architecture Overview](architecture.md)

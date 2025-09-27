# 📜 Smart Contract API Documentation

> Comprehensive technical documentation for LiquiDOT's smart contract architecture

---

## 🏗️ Contract Architecture

LiquiDOT operates on a **two-contract system** designed for maximum security and cross-chain efficiency:

- **[AssetHubVault](#assethubvault)** - Custody and orchestration on Asset Hub
- **[XCMProxy](#xcmproxy)** - Execution engine on Moonbeam

---

## 🏦 AssetHubVault

> **Location**: Asset Hub  
> **Purpose**: Primary custody layer and cross-chain orchestration  
> **Source**: [`AssetHubVault.sol`](../SmartContracts/contracts/V1(Current)/AssetHubVault.sol)

### Core Functions

#### `deposit(address token, uint256 amount)`
Deposit tokens into the vault for LP management.

**Parameters:**
- `token` - ERC20 token contract address
- `amount` - Amount to deposit (in token's smallest unit)

**Events:** `Deposit(user, token, amount)`

```solidity
// Example: Deposit 100 USDC
vault.deposit(0x..., 100e6); // 100 USDC with 6 decimals
```

#### `withdraw(address token, uint256 amount)`
Withdraw tokens from your vault balance.

**Parameters:**
- `token` - Token contract address to withdraw
- `amount` - Amount to withdraw

**Requirements:**
- Sufficient balance in vault
- No active positions using the tokens

```solidity
// Example: Withdraw 50 USDC
vault.withdraw(0x..., 50e6);
```

#### `dispatchInvestment(...)`
*Operator-only function to initiate cross-chain investments.*

**Parameters:**
```solidity
function dispatchInvestment(
    address user,
    uint32 chainId,
    address poolId,
    address baseAsset,
    uint256[] memory amounts,
    int24 lowerRangePercent,
    int24 upperRangePercent,
    bytes calldata destination,
    bytes calldata preBuiltXcmMessage
) external onlyOperator
```

**Events:** `InvestmentInitiated(positionId, user, chainId, poolId, amounts)`

#### `handleIncomingXCM(...)`
Processes incoming XCM messages for liquidation proceeds.

**Access:** XCM Precompile or Admin only

---

### View Functions

#### `getUserBalance(address user, address token) → uint256`
Get user's token balance in the vault.

#### `getUserPositions(address user) → Position[]`
Get all positions (active and inactive) for a user.

#### `getPosition(bytes32 positionId) → Position`
Get details of a specific position.

#### `isPositionActive(address user, bytes32 positionId) → bool`
Check if a position is currently active.

---

### Data Structures

```solidity
struct Position {
    address user;                // Position owner
    address poolId;              // DEX pool address
    address baseAsset;           // Base token used
    uint32 chainId;              // Target chain ID
    int24 lowerRangePercent;     // Lower range (-500 = -5%)
    int24 upperRangePercent;     // Upper range (1000 = +10%)
    uint64 timestamp;            // Creation timestamp
    bool active;                 // Position status
    uint256[] amounts;           // Token amounts
}
```

---

## ⚡ XCMProxy

> **Location**: Moonbeam  
> **Purpose**: DEX execution and position management  
> **Source**: [`XCMProxy.sol`](../SmartContracts/contracts/V1(Current)/XCMProxy.sol)

### Core Functions

#### `executeInvestment(...)`
*Owner-only function to create LP positions.*

```solidity
function executeInvestment(
    address baseAsset,
    uint256[] memory amounts,
    address poolId,
    int24 lowerRangePercent,
    int24 upperRangePercent,
    address positionOwner
) external onlyOwner
```

**Flow:**
1. Calculate tick range from percentage parameters
2. Execute optimal token swaps if needed
3. Mint LP position via Algebra NFPM
4. Store position data for monitoring

#### `calculateTickRange(address pool, int24 lowerRangePercent, int24 upperRangePercent)`
Convert user-friendly percentage ranges to precise tick boundaries.

**Parameters:**
- `pool` - Algebra pool address
- `lowerRangePercent` - Lower bound (-500 = -5%)
- `upperRangePercent` - Upper bound (1000 = +10%)

**Returns:** `(int24 bottomTick, int24 topTick)`

**Example:**
```solidity
// Set range from -5% to +10% around current price
(int24 bottom, int24 top) = proxy.calculateTickRange(
    poolAddress, 
    -500,  // -5%
    1000   // +10%
);
```

#### `executeFullLiquidation(uint256 positionId)`
*Operator-only function to fully liquidate a position.*

**Returns:** `(uint256 amount0, uint256 amount1)` - Amounts of each token received

#### `liquidateSwapAndReturn(...)`
Complete liquidation flow: burn position, swap to base asset, send via XCM.

```solidity
function liquidateSwapAndReturn(
    uint256 positionId,
    address baseAsset,
    bytes calldata destination,
    uint256 minAmountOut0,
    uint256 minAmountOut1,
    uint160 limitSqrtPrice
) external onlyOperator
```

---

### Position Management

#### `isPositionOutOfRange(uint256 positionId)`
Check if position has moved outside its configured range.

**Returns:**
- `bool outOfRange` - True if position is outside range
- `uint256 currentPrice` - Current tick as price indicator

#### `getActivePositions() → Position[]`
Get all currently active positions across all users.

#### `getUserPositions(address user) → uint256[]`
Get position IDs owned by a specific user.

---

### DEX Integration

#### `swapExactInputSingle(...)`
Execute token swaps via Algebra router.

```solidity
function swapExactInputSingle(
    address tokenIn,
    address tokenOut,
    address recipient,
    uint256 amountIn,
    uint256 amountOutMinimum,
    uint160 limitSqrtPrice
) external onlyOwner returns (uint256 amountOut)
```

#### `quoteExactInputSingle(...)`
Get swap quotes without executing trades.

**Returns:** `uint256 amountOut` - Expected output amount

---

### XCM Operations

#### `returnAssets(...)`
Send tokens back to Asset Hub via XCM.

```solidity
function returnAssets(
    address token,
    address user,
    uint256 amount,
    bytes calldata destination
) external onlyOwner
```

---

## 🔧 Integration Examples

### Creating a Basic Position

```javascript
// 1. User deposits to Asset Hub
await assetHubVault.deposit(usdcAddress, ethers.parseUnits("1000", 6));

// 2. Operator triggers investment (backend)
await assetHubVault.dispatchInvestment(
    userAddress,
    2004, // Moonbeam chain ID
    poolAddress,
    usdcAddress,
    [ethers.parseUnits("500", 6), ethers.parseUnits("500", 18)], // USDC + DOT
    -500, // -5% lower range
    1000, // +10% upper range
    xcmDestination,
    xcmMessage
);

// 3. XCM message triggers execution on Moonbeam
// (handled automatically by XCM infrastructure)
```

### Monitoring Position Health

```javascript
// Check if position needs liquidation
const positionId = 1;
const [outOfRange, currentPrice] = await xcmProxy.isPositionOutOfRange(positionId);

if (outOfRange) {
    // Trigger liquidation
    await xcmProxy.executeFullLiquidation(positionId);
}
```

---

## 🛡️ Security Considerations

### Access Controls

| Function | Access Level | Purpose |
|----------|--------------|---------|
| `deposit/withdraw` | Public | User asset management |
| `dispatchInvestment` | Operator | Automated investment decisions |
| `handleIncomingXCM` | XCM/Admin | Cross-chain message handling |
| `executeInvestment` | Owner | Position creation |
| `executeFullLiquidation` | Operator | Stop-loss execution |

### Emergency Features

- **Pause functionality** on both contracts
- **Emergency liquidation** override (admin-only)
- **XCM configuration freeze** to prevent changes after deployment

### Input Validation

- Range parameters capped at ±1000% (±10x)
- Zero address and zero amount checks
- Sufficient balance verification before operations
- Position ownership verification for liquidations

---

## 🔍 Events Reference

### AssetHubVault Events

```solidity
event Deposit(address indexed user, address indexed token, uint256 amount);
event Withdrawal(address indexed user, address indexed token, uint256 amount);
event InvestmentInitiated(bytes32 indexed positionId, address indexed user, uint32 chainId, address poolId, uint256[] amounts);
event PositionLiquidated(bytes32 indexed positionId, address indexed user, uint256[] finalAmounts);
event XCMMessageSent(bytes32 indexed messageHash, bytes destination, bytes message);
```

### XCMProxy Events

```solidity
event PositionCreated(uint256 indexed positionId, address indexed user, address pool, address token0, address token1, int24 bottomTick, int24 topTick, uint128 liquidity);
event PositionLiquidated(uint256 indexed positionId, address indexed user, uint256 amount0, uint256 amount1);
event AssetsReturned(address indexed token, address indexed user, bytes destination, uint256 amount, uint256 positionId);
event ProceedsSwapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 positionId);
```

---

## 📊 Gas Optimization

### Efficient Patterns Used

1. **Tight Variable Packing** - Structs optimized for storage slots
2. **Batch Operations** - Multiple token swaps in single transaction
3. **Allowance Management** - Reset to 0 before setting new allowances
4. **Event-Driven Architecture** - Minimal on-chain computation

### Estimated Gas Costs

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Deposit | ~45k | Standard ERC20 transfer |
| Withdraw | ~35k | Storage deletion refund |
| Create Position | ~180k | Including swaps and LP mint |
| Liquidate Position | ~120k | Burn + collect + swaps |
| XCM Transfer | ~80k | Cross-chain message |

---

## 🧪 Testing

All contracts include comprehensive test suites:

```bash
# Run all contract tests
cd SmartContracts
npx hardhat test

# Run specific contract tests
npx hardhat test test/AssetHubVault.test.ts
npx hardhat test test/XCMProxy.test.ts

# Generate coverage report
npx hardhat coverage
```

---

*For more technical details, see the inline documentation in the contract source files.*

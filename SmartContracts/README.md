# LiquiDOT Smart Contracts

Cross-chain liquidity management infrastructure for Polkadot parachains, enabling automated trading on Moonbeam DEXs with custody on Asset Hub.

## 📁 Directory Structure

```
SmartContracts/
├── contracts/              # Smart contract source code
│   ├── V1(Current)/        # Production contracts
│   │   ├── AssetHubVault.sol    # Asset Hub custody layer
│   │   ├── XCMProxy.sol         # Moonbeam execution layer
│   │   └── xcm/                 # XCM interface abstractions
│   │       ├── AssetHubXcmSender.sol  # XCM adapter for Asset Hub
│   │       └── IXcmSender.sol         # XCM interface definitions
│   └── test/               # Test contracts
├── test/                   # Comprehensive test suite
│   ├── AssetHubVault/      # Asset Hub tests
│   │   └── testnet/        # Live testnet tests (Paseo)
│   ├── XCMProxy/           # Moonbase tests
│   │   └── testnet/        # Live testnet tests (Moonbase Alpha)
│   ├── Integration/        # Cross-chain tests
│   └── helpers/            # Setup utilities
├── scripts/                # Deployment & setup scripts
├── deployments/            # Deployment state & addresses
└── foundry.toml            # Foundry configuration
```

## 🏗️ Architecture

**AssetHubVault** (Asset Hub / Paseo)
- Primary custody layer for user funds
- Dispatches investment decisions via XCM
- Handles deposits, withdrawals, and emergency functions
- Uses IXcm precompile at `0x00000000000000000000000000000000000a0000`
- Custom error handling for gas-efficient reverts
- Test mode for development (skips XCM calls)

**XCMProxy** (Moonbeam / Moonbase Alpha)
- Cross-chain execution engine
- Integrates with Algebra DEX for trading
- Manages liquidity positions via NFPM
- Returns profits via XCM (IXTokens precompile)
- Custom error handling for gas-efficient reverts
- Operator-triggered liquidation model

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Get testnet tokens
# - Moonbase DEV: https://faucet.moonbeam.network/
# - Paseo PAS: https://faucet.paseo.network/
```

### Current Testnet Deployments

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha | `0xe07d18eC747707f29cd3272d48CF84A383647dA1` |

### Deployment

See **[scripts/README.md](./scripts/README.md)** for complete deployment guide:

1. Deploy AssetHubVault to Asset Hub (via Remix Polkadot IDE)
2. Deploy Moonbase infrastructure (Algebra + XCMProxy)
3. Configure contracts and enable test mode

### Testing

See **[test/README.md](./test/README.md)** for complete testing guide:

```bash
# Asset Hub tests (Paseo)
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/3.investment.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/4.liquidation.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/5.emergency.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/6.security-checks.test.js --network passethub

# Moonbase tests
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase
npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase
```

## 📦 Deployments

Current testnet deployments are tracked in `deployments/`:

- `deployment-state.json` - Complete XCMProxy deployment state
- `moonbase_bootstrap.json` - Bootstrap configuration with all addresses
- `xcmproxy-moonbase-*.json` - Timestamped deployment records

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Private keys (with 0x prefix)
MOON_PK=0xyour_moonbase_private_key
ASSET_PK=0xyour_asset_hub_private_key

# Contract addresses (set after deployment)
ASSETHUB_CONTRACT=0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6
XCMPROXY_CONTRACT=0xe07d18eC747707f29cd3272d48CF84A383647dA1
```

## 📚 Documentation

- **[Test Suite](./test/README.md)** - Complete testing guide
- **[Deployment Scripts](./scripts/README.md)** - Setup & deployment

## 🔗 Networks

| Network | Chain ID | Description |
|---------|----------|-------------|
| Moonbase Alpha | 1287 | Moonbeam testnet |
| Paseo Asset Hub | 420420422 | Asset Hub testnet (ParaId: 1000) |

## ⚠️ Important Design Notes

### XCM Precompile Interfaces

**Asset Hub (IXcm)**
```solidity
// Address: 0x00000000000000000000000000000000000a0000
interface IXcm {
    struct Weight { uint64 refTime; uint64 proofSize; }
    function execute(bytes calldata message, Weight calldata maxWeight) external;
    function send(bytes calldata dest, bytes calldata message) external;
    function weighMessage(bytes calldata message) external view returns (Weight memory);
}
```

**Moonbeam (IXTokens)**
```solidity
// Address: 0x0000000000000000000000000000000000000804
interface IXTokens {
    function transfer(address currencyAddress, uint256 amount, Multilocation memory destination, uint64 weight) external;
    function transferMultiasset(Multilocation memory asset, uint256 amount, Multilocation memory destination, uint64 weight) external;
}
```

### Custom Errors

Both contracts use custom errors for gas-efficient reverts:

**AssetHubVault Errors:**
```solidity
NotAdmin(), NotOperator(), NotEmergency(), Paused()
ZeroAddress(), AmountZero(), InsufficientBalance(), InvalidRange()
XcmPrecompileNotSet(), ChainNotSupported(), ChainIdMismatch(), ExecutorNotAuthorized()
```

**XCMProxy Errors:**
```solidity
NotOwner(), NotOperator(), TokenNotSupported(), InsufficientBalance()
PositionNotFound(), PositionNotActive(), InvalidSlippage()
XcmConfigFrozen(), DEXNotConfigured(), NFPMNotSet()
```

### Liquidation Triggers (Operator-Triggered)

LiquiDOT uses an **operator-triggered liquidation model**, not automated on-chain triggers.

**Available functions:**
- `isPositionOutOfRange(positionId)` - **View function** to check if a position needs liquidation
- `executeFullLiquidation(positionId)` - Liquidate unconditionally (operator only)
- `liquidateIfOutOfRange(positionId)` - **Atomic check + liquidate** in one call (operator only)

The `liquidateIfOutOfRange()` function is the recommended approach:
```solidity
// Returns (liquidated, amount0, amount1)
// - If in range: returns (false, 0, 0) - no action taken
// - If out of range: liquidates and returns (true, amount0, amount1)
(bool liquidated, uint256 a0, uint256 a1) = xcmProxy.liquidateIfOutOfRange(positionId);
```

### Test Mode

Both contracts support a `testMode` flag that:
- **AssetHubVault**: Skips actual XCM send calls, allows operator to confirm/settle locally
- **XCMProxy**: Skips XCM return transfers, allows local testing of DEX operations

Enable for development:
```solidity
vault.setTestMode(true);   // AssetHubVault
proxy.setTestMode(true);   // XCMProxy
```

### Single-Sided vs Dual-Sided Liquidity

When minting LP positions, the `amounts` array must be populated based on the current pool price relative to the desired tick range. This is standard Uniswap V3/Algebra concentrated liquidity math:

| Pool Price vs Range | Token0 Required | Token1 Required |
|---------------------|-----------------|-----------------|
| Price **below** range (currentTick < bottomTick) | ✅ Yes | ❌ No |
| Price **above** range (currentTick > topTick) | ❌ No | ✅ Yes |
| Price **within** range | ✅ Yes | ✅ Yes |

**Operator Responsibility:** Ensure the correct tokens are available before executing positions. The backend calculates optimal swap amounts based on current pool state.

### Settlement Accounting Model

The `settleLiquidation` function uses **event-bound accounting**:

1. Moonbeam's `liquidateSwapAndReturn()` computes `totalBase` **on-chain** (from actual LP removal + swap)
2. Moonbeam emits `LiquidationCompleted(..., totalBase)` event
3. Backend reads event, cannot inflate the amount
4. Backend calls `settleLiquidation(positionId, totalBase)` via XCM Transact (production) or directly (test mode)

The position can only be settled once (status check), and access control ensures only operator (test) or XCM origin (production) can call.

## 🛠️ Development Tools

- **Hardhat** - Primary development framework
- **Foundry** - Testing and verification
- **OpenZeppelin** - Security libraries (Pausable, ReentrancyGuard)
- **Algebra Integral** - DEX integration

### DEX Target: StellaSwap Pulsar (Algebra Integral)

The XCMProxy contract uses `@cryptoalgebra/integral-*` interfaces which include the `deployer` field in mint/swap parameters.

**✅ StellaSwap Compatibility:** StellaSwap on Moonbeam mainnet uses Algebra Integral v1.2 ([stellaswap/Integral-contracts](https://github.com/stellaswap/Integral-contracts), forked from cryptoalgebra/Algebra). The interfaces are **fully compatible** - StellaSwap includes the `deployer` field.

**Deployment Strategy:**
- **Testnet (Moonbase Alpha):** Our own Algebra Integral deployment (addresses in `deployments/moonbase_bootstrap.json`)
- **Mainnet (Moonbeam):** StellaSwap Pulsar contracts - no interface changes needed

**Deployed Algebra Addresses (Moonbase Alpha):**
- Factory, Router, Quoter, NFPM addresses in `deployments/moonbase_bootstrap.json`
- These are our testnet deployment for development/testing

## ⚖️ License

Apache-2.0

## 🆘 Support

For issues or questions:
1. Check the documentation in `test/README.md` and `scripts/README.md`
2. Review deployment state in `deployments/`
3. See the main project [README](../README.md)

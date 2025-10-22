# LiquiDOT Test Suite

Complete test suite for the LiquiDOT protocol with **testnet-first design** - all tests work with existing deployed contracts.

## 📁 Test Structure

```
test/
├── AssetHubVault/testnet/          ✅ Asset Hub Tests (5 tests)
│   ├── 1.config-check.test.js      # Verify deployment
│   ├── 2.deposits.test.js          # Deposit/withdrawal
│   ├── 3.investment.test.js        # Investment dispatch
│   ├── 4.liquidation.test.js       # Liquidation settlement
│   └── 5.emergency.test.js         # Emergency functions
│
├── Integration/testnet/            ✅ Cross-Chain Tests (1 test)
│   └── 1.guided-investment-flow.test.js  # End-to-end flow
│
├── XCMProxy/testnet/               ✅ Moonbase Tests (5 tests)
│   ├── 1.config-check.test.js      # Verify deployment
│   ├── 2.receive-assets.test.js    # XCM reception
│   ├── 3.execute-position.test.js  # Position trading
│   ├── 4.liquidation.test.js       # Liquidation flow
│   └── 5.emergency.test.js         # Emergency functions
│
├── helpers/                        # Test & Setup Utilities
│   ├── deploy-algebra-suite.js     # Algebra deployment (local testing)
│   ├── deploy-xcm-proxy.js         # XCMProxy deployment (local)
│   ├── deploy-test-contracts.js    # Test contracts (local)
│   ├── test-environment.js         # Environment setup (local)
│   ├── link-contracts.js           # ⭐ Link AssetHub ↔ Moonbase
│   ├── enable-test-mode.js         # ⭐ Enable safe test mode
│   ├── verify-xcmproxy-config.js   # ⭐ Verify deployment
│
├── .test-commands.md               # Quick command reference
└── README.md                       # This file
```
└── README.md                       # This file
```

## 🚀 Quick Start

### Step 1: Setup Contracts

See `scripts/README.md` for deployment details. Then configure:

```powershell
# Set contract addresses
$env:ASSETHUB_CONTRACT="0xYourDeployedAddress"
$env:XCMPROXY_CONTRACT="0xYourProxyAddress"

# Run setup scripts (in helpers/)
npx hardhat run test/helpers/link-contracts.js --network passethub
npx hardhat run test/helpers/link-contracts.js --network moonbase
npx hardhat run test/helpers/enable-test-mode.js --network passethub
npx hardhat run test/helpers/verify-xcmproxy-config.js --network moonbase
```

### Step 2: Run Tests

```powershell
# Asset Hub Tests
npx hardhat test test/AssetHubVault/testnet/**/*.test.js --network passethub

# Moonbase Tests
npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase

# Integration Tests
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub
```

👉 **For all commands, see [.test-commands.md](./.test-commands.md)**

## 📊 Test Files

| File | Purpose | Status |
|------|---------|--------|
| **AssetHubVault/testnet/** |
| 1.config-check.test.js | Deployment verification | ✅ |
| 2.deposits.test.js | Deposit/withdrawal tests | ✅ |
| 3.investment.test.js | Investment dispatch (test mode) | ✅ |
| 4.liquidation.test.js | Liquidation settlement | ✅ |
| 5.emergency.test.js | Emergency pause/unpause | ✅ |
| **Integration/testnet/** |
| 1.guided-investment-flow.test.js | End-to-end flow guidance | ✅ |
| **XCMProxy/testnet/** |
| 1.config-check.test.js | XCMProxy verification | ✅ |
| 2.receive-assets.test.js | XCM asset reception | ✅ |
| 3.execute-position.test.js | Position trading | ✅ |
| 4.liquidation.test.js | Liquidation execution | ✅ |
| 5.emergency.test.js | Emergency pause/unpause | ✅ |

## 🔧 Environment & Configuration

### Environment Variables

```powershell
$env:ASSETHUB_CONTRACT      # AssetHubVault address (required)
$env:XCMPROXY_CONTRACT      # XCMProxy address (for integration)
$env:PRIVATE_KEY            # Private key for transactions
$env:ASSETHUB_RPC           # Asset Hub RPC (optional)
$env:MOONBASE_RPC           # Moonbase RPC (optional)
```

### Networks

- **passethub** - Paseo Asset Hub testnet (1000)
- **moonbase** - Moonbase Alpha testnet (1287)

Configure in `hardhat.config.js`:
```javascript
networks: {
  passethub: {
    url: process.env.ASSETHUB_RPC || "https://rococo-asset-hub-rpc.polkadot.io",
    accounts: [process.env.PRIVATE_KEY],
    chainId: 1000
  },
  moonbase: {
    url: "https://rpc.api.moonbase.moonbeam.network",
    accounts: [process.env.PRIVATE_KEY],
    chainId: 1287
  }
}
```

## ⭐ Setup Scripts in `helpers/`

Located in `test/helpers/`, these are used for testnet configuration:

| Script | Purpose | Run | Command |
|--------|---------|-----|---------|
| link-contracts.js | Connect contracts | 2x | `npx hardhat run test/helpers/link-contracts.js --network [passethub\|moonbase]` |
| enable-test-mode.js | Safe test mode | 1x | `npx hardhat run test/helpers/enable-test-mode.js --network passethub` |
| verify-xcmproxy-config.js | Verify deployment | Optional | `npx hardhat run test/helpers/verify-xcmproxy-config.js --network moonbase` |

Other helpers are for local/mock testing:
- `deploy-algebra-suite.js` - Algebra deployment utilities
- `deploy-xcm-proxy.js` - XCMProxy deployment utilities
- `deploy-test-contracts.js` - Test contract helpers
- `test-environment.js` - Test environment setup

## � Test Design

### Testnet-First Approach
- Tests work with **existing deployed contracts** (no fresh deployments)
- **State-aware**: don't assume clean conditions
- **Idempotent**: safe to run multiple times
- **Auto-skip**: when prerequisites missing
- **Small amounts**: minimize costs

### Test Independence
- Each file is independent
- Can run in any order
- No shared state
- Clear prerequisites

## � Common Workflows

### Just Deployed AssetHubVault?

```powershell
$env:ASSETHUB_CONTRACT="0xNewAddress"
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
```

### Test Investment Flow?

```powershell
npx hardhat test test/AssetHubVault/testnet/3.investment.test.js --network passethub
npx hardhat test test/Integration/testnet/1.guided-investment-flow.test.js --network passethub
```

### XCMProxy Deployed on Moonbase?

```powershell
$env:XCMPROXY_CONTRACT="0xYourProxyAddress"
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
```

## ⚠️ Important Notes

### Gas Costs
- Config checks are read-only (no cost)
- Deposit tests use small amounts (~0.1 ETH)
- Actual costs depend on gas prices

### State Management
- Testnet state persists between test runs
- Deposits accumulate over multiple runs
- Consider periodic cleanup if needed

### Prerequisites
Tests auto-skip if missing requirements:
- **AssetHub tests** need: deployed contract + testnet tokens
- **Integration tests** need: both contracts + tokens + test mode enabled
- **XCMProxy tests** need: deployed contract + testnet tokens

## 📊 Current Status

✅ **15 tests implemented and ready to run**
- 5 AssetHubVault tests
- 1 Integration test
- 5 XCMProxy tests

✅ **100% testnet-ready** - all tests work with deployed contracts

## � Additional Resources

- **Quick commands**: [.test-commands.md](./.test-commands.md)
- **Deployment**: [../scripts/README.md](../scripts/README.md)
- **Main setup**: [../../README.md](../../README.md)


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
│   ├── debug-execute.js            # Manual receive/execute debug harness
│   ├── deploy-algebra-suite.js     # Algebra deployment utilities
│   ├── deploy-test-contracts.js    # Test token & pool helpers
│   ├── deploy-xcm-proxy.js         # XCMProxy deployment utilities
│   ├── enable-test-mode.js         # ⭐ Enable safe test mode
│   ├── link-contracts.js           # ⭐ Link AssetHub ↔ Moonbase
│   ├── provide-liquidity.js        # Seed pools with liquidity
│   ├── verify-xcmproxy-config.js   # ⭐ Verify deployment
│
├── .test-commands.md               # Quick command reference
└── README.md                       # This file
```
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
npx hardhat run test/helpers/provide-liquidity.js --network moonbase   # Optional but recommended for NFPM tests
npx hardhat run test/helpers/verify-xcmproxy-config.js --network moonbase
```

### Helper Workflow (Recommended Order)

0. _Bootstrap liquidity inputs (one-time)._ Make sure `deployments/moonbase_bootstrap.json` or your `MOONBASE_*` env vars already include token and pool addresses. If they do not, run `npx hardhat run scripts/deploy-moonbase.js --network moonbase` before the steps below.
1. `link-contracts.js --network passethub`
   - Adds Moonbase Alpha to AssetHubVault's chain registry.
2. `link-contracts.js --network moonbase`
   - Sets AssetHubVault as the trusted XCM caller on XCMProxy.
3. `enable-test-mode.js --network passethub`
   - Turns on test mode so AssetHubVault uses mocked XCM flows.
4. `provide-liquidity.js --network moonbase`
   - Uses the existing token + pool addresses to seed Algebra liquidity (does **not** deploy new pools or tokens).
5. `verify-xcmproxy-config.js --network moonbase`
   - Read-only sanity check once everything is wired together.

Use `debug-execute.js` only when you need a manual receive/execute reproduction, and lean on `deploy-*` helpers exclusively for local Hardhat development environments.
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

### Step 3: Capture Test Logs

Wrap any Hardhat command with `test/save-test-log.sh` to persist console output automatically:

```bash
./test/save-test-log.sh moonbase-all npx hardhat test test/XCMProxy/testnet/**/*.test.js --network moonbase
```

Logs are written to `test/logs/<timestamp>-<tag>.log` and the wrapper preserves the original exit code. The `test/logs/` folder (see attachment `#file:logs`) reflects the latest captured outputs.



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

Other helpers are available for local or manual workflows:
- `debug-execute.js` - Single-run harness for receiveAssets/executePendingInvestment
- `deploy-algebra-suite.js` - Algebra deployment utilities
- `deploy-test-contracts.js` - Test token and pool helpers
- `deploy-xcm-proxy.js` - XCMProxy deployment utilities
- `provide-liquidity.js` - Seeds Algebra pools with deterministic liquidity

## Test Design

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

## Common Workflows

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

## Additional Resources

- **Quick commands**: [.test-commands.md](./.test-commands.md)
- **Deployment**: [../scripts/README.md](../scripts/README.md)
- **Main setup**: [../../README.md](../../README.md)


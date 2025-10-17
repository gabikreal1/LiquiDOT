# Cross-Chain Testing Guide
## Running AssetHub + XCMProxy Tests Together

This guide shows how to run both testnet test suites to validate the complete cross-chain flow.

## Quick Start

### 1. Environment Setup

Create `.env` with both network credentials:
```bash
# Asset Hub (Passet Hub testnet)
ASSET_PRIVATE_KEY=your_asset_hub_private_key

# Moonbase Alpha
MOON_PRIVATE_KEY=your_moonbase_private_key

# Deployed contracts
ASSETHUB_CONTRACT=0xYourAssetHubVaultAddress
XCMPROXY_CONTRACT=0xYourXCMProxyAddress
```

### 2. Run All Tests

```bash
# Run both test suites
npm run test:testnet:all

# Or manually:
npx hardhat test test/AssetHubVault/testnet/*.test.js --network passethub
npx hardhat test test/XCMProxy/testnet/*.test.js --network moonbase
```

## Test Flow Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                   Cross-Chain Test Flow                          │
└─────────────────────────────────────────────────────────────────┘

Asset Hub (Passet Hub)              Moonbase Alpha
━━━━━━━━━━━━━━━━━━━━━━━━━━━━       ━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Config Check                     1. Config Check
   ├─ Verify vault setup               ├─ Verify proxy setup
   ├─ Check XCM config                 ├─ Check NFPM integration
   └─ Validate roles                   └─ Check XCM config

2. Deposits                         2. Receive Assets
   ├─ Deposit native assets            ├─ Simulate XCM reception
   ├─ Check balances                   ├─ Create pending positions
   └─ Multi-user tests                 └─ Validate parameters

3. Investment Dispatch              3. Execute Position
   ├─ Create position                  ├─ Execute pending
   ├─ Send XCM message ─────────►      ├─ Mint NFPM position
   └─ Confirm execution ◄──────────    └─ Confirm to Asset Hub

4. Liquidation Settlement           4. Liquidation
   ├─ Receive proceeds ◄──────────     ├─ Liquidate position
   ├─ Settle position                  ├─ Swap to base asset
   └─ Credit user                      └─ Return via XCM ─────►

5. Emergency Functions              5. Emergency Functions
   ├─ Pause/unpause                    ├─ Pause/unpause
   ├─ Emergency liquidate              ├─ Cancel pending
   └─ Admin controls                   └─ Admin controls

━━━━━━━━━━━━━━━━━━━━━━━━━━━━       ━━━━━━━━━━━━━━━━━━━━━━━━━━
   420420422 Chain ID                   1287 Chain ID
```

## Test Matrix

| Test Suite | Network | Chain ID | Test Mode | XCM Calls |
|------------|---------|----------|-----------|-----------|
| AssetHub   | passethub | 420420422 | ✅ Enabled | ⏭️ Skipped |
| XCMProxy   | moonbase | 1287 | ✅ Enabled | ⏭️ Skipped |

## Running Tests by Category

### Configuration Only (100% Safe)
```bash
# AssetHub config check
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub

# XCMProxy config check
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
```

### Core Functionality
```bash
# AssetHub: deposits → investment dispatch
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
npx hardhat test test/AssetHubVault/testnet/3.investment.test.js --network passethub

# XCMProxy: receive → execute
npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase
npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase
```

### Liquidation Flow
```bash
# AssetHub: settlement
npx hardhat test test/AssetHubVault/testnet/4.liquidation.test.js --network passethub

# XCMProxy: liquidation
npx hardhat test test/XCMProxy/testnet/4.liquidation.test.js --network moonbase
```

### Emergency & Admin
```bash
# AssetHub: emergency controls
npx hardhat test test/AssetHubVault/testnet/5.emergency.test.js --network passethub

# XCMProxy: emergency controls
npx hardhat test test/XCMProxy/testnet/5.emergency.test.js --network moonbase
```

## Parallel Testing

Run both networks simultaneously in separate terminals:

**Terminal 1 (Asset Hub):**
```bash
npx hardhat test test/AssetHubVault/testnet/*.test.js --network passethub
```

**Terminal 2 (Moonbase):**
```bash
npx hardhat test test/XCMProxy/testnet/*.test.js --network moonbase
```

## Test Dependencies

Some tests create state needed by later tests:

### AssetHub Dependencies
1. Config check → (no dependencies)
2. Deposits → (no dependencies)
3. Investment → Requires deposits
4. Liquidation → Requires active positions
5. Emergency → May affect other tests (pause)

### XCMProxy Dependencies
1. Config check → (no dependencies)
2. Receive assets → Requires supported tokens
3. Execute position → Requires pending positions (from test 2)
4. Liquidation → Requires active positions (from test 3)
5. Emergency → May affect other tests (pause)

## Expected Output

### Successful Test Run
```
✅ AssetHub: 35+ tests passing
✅ XCMProxy: 60+ tests passing
✅ Total: 95+ tests passing
✅ Cross-chain flow validated
```

### Partial Success (Normal)
```
✅ Config tests passing
⚠️  Some tests skipped (missing config)
⚠️  Integration tests pending (NFPM not set)
✓  Basic functionality validated
```

## Common Issues

### "Test mode must be enabled"
**Solution:**
```javascript
// AssetHub
await vault.setTestMode(true);

// XCMProxy
await proxy.setTestMode(true);
```

### "NFPM not set"
**Solution:**
```javascript
await proxy.setNFPM(nfpmAddress);
await proxy.setIntegrations(quoterAddress, swapRouterAddress);
```

### "Contract not found"
**Solution:**
Check `.env` has correct contract addresses:
```bash
echo $ASSETHUB_CONTRACT
echo $XCMPROXY_CONTRACT
```

### "Insufficient balance"
**Solution:**
Get testnet tokens:
- Asset Hub: [Passet Hub Faucet]
- Moonbase: https://faucet.moonbeam.network/

## Production Testing (Advanced)

To test actual XCM transfers (disable test mode):

### ⚠️ WARNING: This executes real XCM messages!

```javascript
// 1. Ensure proper XCM configuration
await vault.setXcmPrecompile(XCM_PRECOMPILE);
await proxy.setXTokensPrecompile(XTOKENS_PRECOMPILE);
await proxy.setAssetHubParaId(ASSET_HUB_PARA_ID);

// 2. Disable test mode
await vault.setTestMode(false);
await proxy.setTestMode(false);

// 3. Run with caution
npx hardhat test test/AssetHubVault/testnet/3.investment.test.js --network passethub
npx hardhat test test/XCMProxy/testnet/4.liquidation.test.js --network moonbase
```

## Health Monitoring

Run health checks anytime:

```bash
# Quick health check (both contracts)
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
```

Both tests include comprehensive health summaries showing:
- Configuration status
- Integration readiness
- XCM configuration
- Operating parameters
- Position statistics

## NPM Scripts (Optional)

Add to `package.json`:
```json
{
  "scripts": {
    "test:testnet:all": "npm run test:testnet:asset && npm run test:testnet:moon",
    "test:testnet:asset": "hardhat test test/AssetHubVault/testnet/*.test.js --network passethub",
    "test:testnet:moon": "hardhat test test/XCMProxy/testnet/*.test.js --network moonbase",
    "test:testnet:config": "hardhat test test/**/testnet/1.config-check.test.js",
    "test:testnet:health": "npm run test:testnet:config"
  }
}
```

Then run:
```bash
npm run test:testnet:all      # Run all testnet tests
npm run test:testnet:asset    # AssetHub tests only
npm run test:testnet:moon     # XCMProxy tests only
npm run test:testnet:health   # Health checks only
```

## Documentation

- **AssetHub Tests**: `test/AssetHubVault/testnet/README.md`
- **XCMProxy Tests**: `test/XCMProxy/testnet/README.md`
- **Implementation**: `test/XCMProxy/testnet/IMPLEMENTATION_SUMMARY.md`

## Support

For issues:
1. Run health checks first
2. Verify environment variables
3. Check account balances
4. Review error messages
5. Consult test documentation

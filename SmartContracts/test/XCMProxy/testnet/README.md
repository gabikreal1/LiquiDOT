# XCMProxy Testnet Tests

Comprehensive test suite for deployed XCMProxy contracts on Moonbase Alpha testnet.

## Overview

These tests are designed to safely validate XCMProxy functionality on live testnet deployments without risking funds or breaking production state.

## Test Files

### 1. Configuration Check (`1.config-check.test.js`)
**100% Safe - Read-only operations**

Validates deployed contract configuration:
- Contract deployment and connectivity
- Role configuration (owner, operator)
- DEX integration setup (NFPM, Quoter, SwapRouter)
- XCM configuration (XTokens precompile, Asset Hub para ID)
- Operating parameters (pause status, test mode, slippage)
- Comprehensive health check summary

**Usage:**
```bash
$env:XCMPROXY_CONTRACT="0xYourContractAddress"
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase
```

### 2. Receive Assets (`2.receive-assets.test.js`)
**Safe with test mode enabled**

Tests asset reception from Asset Hub:
- Creating pending positions via `receiveAssets`
- Validating investment parameters
- Testing authorization controls
- Error handling (unsupported tokens, zero amounts, duplicates)

**Requirements:**
- Test mode must be enabled (`testMode = true`)
- Test tokens must be added to `supportedTokens` mapping

**Usage:**
```bash
npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase
```

### 3. Execute Position (`3.execute-position.test.js`)
**Safe with test mode - requires NFPM configuration**

Tests position execution and NFPM minting:
- Executing pending positions
- Minting NFPM liquidity positions
- Position counter management
- Custom slippage and tick range handling

**Requirements:**
- Test mode enabled
- NFPM, Quoter, and SwapRouter contracts configured
- Account must be operator
- Pending positions created (run test 2 first)

**Usage:**
```bash
npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase
```

### 4. Liquidation (`4.liquidation.test.js`)
**Safe with test mode - XCM calls skipped**

Tests position liquidation and asset return:
- Full position liquidation
- Liquidate + swap + return flow
- Cancelling pending positions
- Position range checking
- Manual asset returns

**Requirements:**
- Test mode enabled
- Account must be operator
- Active positions exist (run test 3 first)

**Usage:**
```bash
npx hardhat test test/XCMProxy/testnet/4.liquidation.test.js --network moonbase
```

### 5. Emergency & Admin (`5.emergency.test.js`)
**CAUTION: May pause contract temporarily**

Tests emergency and admin functions:
- Pause/unpause controls
- Test mode toggling
- Operator management
- Integration configuration
- Slippage settings
- Token support management
- XCM configuration management
- Fee collection
- Health check summary

**Requirements:**
- Account must be owner for most tests
- Some tests may temporarily pause the contract

**Usage:**
```bash
npx hardhat test test/XCMProxy/testnet/5.emergency.test.js --network moonbase
```

## Setup

### 1. Environment Configuration

Create a `.env` file with:
```bash
MOON_PRIVATE_KEY=your_moonbase_private_key_here
XCMPROXY_CONTRACT=your_deployed_contract_address
```

### 2. Fund Your Account

Get Moonbase Alpha DEV tokens:
- Faucet: https://faucet.moonbeam.network/
- Minimum: 1 DEV for testing

### 3. Deploy Contract

Deploy XCMProxy to Moonbase Alpha:
```bash
npx hardhat run scripts/deploy-xcmproxy.js --network moonbase
```

Save the deployed contract address to `XCMPROXY_CONTRACT` in `.env`

### 4. Configure Contract

**Minimum configuration:**
```javascript
// Enable test mode for safe testing
await proxy.setTestMode(true);

// Set operator (for executing positions)
await proxy.setOperator(operatorAddress);

// Add supported test token
await proxy.addSupportedToken(WETH_MOONBASE);

// Optional: Configure DEX integrations for full testing
await proxy.setNFPM(nfpmAddress);
await proxy.setIntegrations(quoterAddress, swapRouterAddress);
```

**For production testing (disable test mode):**
```javascript
// Set XCM configuration
await proxy.setXTokensPrecompile("0x0000000000000000000000000000000000000804");
await proxy.setAssetHubParaId(1000); // Asset Hub para ID on Polkadot

// Disable test mode
await proxy.setTestMode(false);
```

## Running Tests

### Run all tests sequentially
```bash
npx hardhat test test/XCMProxy/testnet/*.test.js --network moonbase
```

### Run individual test suites
```bash
# Configuration check (always safe)
npx hardhat test test/XCMProxy/testnet/1.config-check.test.js --network moonbase

# Receive assets
npx hardhat test test/XCMProxy/testnet/2.receive-assets.test.js --network moonbase

# Execute positions
npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase

# Liquidation
npx hardhat test test/XCMProxy/testnet/4.liquidation.test.js --network moonbase

# Emergency & admin
npx hardhat test test/XCMProxy/testnet/5.emergency.test.js --network moonbase
```

## Test Mode vs Production Mode

### Test Mode (Recommended for Testing)
- XCM calls are **skipped**
- Direct contract calls allowed
- No actual cross-chain transfers
- Safe for development and testing

**Enable:**
```javascript
await proxy.setTestMode(true);
```

### Production Mode
- XCM calls are **executed**
- Requires proper XCM configuration
- Actual cross-chain transfers occur
- Use with caution on testnet

**Enable:**
```javascript
await proxy.setTestMode(false);
```

## Safety Features

### Read-Only Tests
- Test 1 (config check) is 100% safe
- No state modifications
- Can run anytime without risk

### Pause Protection
- All critical operations respect pause state
- Owner can pause contract in emergency
- Tests verify pause functionality

### Test Mode Protection
- Skips actual XCM transfers
- Allows local testing without cross-chain complexity
- Prevents accidental mainnet interactions

### Operator Restrictions
- Only operator can execute positions
- Only operator can liquidate positions
- Prevents unauthorized operations

## Expected Test Outcomes

### All Tests Passing
```
✅ Contract is properly configured
✅ All integrations working
✅ Ready for production deployment
```

### Some Tests Skipped
```
⚠️  Missing configuration (normal for partial setup)
⚠️  NFPM not configured
⚠️  Test account lacks permissions
```

### Tests Failing
```
❌ Configuration errors
❌ Integration issues
❌ Review contract setup
```

## Troubleshooting

### "Test mode must be enabled"
```javascript
await proxy.setTestMode(true);
```

### "Token not supported"
```javascript
await proxy.addSupportedToken(tokenAddress);
```

### "not operator"
```javascript
await proxy.setOperator(yourAddress);
```

### "NFPM not set"
```javascript
await proxy.setNFPM(nfpmAddress);
```

### "Contract is paused"
```javascript
await proxy.unpause();
```

## Network Configuration

From `hardhat.config.js`:
```javascript
moonbase: {
  url: "https://rpc.api.moonbase.moonbeam.network",
  chainId: 1287,
  accounts: [MOON_PRIVATE_KEY],
  gasPrice: 1000000000
}
```

## Known Test Addresses (Moonbase Alpha)

```javascript
WETH_MOONBASE = "0x1436aE0dF0A8663F18c0Ec51d7e2E46591730715"
TEST_POOL_ID = "0x1234567890abcdef1234567890abcdef12345678" // Mock for testing
```

## Integration with AssetHub Tests

These XCMProxy tests complement the AssetHub testnet tests:

1. **AssetHub** dispatches investments → **XCMProxy** receives assets
2. **XCMProxy** executes positions → Updates sent to **AssetHub**
3. **XCMProxy** liquidates → Returns assets to **AssetHub**

Run both test suites to validate full cross-chain flow:
```bash
# AssetHub side (Passet Hub testnet)
npx hardhat test test/AssetHubVault/testnet/*.test.js --network passethub

# Moonbase side (Moonbase Alpha testnet)
npx hardhat test test/XCMProxy/testnet/*.test.js --network moonbase
```

## Test Coverage & Status

### ✅ Passing Tests (44/50 - 88%)

**Configuration & Validation (17 tests)**
- Contract health checks
- Role configuration validation
- DEX integration verification
- Operating parameters

**Asset Reception (7 tests)**
- Pending position creation
- Parameter validation
- Event emission
- Duplicate prevention

**Admin Functions (15 tests)**
- Pause/unpause controls
- Test mode management
- Operator controls
- Token management
- Slippage configuration

**Cancellation (5 tests)**
- Pending position cancellation
- Invalid cancellation rejection

### ⚠️ Requires Real Pool Setup (6 tests)

**Position Execution (3 tests)**
- Executing pending investments
- NFPM position minting
- Position state transitions

**Liquidation (3 tests)**
- Full liquidation flow
- Position closure and NFT burning
- Asset return to Asset Hub

**Why these tests are skipped by default:**
- Require real Algebra pool address (not mock)
- Require XCMProxy funded with test tokens
- Require pool with sufficient liquidity

**To enable these tests:**
```bash
# Set real pool address
$env:MOONBASE_REAL_POOL="0xRealAlgebraPoolAddress"

# Fund the contract
# Transfer WETH to XCMProxy address

# Run tests
npx hardhat test test/XCMProxy/testnet/3.execute-position.test.js --network moonbase
```

**For detailed explanation, see:** `FAILURE_ANALYSIS.md`

---

## Best Practices

1. **Always run config check first** - Validates setup before other tests
2. **Keep test mode enabled** - Unless specifically testing XCM transfers
3. **Run tests sequentially** - Some tests depend on state from previous tests
4. **Monitor gas costs** - Testnet transactions still consume gas
5. **Check health summary** - Test 5 provides comprehensive status report
6. **Review FAILURE_ANALYSIS.md** - Understand test limitations and setup requirements

## Support

For issues or questions:
- Check contract configuration with test 1
- Review error messages carefully
- Verify account permissions
- Ensure sufficient DEV balance

## License

Apache-2.0

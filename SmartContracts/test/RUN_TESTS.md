# How to Run LiquiDOT Tests

## 🎯 Quick Start

### Current Phase: Testnet Testing (No XCM Yet)

```powershell
# 1. Set your deployed AssetHubVault address
$env:ASSETHUB_CONTRACT="0xYourContractAddressHere"

# 2. Run testnet-safe tests
cd SmartContracts
npx hardhat test test/AssetHubVault/testnet/**/*.test.js
```

## 📋 Test Categories

### ✅ **Testnet Tests** (Can Run NOW)
**Location:** `test/AssetHubVault/testnet/`  
**Requires:** Deployed AssetHubVault (via Remix)  
**Safe:** Yes - works with existing state

```powershell
# Configuration check (read-only, 100% safe)
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js

# Deposit/Withdrawal tests (additive, safe)
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js

# All testnet tests
npx hardhat test test/AssetHubVault/testnet/**/*.test.js
```

### ⏳ **Integration Tests** (When XCM Connects)
**Location:** `test/Integration/`  
**Requires:** AssetHubVault + XCMProxy + XCM Channel  
**Safe:** Auto-skips if XCM not available

```powershell
# Set both contract addresses
$env:ASSETHUB_CONTRACT="0xVaultAddress"
$env:XCMPROXY_CONTRACT="0xProxyAddress"

# Test full investment flow (Asset Hub → Moonbase)
npx hardhat test test/Integration/1.full-investment-flow.test.js

# Test full liquidation flow (Moonbase → Asset Hub)
npx hardhat test test/Integration/2.full-liquidation-flow.test.js

# All integration tests
npx hardhat test test/Integration/**/*.test.js
```

### 🔧 **Local Development Tests** (Optional)
**Location:** `test/AssetHubVault/local/`  
**Requires:** Local Hardhat network  
**Safe:** Only for local dev

```powershell
# These deploy fresh contracts locally
npx hardhat test test/AssetHubVault/local/**/*.test.js
```

## 🔍 Detailed Test Runs

### 1. Configuration Check (Safe, Read-Only)
```powershell
$env:ASSETHUB_CONTRACT="0xYourAddress"
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js
```

**Output:**
```
✅ Connected to contract
  Admin: 0x...
  Operator: 0x...
  Emergency: 0x...
  XCM Precompile: 0x...
  Test Mode: true
  Paused: false
  Contract Balance: 10.5 ETH
```

### 2. Deposit Tests (Safe, Small Amounts)
```powershell
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js
```

**What it tests:**
- Deposit functionality
- Withdrawal functionality
- Balance tracking
- Event emission
- Validation/reverts

**Note:** Uses small amounts (0.01-0.1 ETH) for safety

### 3. Investment Flow (When XCM Ready)
```powershell
$env:ASSETHUB_CONTRACT="0x..."
$env:XCMPROXY_CONTRACT="0x..."
npx hardhat test test/Integration/1.full-investment-flow.test.js
```

**What it tests:**
- Deposit → Investment → XCM → Position Creation
- Cross-chain message flow
- State synchronization
- Event tracking

**Duration:** ~2 minutes (includes XCM wait time)

### 4. Liquidation Flow (When XCM Ready)
```powershell
npx hardhat test test/Integration/2.full-liquidation-flow.test.js
```

**What it tests:**
- Liquidation → Swap → XCM Return → Settlement
- Profit/loss calculation
- User withdrawal after settlement

**Duration:** ~3 minutes (includes DEX operations + XCM)

## 🎛️ Test Configuration

### Environment Variables

```powershell
# Required for testnet tests
$env:ASSETHUB_CONTRACT="0xYourVaultAddress"

# Required for integration tests
$env:XCMPROXY_CONTRACT="0xYourProxyAddress"

# Optional: Specify network
$env:HARDHAT_NETWORK="moonbase"  # or "assethub"

# Optional: Custom RPC
$env:ASSETHUB_RPC="https://your-rpc-url"
```

### Hardhat Config

Make sure your `hardhat.config.js` has the correct network settings:

```javascript
module.exports = {
  networks: {
    assethub: {
      url: process.env.ASSETHUB_RPC || "https://rococo-asset-hub-rpc.polkadot.io",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1000 // Asset Hub chainId
    },
    moonbase: {
      url: process.env.MOONBASE_RPC || "https://rpc.api.moonbase.moonbeam.network",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1287
    }
  }
};
```

## 📊 Test Coverage Report

### Current Coverage (Testnet Only)

| Test Area | Tests | Executable Now | Notes |
|-----------|-------|----------------|-------|
| Configuration | 5 | ✅ Yes | Read-only |
| Deposits/Withdrawals | 15 | ✅ Yes | Small amounts |
| Validation | 8 | ✅ Yes | No state change |
| Positions (Test Mode) | 5 | ⚠️ If operator | Test mode only |
| **Testnet Total** | **33** | **✅ 28** | **Ready now** |

### Future Coverage (When XCM Ready)

| Test Area | Tests | Status |
|-----------|-------|--------|
| Investment Flow | 6 | ⏳ Ready |
| Liquidation Flow | 8 | ⏳ Ready |
| Multi-User Scenarios | 4 | ⏳ Ready |
| Emergency Functions | 3 | ⏳ Ready |
| **Integration Total** | **21** | **⏳ When XCM** |

### Full System Coverage

| Component | Tests | Status |
|-----------|-------|--------|
| AssetHubVault | 47 | ✅ 28 now, ⏳ 19 later |
| Integration | 21 | ⏳ When XCM |
| XCMProxy | 60 | ⏳ When Moonbase |
| **Total** | **128** | **28 ready** |

## 🚨 Important Notes

### Testnet Testing

⚠️ **State Persistence**
- Contract state does NOT reset between tests
- Tests are designed to work with existing state
- Use small amounts for safety

⚠️ **Cost**
- Each test costs gas (testnet tokens)
- Deposits add up over multiple runs
- Consider withdrawing between test runs

⚠️ **Permissions**
- Some tests require operator/admin permissions
- Tests will skip if you don't have required role
- Check roles with config-check test first

### Integration Testing

⚠️ **XCM Timing**
- Cross-chain messages take 30-60 seconds
- Tests have long timeouts (2-3 minutes)
- Be patient with integration tests

⚠️ **Prerequisites**
- XCM channel must be established
- Both contracts must be deployed
- Test mode must be DISABLED for real XCM
- Ensure sufficient balance on both chains

## 🎯 Recommended Test Workflow

### Phase 1: Initial Deployment
```powershell
# 1. Deploy AssetHubVault via Remix
# 2. Set environment variable
$env:ASSETHUB_CONTRACT="0xNewAddress"

# 3. Verify deployment
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js

# 4. Test basic functionality
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js
```

### Phase 2: XCM Connection
```powershell
# 1. Deploy XCMProxy on Moonbase
# 2. Establish XCM channel
# 3. Disable test mode on both contracts
# 4. Set both addresses
$env:ASSETHUB_CONTRACT="0x..."
$env:XCMPROXY_CONTRACT="0x..."

# 5. Test investment flow
npx hardhat test test/Integration/1.full-investment-flow.test.js

# 6. Test liquidation flow
npx hardhat test test/Integration/2.full-liquidation-flow.test.js
```

### Phase 3: Continuous Testing
```powershell
# Regular smoke tests
npm run test:smoke

# Full integration suite (when XCM ready)
npm run test:integration

# Full coverage report
npm run test:coverage
```

## 📝 Test Output Examples

### Successful Test Run
```
AssetHubVault Testnet - Deposits & Withdrawals
  Deposit Functionality
    ✓ should accept deposits (TEST-AHV-007) (234ms)
       ✓ Deposited 0.1 ETH
       ✓ New balance: 5.3 ETH
    ✓ should emit Deposit event (178ms)
    ✓ should revert on zero deposit (TEST-AHV-008) (89ms)
  
  Withdrawal Functionality
    ✓ should allow withdrawal if balance exists (TEST-AHV-010/011) (312ms)
       ✓ Withdrew 0.01 ETH
       ✓ Remaining balance: 5.29 ETH
    ✓ should revert on insufficient balance (TEST-AHV-012) (92ms)

  15 passing (2s)
```

### Skipped Test (Missing Prerequisites)
```
Integration - Complete Investment Flow
  ⏭️  Skipping integration tests - XCM not available
     Requirements:
     - Set ASSETHUB_CONTRACT environment variable
     - Set XCMPROXY_CONTRACT environment variable
     - Disable test mode on both contracts

  0 passing (1s)
  0 failing
  6 pending
```

## 🛠️ Troubleshooting

### "ASSETHUB_CONTRACT not set"
```powershell
$env:ASSETHUB_CONTRACT="0xYourAddress"
```

### "Failed to connect to contract"
- Verify contract address is correct
- Check you're on the right network
- Ensure RPC endpoint is working

### "Insufficient balance"
```powershell
# Deposit more funds first
npx hardhat run scripts/fund-test-account.js
```

### "Not operator" (test skipped)
- These tests require operator role
- Normal - tests auto-skip if you don't have permission
- Or set operator to your address if you're admin

### Tests timing out
- Increase timeout in test file
- Check XCM channel is working
- Verify both chains are responsive

## 📚 Additional Resources

- **Test Strategy:** `test/COMPLETE_TEST_STRATEGY.md`
- **Testnet Guide:** `test/AssetHubVault/TESTNET_TESTING_GUIDE.md`
- **Test Structure:** `test/TEST_STRUCTURE.md`
- **Requirements:** `TESTING-REQUIREMENTS.md`

## 🎓 Summary

**Now (Testnet Only):**
```powershell
$env:ASSETHUB_CONTRACT="0x..."
npx hardhat test test/AssetHubVault/testnet/**/*.test.js
```

**When XCM Ready:**
```powershell
$env:XCMPROXY_CONTRACT="0x..."
npx hardhat test test/Integration/**/*.test.js
```

**Full System:**
```powershell
npm run test:full
```

**Current Status:** ✅ 28 tests ready to run on testnet NOW!


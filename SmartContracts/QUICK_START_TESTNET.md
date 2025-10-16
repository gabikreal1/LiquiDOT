# 🚀 Quick Start: Testing Deployed Contracts

## Current Situation

✅ **AssetHubVault** deployed on **Paseo Asset Hub** via Remix  
✅ **XCMProxy** deployed on **Moonbase Alpha** via Hardhat with Algebra suite  
✅ **Test mode** enabled on both contracts  
❌ **Not yet connected** - contracts need to be linked

---

## Step-by-Step Testing Guide

### 1️⃣ Verify Configuration (5 minutes)

Set your deployed contract addresses:

```powershell
# PowerShell (Windows/Mac)
$env:ASSETHUB_CONTRACT="0xYourAssetHubVaultAddress"
$env:XCMPROXY_CONTRACT="0xYourXCMProxyAddress"
```

Check AssetHub configuration:
```bash
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
```

**Expected Output:**
```
✅ Admin: 0x...
✅ Operator: 0x...
✅ Test Mode: true ← CRITICAL!
✅ Paused: false
```

Check XCMProxy configuration:
```bash
npx hardhat run scripts/verify-xcmproxy-config.js --network moonbase
```

**Expected Output:**
```
✅ Owner: 0x...
✅ Operator: 0x...
✅ Algebra DEX fully configured
✅ Test Mode: true ← CRITICAL!
```

**❌ If test mode is `false`:** Enable it before continuing!
```javascript
// On AssetHub
await assetHubVault.setTestMode(true);

// On Moonbase
await xcmProxy.setTestMode(true);
```

---

### 2️⃣ Link the Contracts (10 minutes)

**Step A: Add Moonbase to AssetHub registry (on Paseo)**

```bash
npx hardhat run scripts/link-contracts.js --network passethub
```

This calls:
- `assetHubVault.addChain(1287, "0x0001...", "Moonbase Alpha", xcmProxyAddress)`

**Step B: Set AssetHub as trusted caller (on Moonbase)**

```bash
npx hardhat run scripts/link-contracts.js --network moonbase
```

This calls:
- `xcmProxy.setTrustedXcmCaller(assetHubAddress)`

**✅ Verification:**
```bash
# Should show Moonbase in registry
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
```

---

### 3️⃣ Test Basic Functionality (10 minutes)

Test deposits and withdrawals on AssetHub:

```bash
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
```

**What it tests:**
- ✅ Deposits (0.01-0.5 ETH)
- ✅ Balance tracking
- ✅ Withdrawals
- ✅ Multi-user operations

**Safe for testnet:**
- Uses small amounts
- Works with existing state
- Idempotent (safe to run multiple times)

---

### 4️⃣ Test Mock Integration (Local - 15 minutes)

Before testing on real chains, verify logic locally:

```bash
# Test complete investment flow (local, automated)
npx hardhat test test/Integration/mock-xcm/1.mock-investment-flow.test.js

# Test complete liquidation flow (local, automated)
npx hardhat test test/Integration/mock-xcm/2.mock-liquidation-flow.test.js
```

**What these do:**
- Deploy both contracts on local network
- User deposits
- Operator dispatches investment (test mode)
- **Manually call** `executeInvestment` on XCMProxy (simulating XCM)
- Create position
- Liquidate position
- **Manually call** `settleLiquidation` on AssetHub (simulating XCM return)
- Verify balances updated

**Output:**
```
✅ User deposits 10 ETH
✅ Investment dispatched (5 ETH)
✅ Position created on Moonbase (manual call)
✅ Position linked on AssetHub
✅ Liquidation executed
✅ Settlement complete
✅ User balance updated
```

This verifies the **complete logic** without requiring real XCM!

---

### 5️⃣ Test on Real Chains with Guided Settlement (30 minutes)

Now test on actual testnets with manual cross-chain calls:

**Prerequisites:**
- Pool exists on Moonbase with liquidity
- Know pool address and WETH address

**Set pool info:**
```powershell
$env:MOONBASE_POOL="0xYourPoolAddress"
$env:MOONBASE_WETH="0xYourWETHAddress"
```

**Run guided test:**
```bash
npx hardhat test test/Integration/testnet/1.guided-investment-flow.test.js --network passethub
```

**This test walks you through:**

1. **Deposit on Paseo** (automated)
   - User deposits to AssetHub
   - Balance updated

2. **Dispatch Investment** (automated)
   - Operator calls `dispatchInvestment`
   - Test mode = no XCM sent
   - Position created with PENDING status

3. **Execute on Moonbase** (MANUAL)
   - Switch to Moonbase
   - Call `xcmProxy.executeInvestment(...)`
   - Creates NFT position in Algebra pool
   - Position becomes ACTIVE

4. **Liquidate on Moonbase** (MANUAL)
   - Call `xcmProxy.liquidatePosition(...)`
   - Burns NFT, swaps to ETH
   - Get proceeds amount

5. **Settle on Paseo** (MANUAL)
   - Call `assetHubVault.settleLiquidation(...)`
   - Updates user balance
   - Position becomes CLOSED

The test provides exact commands for each manual step!

---

## 🎯 Testing Matrix

| Test | Location | Network | Duration | Automation | Purpose |
|------|----------|---------|----------|------------|---------|
| **Config Check** | `test/AssetHubVault/testnet/1.config-check.test.js` | Paseo | 2 min | ✅ Full | Verify deployment |
| **XCMProxy Config** | `scripts/verify-xcmproxy-config.js` | Moonbase | 2 min | ✅ Full | Verify deployment |
| **Deposits** | `test/AssetHubVault/testnet/2.deposits.test.js` | Paseo | 5 min | ✅ Full | Test basic functions |
| **Mock Investment** | `test/Integration/mock-xcm/1.mock-investment-flow.test.js` | Local | 10 min | ✅ Full | Verify investment logic |
| **Mock Liquidation** | `test/Integration/mock-xcm/2.mock-liquidation-flow.test.js` | Local | 10 min | ✅ Full | Verify liquidation logic |
| **Guided Flow** | `test/Integration/testnet/1.guided-investment-flow.test.js` | Paseo + Moonbase | 30 min | ⚠️ Manual | Real chain testing |

---

## ⚠️ Important Notes

### Test Mode
- **Enabled** = XCM calls skipped, safe for testing
- **Disabled** = Real XCM attempted, requires proper XCM setup

### State Persistence
- AssetHub deployed via Remix **cannot be redeployed**
- Tests work with **existing state**
- Safe to run multiple times

### Gas Costs
- Paseo: Get testnet tokens from [Polkadot faucet](https://faucet.polkadot.io/)
- Moonbase: Get DEV tokens from [Moonbeam faucet](https://faucet.moonbeam.network/)

### Network Switching
For manual steps, you need to switch networks:
```bash
# Use --network flag
npx hardhat run script.js --network passethub
npx hardhat run script.js --network moonbase
```

Or use Hardhat console:
```bash
npx hardhat console --network moonbase
```

---

## 🎉 Success Criteria

You'll know everything works when:

- ✅ Configuration tests pass on both chains
- ✅ Deposits/withdrawals work on AssetHub
- ✅ Mock integration tests pass locally
- ✅ Can dispatch investment on Paseo (test mode)
- ✅ Can manually execute investment on Moonbase
- ✅ Position created on both chains
- ✅ Can liquidate position on Moonbase
- ✅ Can settle liquidation on Paseo
- ✅ User balance updates correctly

---

## 📚 Next Steps After Testing

Once all tests pass with test mode:

### Disable Test Mode (Production)
```javascript
await assetHubVault.setTestMode(false);
await xcmProxy.setTestMode(false);
```

### Configure Real XCM
- Set correct XCM precompile addresses
- Configure XCM fee amounts
- Test XCM channel connectivity

### Run Real Integration Tests
```bash
npx hardhat test test/Integration/1.full-investment-flow.test.js
npx hardhat test test/Integration/2.full-liquidation-flow.test.js
```

These will use **real XCM** - no manual intervention needed!

---

## 🆘 Troubleshooting

### "Contract not found"
- Verify `ASSETHUB_CONTRACT` / `XCMPROXY_CONTRACT` env vars set
- Check you're on correct network (`--network passethub` or `--network moonbase`)

### "Test mode not enabled"
```javascript
// On AssetHub (as admin)
await assetHubVault.setTestMode(true);

// On Moonbase (as owner)
await xcmProxy.setTestMode(true);
```

### "Contracts not linked"
```bash
# Run linking script on both networks
npx hardhat run scripts/link-contracts.js --network passethub
npx hardhat run scripts/link-contracts.js --network moonbase
```

### "Transaction reverted"
- Check you have sufficient testnet tokens
- Verify correct signer (operator for dispatch operations)
- Ensure contract not paused

---

## 📖 Documentation

- **Full Testing Plan**: `/SmartContracts/TESTNET_TESTING_PLAN.md`
- **Test Structure**: `/SmartContracts/test/README.md`
- **Testing Modes**: `/SmartContracts/test/AssetHubVault/TESTING_MODES.md`
- **Mock XCM Guide**: `/SmartContracts/test/Integration/mock-xcm/README.md`
- **Deployment Guide**: `/SmartContracts/MOONBASE_DEPLOYMENT.md`

---

## 🎯 Recommended Testing Order

1. **Config verification** (both chains) → Ensure deployments correct
2. **Link contracts** → Enable cross-chain functionality
3. **Deposit tests** → Verify basic AssetHub operations
4. **Mock integration** (local) → Verify complete logic
5. **Guided flow** (testnet) → Real chain testing with manual settlement

**Total Time: ~1-2 hours for complete testing**

Good luck! 🚀

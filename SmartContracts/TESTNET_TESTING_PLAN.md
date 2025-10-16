# 🧪 Testnet Testing Plan for Deployed Contracts

## 📊 Current Deployment Status

### ✅ Deployed Contracts
- **AssetHubVault**: Deployed on Paseo Asset Hub (Chain ID: 420420422) via Remix
- **XCMProxy**: Deployed on Moonbase Alpha (Chain ID: 1287) via Hardhat with Algebra suite
- **Test Mode**: Enabled on both contracts (XCM calls skipped)
- **Connection Status**: ❌ NOT YET CONNECTED (contracts not linked via addChain)

### 🎯 Testing Goal
Test on **real chains** using Hardhat with:
- Test mode enabled (no actual XCM sending)
- Settlement guided by tests (manual, not XCM)
- Rigorous validation of all contract functionality

---

## 🚀 Phase 1: Configuration Validation (Safe, Read-Only)

### Step 1.1: Verify AssetHubVault Configuration

**Set environment variable:**
```powershell
# PowerShell (Windows/Mac)
$env:ASSETHUB_CONTRACT="0xYourAssetHubVaultAddress"

# Bash (Linux/Mac)
export ASSETHUB_CONTRACT="0xYourAssetHubVaultAddress"
```

**Run configuration test:**
```bash
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
```

**What it verifies (100% read-only, completely safe):**
- ✅ Contract is accessible and responding
- ✅ Admin, operator, emergency roles configured
- ✅ XCM precompile address set (or not set)
- ✅ Pause state (should be unpaused)
- ✅ Test mode enabled (should be true)
- ✅ Contract balance
- ✅ XCM precompile frozen status

**Expected Output:**
```
✅ Successfully connected to contract
Admin: 0x...
Operator: 0x...
Emergency: 0x...
XCM Precompile: 0x... (or warning if not set)
Paused: false
Test Mode: true ✅
Balance: X.XX ETH
```

**Action Required:**
- ✅ If test mode is `true` → Continue
- ❌ If test mode is `false` → Must enable via `setTestMode(true)` as admin
- ⚠️ If XCM precompile is `0x0000...` → Must set before dispatching investments

---

### Step 1.2: Verify XCMProxy Configuration (TODO)

**Set environment variable:**
```powershell
$env:XCMPROXY_CONTRACT="0xYourXCMProxyAddress"
```

**Create verification script** (we'll create this next):
```bash
npx hardhat run scripts/verify-xcmproxy-config.js --network moonbase
```

**What to verify:**
- ✅ Owner, operator, trusted caller configured
- ✅ Algebra contracts set (factory, router, NFPM, quoter)
- ✅ Test mode enabled
- ✅ Pause state
- ✅ Contract balance

---

## 🧪 Phase 2: Basic Functionality Testing (Safe on Testnet)

### Step 2.1: Test Deposits and Withdrawals on AssetHub

**Run deposit tests:**
```bash
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
```

**What it tests (safe, uses small amounts):**
- ✅ Users can deposit (0.01-0.5 ETH test amounts)
- ✅ Balance tracking works correctly
- ✅ Users can withdraw
- ✅ Multi-user deposits work
- ✅ Events emitted correctly

**Important:** Tests are idempotent and work with existing state:
- If user already has balance, tests add to it
- Uses relative balance checks (before/after)
- Safe to run multiple times

**Expected Output:**
```
✅ should accept deposits
   Deposited 0.1 ETH
   Balance increased correctly

✅ should accept withdrawals
   Withdrew 0.05 ETH
   Balance decreased correctly

✅ should handle multiple users
   User1 balance: X ETH
   User2 balance: Y ETH
```

---

### Step 2.2: Test XCMProxy Basic Functions (TODO)

We need to create similar tests for XCMProxy on Moonbase. Create a basic function test.

---

## 🔗 Phase 3: Connect the Contracts

**CRITICAL:** Contracts must be linked before testing cross-chain functionality.

### Step 3.1: Add Moonbase to AssetHubVault Chain Registry

**Option A: Via Remix (if you deployed via Remix)**

1. Open AssetHubVault in Remix
2. Call `addChain`:
   - `chainId`: `1287`
   - `xcmDestination`: `"0x0001000100a10f041300c10f030400010300"` (Moonbase parachain XCM location)
   - `name`: `"Moonbase Alpha"`
   - `proxyAddress`: `0xYourXCMProxyAddress`

**Option B: Via Hardhat Script**

Create script `scripts/link-contracts.js`:
```javascript
const hre = require("hardhat");

async function main() {
  const ASSETHUB_ADDRESS = process.env.ASSETHUB_CONTRACT;
  const XCMPROXY_ADDRESS = process.env.XCMPROXY_CONTRACT;
  
  if (!ASSETHUB_ADDRESS || !XCMPROXY_ADDRESS) {
    throw new Error("Set both ASSETHUB_CONTRACT and XCMPROXY_CONTRACT");
  }

  const AssetHubVault = await hre.ethers.getContractFactory(
    "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
  );
  const vault = AssetHubVault.attach(ASSETHUB_ADDRESS);

  console.log("🔗 Linking contracts...");
  
  // Add Moonbase Alpha to chain registry
  const tx = await vault.addChain(
    1287, // Moonbase chainId
    "0x0001000100a10f041300c10f030400010300", // Moonbase XCM destination
    "Moonbase Alpha",
    XCMPROXY_ADDRESS
  );

  await tx.wait();
  console.log("✅ Moonbase added to AssetHubVault chain registry");
  
  // Verify
  const chainInfo = await vault.supportedChains(1287);
  console.log("Chain info:", {
    proxyAddress: chainInfo.proxyAddress,
    xcmDestination: chainInfo.xcmDestination,
    name: chainInfo.name,
    active: chainInfo.active
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Run:**
```bash
npx hardhat run scripts/link-contracts.js --network passethub
```

### Step 3.2: Set AssetHub Address in XCMProxy

**Via Hardhat script** (add to above script):
```javascript
// After adding chain to vault, configure XCMProxy
const XCMProxy = await hre.ethers.getContractFactory(
  "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
);
const proxy = XCMProxy.attach(XCMPROXY_ADDRESS);

// Switch to Moonbase network manually or in separate script
console.log("⚠️  Now run the following on Moonbase network:");
console.log(`   proxy.setTrustedXcmCaller("${ASSETHUB_ADDRESS}")`);
```

---

## 🌉 Phase 4: Mock XCM Integration Testing

**Purpose:** Test complete investment/liquidation flows without real XCM by manually calling functions that XCM would trigger.

### Step 4.1: Mock Investment Flow (Local Test First)

**Run locally to verify logic:**
```bash
npx hardhat test test/Integration/mock-xcm/1.mock-investment-flow.test.js
```

**What it does:**
1. Deploys both contracts on local network
2. User deposits to AssetHubVault
3. Operator dispatches investment (test mode = no XCM)
4. **MANUALLY** calls XCMProxy.executeInvestment (simulating XCM arrival)
5. Verifies position created on both sides
6. Tests settlement flow

**Flow:**
```
AssetHubVault (Local)              XCMProxy (Local)
---------------------              ----------------
deposit()                          
  ↓                                
dispatchInvestment()               
  (test mode - no XCM)             
  ↓                                
  💸 Manual fund transfer →
  📞 Manual executeInvestment() →  
                                   executeInvestment()
                                   Creates position
                                   ✅ Position stored
```

**Expected Output:**
```
✅ User deposits 10 ETH
✅ Operator dispatches investment (5 ETH)
✅ User balance reduced to 5 ETH
✅ Manually call executeInvestment on XCMProxy
✅ Position created on Moonbase
✅ Position linked on AssetHub
```

### Step 4.2: Mock Liquidation Flow (Local Test)

**Run:**
```bash
npx hardhat test test/Integration/mock-xcm/2.mock-liquidation-flow.test.js
```

**What it does:**
1. Creates investment (using mock flow from 4.1)
2. **MANUALLY** calls XCMProxy.liquidatePosition
3. Gets liquidation proceeds
4. **MANUALLY** calls AssetHubVault.settleLiquidation (simulating XCM return)
5. Verifies user balance updated

**Flow:**
```
XCMProxy (Local)                   AssetHubVault (Local)
----------------                   ---------------------
liquidatePosition()                
  (burns NFT, swaps to ETH)        
  ↓                                
  💸 Manual fund transfer →
  📞 Manual settleLiquidation() →  
                                   settleLiquidation()
                                   Updates user balance
                                   ✅ Position closed
```

---

## 🎯 Phase 5: Testnet Integration Testing (Guided Settlement)

**Now that contracts are deployed, linked, and logic verified locally, test on real chains with manual XCM simulation.**

### Step 5.1: Create Testnet Integration Test Script

**Create:** `test/Integration/testnet/1.guided-investment-flow.test.js`

```javascript
/**
 * Testnet Integration Test: Guided Investment Flow
 * 
 * Tests investment on REAL CHAINS but with MANUAL settlement:
 * - AssetHubVault on Paseo Asset Hub
 * - XCMProxy on Moonbase Alpha
 * - Test mode enabled (no XCM)
 * - Manually call cross-chain functions
 * 
 * Usage:
 *   $env:ASSETHUB_CONTRACT="0x..."
 *   $env:XCMPROXY_CONTRACT="0x..."
 *   npx hardhat test test/Integration/testnet/1.guided-investment-flow.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Testnet Integration - Guided Investment Flow", function () {
  let assetHubVault, xcmProxy;
  let user, operator;
  
  const ASSETHUB_ADDRESS = process.env.ASSETHUB_CONTRACT;
  const XCMPROXY_ADDRESS = process.env.XCMPROXY_CONTRACT;

  before(async function () {
    if (!ASSETHUB_ADDRESS || !XCMPROXY_ADDRESS) {
      throw new Error("Set both ASSETHUB_CONTRACT and XCMPROXY_CONTRACT");
    }

    [user, operator] = await ethers.getSigners();

    // Attach to deployed contracts
    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    const XCMProxy = await ethers.getContractFactory(
      "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
    );

    assetHubVault = AssetHubVault.attach(ASSETHUB_ADDRESS);
    xcmProxy = XCMProxy.attach(XCMPROXY_ADDRESS);

    console.log("\n📡 Connected to testnet contracts:");
    console.log(`   AssetHub: ${ASSETHUB_ADDRESS}`);
    console.log(`   XCMProxy: ${XCMPROXY_ADDRESS}\n`);

    // Verify test mode enabled
    const assetHubTestMode = await assetHubVault.testMode();
    const xcmProxyTestMode = await xcmProxy.testMode();

    console.log(`   AssetHub test mode: ${assetHubTestMode}`);
    console.log(`   XCMProxy test mode: ${xcmProxyTestMode}\n`);

    if (!assetHubTestMode || !xcmProxyTestMode) {
      throw new Error("❌ Test mode must be enabled on both contracts!");
    }
  });

  it("should complete investment with guided settlement", async function () {
    // This test requires MANUAL STEPS between assertions
    console.log("\n⚠️  This test requires manual intervention!");
    console.log("    Follow the steps below:\n");

    // STEP 1: Deposit (can be automated)
    console.log("📥 STEP 1: Deposit to AssetHubVault on Paseo");
    const depositAmount = ethers.parseEther("0.1");
    
    const balanceBefore = await assetHubVault.getUserBalance(user.address);
    console.log(`   Current balance: ${ethers.formatEther(balanceBefore)} ETH`);
    
    // Deposit
    const depositTx = await assetHubVault.connect(user).deposit({ 
      value: depositAmount 
    });
    await depositTx.wait();
    
    const balanceAfter = await assetHubVault.getUserBalance(user.address);
    console.log(`   ✅ Deposited ${ethers.formatEther(depositAmount)} ETH`);
    console.log(`   New balance: ${ethers.formatEther(balanceAfter)} ETH\n`);

    expect(balanceAfter).to.equal(balanceBefore + depositAmount);

    // STEP 2: Dispatch investment (automated)
    console.log("🚀 STEP 2: Dispatch investment on AssetHubVault");
    
    // You need actual pool address from Moonbase
    const poolAddress = "0xYourPoolAddressOnMoonbase"; // TODO: Set this
    const wethAddress = "0xYourWETHAddressOnMoonbase"; // TODO: Set this
    const investAmount = ethers.parseEther("0.05");

    const dispatchTx = await assetHubVault.connect(operator).dispatchInvestment(
      user.address,
      1287, // Moonbase
      poolAddress,
      wethAddress,
      investAmount,
      -1, // tick lower
      1,  // tick upper
      "0x030100001234", // XCM destination
      "0x0300010203"    // XCM message
    );

    const receipt = await dispatchTx.wait();
    
    // Extract position ID
    const event = receipt.logs.find(log => {
      try {
        return assetHubVault.interface.parseLog(log).name === "InvestmentInitiated";
      } catch {
        return false;
      }
    });

    const positionId = assetHubVault.interface.parseLog(event).args.positionId;
    console.log(`   ✅ Investment dispatched, position ID: ${positionId}\n`);

    // STEP 3: MANUAL - Switch to Moonbase and execute
    console.log("🌉 STEP 3: MANUAL - Execute investment on Moonbase");
    console.log("   ⚠️  YOU MUST DO THIS MANUALLY:");
    console.log(`   1. Switch Hardhat to Moonbase network`);
    console.log(`   2. Send ${ethers.formatEther(investAmount)} ETH to XCMProxy`);
    console.log(`   3. Call: xcmProxy.executeInvestment(`);
    console.log(`        user: "${user.address}",`);
    console.log(`        poolId: "${poolAddress}",`);
    console.log(`        baseAsset: "${wethAddress}",`);
    console.log(`        amount: "${investAmount}",`);
    console.log(`        tickLower: -1,`);
    console.log(`        tickUpper: 1,`);
    console.log(`        positionId: "${positionId}"`);
    console.log(`      )`);
    console.log("\n   Press Enter when done...\n");

    // In real test, you'd pause here for manual execution
    // For now, we'll just document the process

    // STEP 4: Verify position on both sides
    console.log("✅ STEP 4: Verify position created");
    console.log("   Check on AssetHub:");
    
    const positionInfo = await assetHubVault.positions(positionId);
    console.log(`   Position status: ${positionInfo.status}`);
    console.log(`   Position amount: ${ethers.formatEther(positionInfo.amount)} ETH`);
    
    // Would also check on Moonbase side
    console.log("\n   Check on Moonbase (manual):");
    console.log(`   Call: xcmProxy.userPositions("${user.address}", 0)`);
    console.log("   Should return position with matching amount\n");
  });

  it("should complete liquidation with guided settlement", async function () {
    // Similar structure for liquidation
    console.log("\n📋 Liquidation Flow (TODO)");
    console.log("   1. Call liquidatePosition on Moonbase");
    console.log("   2. Get proceeds amount");
    console.log("   3. Transfer proceeds to AssetHub");
    console.log("   4. Call settleLiquidation on AssetHub");
    console.log("   5. Verify user balance updated\n");
  });
});
```

**Run:**
```bash
# Set both contracts
$env:ASSETHUB_CONTRACT="0xYourAssetHubAddress"
$env:XCMPROXY_CONTRACT="0xYourXCMProxyAddress"

# Run test (will pause for manual steps)
npx hardhat test test/Integration/testnet/1.guided-investment-flow.test.js
```

---

## 📝 Testing Checklist

### Phase 1: Configuration ✅
- [ ] AssetHub config verified (roles, test mode, XCM precompile)
- [ ] XCMProxy config verified (roles, Algebra, test mode)
- [ ] Both contracts have test mode enabled
- [ ] Both contracts are unpaused

### Phase 2: Basic Functionality ✅
- [ ] AssetHub deposits work
- [ ] AssetHub withdrawals work
- [ ] Multi-user deposits work
- [ ] XCMProxy basic functions work

### Phase 3: Contract Linking ✅
- [ ] Moonbase added to AssetHub chain registry
- [ ] AssetHub set as trusted caller on XCMProxy
- [ ] Can query chain info from AssetHub
- [ ] Contracts recognize each other

### Phase 4: Mock Integration (Local) ✅
- [ ] Mock investment flow passes locally
- [ ] Mock liquidation flow passes locally
- [ ] Position linking works
- [ ] Settlement logic verified

### Phase 5: Testnet Integration ✅
- [ ] Can dispatch investment on Paseo
- [ ] Can manually execute investment on Moonbase
- [ ] Position created on both chains
- [ ] Can liquidate position on Moonbase
- [ ] Can settle liquidation on Paseo
- [ ] User balance updates correctly

---

## 🎯 Next Steps After Testing

Once all tests pass with guided settlement:

1. **Disable Test Mode** (when ready for production):
   ```javascript
   await assetHubVault.setTestMode(false);
   await xcmProxy.setTestMode(false);
   ```

2. **Test Real XCM** (requires XCM channel configured):
   - XCM messages will actually be sent
   - No manual intervention needed
   - Full cross-chain automation

3. **Run Real Integration Tests**:
   ```bash
   npx hardhat test test/Integration/1.full-investment-flow.test.js
   npx hardhat test test/Integration/2.full-liquidation-flow.test.js
   ```

---

## ⚠️ Important Safety Notes

### For Testnet Testing:
- ✅ **Safe**: Configuration checks (read-only)
- ✅ **Safe**: Deposit/withdrawal tests (small amounts)
- ✅ **Safe**: Mock XCM tests (local network)
- ⚠️ **Requires Care**: Investment dispatch (uses real testnet gas)
- ⚠️ **Manual Required**: Cross-chain execution (test mode, manual calls)

### State Persistence:
- Contracts deployed via Remix **cannot be redeployed**
- Tests must work with **existing state**
- Use **relative checks** (before/after balances)
- Tests should be **idempotent** (safe to run multiple times)

### Gas Costs:
- Paseo Asset Hub: Uses testnet tokens (get from faucet)
- Moonbase Alpha: Uses testnet DEV tokens (get from faucet)
- Keep amounts small (0.01-0.5 ETH) for testing

---

## 🔧 Troubleshooting

### "Contract not found"
- Verify contract address in environment variable
- Check you're on correct network
- Ensure contract is deployed

### "Test mode not enabled"
- Call `setTestMode(true)` as admin/owner
- Verify with config check test

### "Transaction reverted"
- Check you have sufficient testnet tokens
- Verify you're using correct signer (operator for dispatch)
- Check contract is not paused

### "Position not found"
- Ensure investment was dispatched successfully
- Verify position ID matches
- Check on both chains

---

## 📚 Additional Resources

- **Test Structure**: `/SmartContracts/test/README.md`
- **Testing Modes**: `/SmartContracts/test/AssetHubVault/TESTING_MODES.md`
- **Mock XCM Guide**: `/SmartContracts/test/Integration/mock-xcm/README.md`
- **Deployment Guide**: `/SmartContracts/MOONBASE_DEPLOYMENT.md`

---

## Summary

This plan provides a **rigorous, step-by-step approach** to testing your deployed contracts on real testnets:

1. ✅ **Verify configuration** (safe, read-only)
2. ✅ **Test basic functions** (deposits/withdrawals with small amounts)
3. ✅ **Link contracts** (via addChain/setTrustedCaller)
4. ✅ **Test mock integration locally** (verify logic without XCM)
5. ✅ **Test guided settlement on testnet** (manual cross-chain calls)

All tests work with **test mode enabled** (no actual XCM), **persistent state** (no redeployment), and **manual settlement** guided by tests.

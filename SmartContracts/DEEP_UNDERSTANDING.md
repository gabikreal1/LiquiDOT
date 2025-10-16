# 🔍 Deep Understanding: Current Contract State & Testing Strategy

## 📋 Executive Summary

You have successfully deployed both AssetHubVault and XCMProxy on testnets. This document provides a **rigorous analysis** of the current situation and testing approach.

---

## 🏗️ Deployment Architecture

### Current State

```
┌─────────────────────────────────────────────────────────────────┐
│                    PASEO ASSET HUB                              │
│                  (Chain ID: 420420422)                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │           AssetHubVault.sol                          │      │
│  │                                                      │      │
│  │  - Deployed via Remix                               │      │
│  │  - Test mode: ENABLED ✅                            │      │
│  │  - Custody layer for user deposits                  │      │
│  │  - Multi-chain registry system                      │      │
│  │  - Position tracking (PENDING → ACTIVE → CLOSED)   │      │
│  │                                                      │      │
│  │  Status: ❌ NOT YET LINKED TO MOONBASE              │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ XCM Channel
                              │ (NOT YET CONFIGURED)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MOONBASE ALPHA                                │
│                    (Chain ID: 1287)                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │            XCMProxy.sol                              │      │
│  │                                                      │      │
│  │  - Deployed via Hardhat                             │      │
│  │  - Test mode: ENABLED ✅                            │      │
│  │  - Execution layer with Algebra DEX                 │      │
│  │  - Pending position pattern                         │      │
│  │  - NFT position management                          │      │
│  │                                                      │      │
│  │  ┌────────────────────────────────────────────┐     │      │
│  │  │      Algebra Integral DEX                  │     │      │
│  │  │                                            │     │      │
│  │  │  - Factory: deployed ✅                    │     │      │
│  │  │  - Router: deployed ✅                     │     │      │
│  │  │  - NFPM: deployed ✅                       │     │      │
│  │  │  - Quoter: deployed ✅                     │     │      │
│  │  └────────────────────────────────────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧠 Deep Contract Understanding

### AssetHubVault: Custody & Orchestration Layer

**Purpose**: Holds user funds and orchestrates cross-chain investments

**Key State Variables:**
```solidity
mapping(address => uint256) public userBalances;        // User deposit balances
mapping(bytes32 => Position) public positions;          // Position tracking
mapping(uint256 => ChainInfo) public supportedChains;   // Multi-chain registry
bool public testMode;                                   // Test mode flag
```

**Position Lifecycle:**
```
PENDING (0)  →  ACTIVE (1)  →  CLOSED (2)
    ↓              ↓              ↓
Created by     Confirmed by    Settled by
dispatch       XCM response    liquidation
```

**Critical Functions:**

1. **`deposit()`** - User deposits ETH
   - Increases `userBalances[msg.sender]`
   - Emits `Deposit` event
   - Always safe to call

2. **`dispatchInvestment()`** - Operator initiates cross-chain investment
   ```solidity
   function dispatchInvestment(
       address user,
       uint256 chainId,        // Target chain (1287 for Moonbase)
       address poolId,
       address baseAsset,
       uint256 amount,
       int24 tickLower,
       int24 tickUpper,
       bytes calldata xcmDestination,
       bytes calldata xcmMessage
   ) external onlyOperator whenNotPaused
   ```
   
   - Deducts from `userBalances[user]`
   - Creates position with PENDING status
   - **IF testMode = true**: Skips XCM, emits event only
   - **IF testMode = false**: Sends XCM message to target chain

3. **`settleLiquidation()`** - Updates balance after liquidation
   ```solidity
   function settleLiquidation(
       bytes32 positionId,
       uint256 proceeds,
       bool success
   ) external
   ```
   
   - Called by XCM or manually in test mode
   - Increases `userBalances[position.user]` by `proceeds`
   - Sets position status to CLOSED
   - Emits `LiquidationSettled` event

**Multi-Chain Registry:**
```solidity
struct ChainInfo {
    address proxyAddress;      // XCMProxy address on that chain
    bytes xcmDestination;      // XCM multilocation
    string name;               // Human-readable name
    bool active;               // Enabled/disabled
}
```

**Current State:**
- Moonbase (chainId 1287): **NOT YET ADDED** ❌
- Must call `addChain(1287, xcmDest, "Moonbase Alpha", proxyAddress)`

---

### XCMProxy: Execution & DEX Integration Layer

**Purpose**: Receives XCM messages and executes investments on Algebra DEX

**Key State Variables:**
```solidity
mapping(bytes32 => PendingPosition) public pendingPositions;  // Cross-chain linking
mapping(address => uint256[]) public userPositions;           // NFT position IDs
mapping(uint256 => PositionInfo) public positions;            // Position details
bool public testMode;                                         // Test mode flag
address public trustedXcmCaller;                              // AssetHub address
```

**Pending Position Pattern:**
```
1. AssetHub dispatches investment
   → Creates pendingPosition[positionId] with user/amount/params

2. XCM message arrives (or manual call in test mode)
   → executeInvestment() uses pendingPosition data
   → Creates actual Algebra position
   → Links NFT to user
   → Deletes pendingPosition

3. Liquidation triggered
   → Burns NFT, swaps tokens
   → Sends proceeds back to AssetHub via XCM
```

**Critical Functions:**

1. **`receiveAssets()`** - Receives XCM message from AssetHub
   ```solidity
   function receiveAssets(
       address user,
       address poolId,
       address baseAsset,
       uint256 amount,
       int24 tickLower,
       int24 tickUpper,
       bytes32 assetHubPositionId
   ) external payable
   ```
   
   - **IF testMode = true**: Allows any caller
   - **IF testMode = false**: Only trustedXcmCaller
   - Creates `pendingPosition[assetHubPositionId]`
   - Does NOT create position yet (pending pattern)

2. **`executeInvestment()`** - Actually creates Algebra position
   ```solidity
   function executeInvestment(
       address user,
       address poolId,
       address baseAsset,
       uint256 amount,
       int24 tickLower,
       int24 tickUpper,
       bytes32 assetHubPositionId
   ) external onlyOperator
   ```
   
   - Loads data from `pendingPosition`
   - Calls Algebra NFPM to mint NFT position
   - Stores NFT ID in `userPositions[user]`
   - Stores position details
   - **Deletes** `pendingPosition` (one-time use)

3. **`liquidatePosition()`** - Closes position and swaps to ETH
   ```solidity
   function liquidatePosition(
       address user,
       uint256 nftId,
       uint256 amountOutMinimum,
       bytes32 assetHubPositionId
   ) external onlyOperator
   ```
   
   - Burns Algebra NFT position
   - Collects liquidity + fees
   - Swaps tokens to ETH via Algebra router
   - **IF testMode = true**: Skips XCM send
   - **IF testMode = false**: Sends proceeds to AssetHub via XCM
   - Emits `PositionLiquidated` with proceeds amount

**Current State:**
- trustedXcmCaller: **NOT YET SET** ❌
- Must call `setTrustedXcmCaller(assetHubAddress)`

---

## 🧪 Test Mode Deep Dive

### What Test Mode Does

**AssetHubVault (line 327):**
```solidity
if (!testMode) {
    // Send XCM message to target chain
    XCM_PRECOMPILE.call{value: xcmFeeAmount}(
        abi.encodeWithSignature("send(bytes,bytes)", xcmDestination, xcmMessage)
    );
}
// If test mode: Skip XCM, just emit event
```

**XCMProxy (line 597):**
```solidity
if (!testMode) {
    // Send XCM message back to AssetHub
    XCM_PRECOMPILE.call{value: xcmFeeAmount}(
        abi.encodeWithSignature("send(bytes,bytes)", assetHub, message)
    );
}
// If test mode: Skip XCM return, emit event only
```

**XCMProxy Access Control (line 375):**
```solidity
require(
    testMode ||                              // Allow any caller in test mode
    msg.sender == owner() ||                 // Owner always allowed
    (trustedXcmCaller != address(0) &&       
     msg.sender == trustedXcmCaller),        // AssetHub allowed
    "Not authorized"
);
```

### Why Test Mode is Critical

1. **Prevents Actual XCM Calls**
   - XCM requires proper channel setup
   - XCM costs gas/fees on both chains
   - XCM can fail if misconfigured

2. **Enables Manual Testing**
   - Can call functions directly without XCM
   - Can test cross-chain logic locally
   - Can verify state changes independently

3. **Safe for Testnet**
   - No risk of failed XCM messages
   - No risk of losing funds in XCM
   - Full control over execution flow

---

## 🎯 Testing Strategy Explained

### Why This Approach?

You asked for testing on **real chains** with **test mode** and **settlement guided by tests, not XCM**. Here's why this is the right approach:

#### Problem: Contracts Deployed, XCM Not Ready
- ✅ AssetHub deployed on Paseo
- ✅ XCMProxy deployed on Moonbase
- ❌ XCM channel not configured
- ❌ XCM precompiles not finalized
- ❌ Cross-chain routing uncertain

#### Solution: Test Mode + Manual Settlement
- ✅ Test on real chains (not mocks)
- ✅ Test with real Hardhat connection
- ✅ Skip actual XCM (test mode enabled)
- ✅ Manually call cross-chain functions
- ✅ Verify complete logic flow

### Testing Layers

#### Layer 1: Configuration Validation (Read-Only)
**Purpose**: Ensure deployments are correct

**Tests:**
- `test/AssetHubVault/testnet/1.config-check.test.js` - AssetHub config
- `scripts/verify-xcmproxy-config.js` - XCMProxy config

**What it verifies:**
- Roles configured (admin, operator, owner)
- Test mode enabled
- Contract not paused
- Algebra integrations set
- XCM precompiles (if any)

**Safety:** 100% read-only, zero risk

#### Layer 2: Basic Functionality (Small Amounts)
**Purpose**: Test core contract operations

**Tests:**
- `test/AssetHubVault/testnet/2.deposits.test.js` - Deposits/withdrawals

**What it tests:**
- Users can deposit (0.01-0.5 ETH)
- Balance tracking works
- Users can withdraw
- Multi-user operations

**Safety:** Uses small amounts, works with persistent state

#### Layer 3: Mock Integration (Local Network)
**Purpose**: Verify complete cross-chain logic WITHOUT XCM

**Tests:**
- `test/Integration/mock-xcm/1.mock-investment-flow.test.js`
- `test/Integration/mock-xcm/2.mock-liquidation-flow.test.js`

**How it works:**
1. Deploy BOTH contracts on same local network
2. User deposits to AssetHub
3. Operator dispatches investment (test mode = no XCM)
4. **Manually call** `executeInvestment` on XCMProxy
   - Simulates XCM message arrival
   - Actually creates Algebra position
5. Operator liquidates position
6. **Manually call** `settleLiquidation` on AssetHub
   - Simulates XCM return message
   - Updates user balance

**Why this works:**
- Same logic as real XCM
- Tests all state changes
- Tests all validations
- Tests all calculations
- Just skips actual message sending

**Output:**
```
✅ User deposits
✅ Investment dispatched
✅ Manual executeInvestment call
✅ Position created in Algebra
✅ NFT minted
✅ Liquidation executed
✅ Manual settleLiquidation call
✅ User balance updated
✅ Position closed
```

#### Layer 4: Guided Testnet Flow (Real Chains)
**Purpose**: Test on real chains with manual cross-chain calls

**Tests:**
- `test/Integration/testnet/1.guided-investment-flow.test.js`

**How it works:**
Same as Layer 3, but:
- AssetHub calls on **Paseo** (real testnet)
- XCMProxy calls on **Moonbase** (real testnet)
- Manual network switching required
- Test provides exact commands for each step

**Step-by-step:**

1. **Deposit on Paseo** (automated)
   ```javascript
   await assetHubVault.deposit({ value: amount });
   ```

2. **Dispatch on Paseo** (automated)
   ```javascript
   await assetHubVault.dispatchInvestment(user, 1287, pool, weth, amount, -1, 1, xcmDest, xcmMsg);
   // Test mode = no XCM sent
   // Position created with PENDING status
   ```

3. **Execute on Moonbase** (MANUAL)
   ```bash
   # Switch to Moonbase
   npx hardhat console --network moonbase
   
   # Attach to XCMProxy
   const proxy = await ethers.getContractAt("XCMProxy", "0x...");
   
   # Execute investment (simulating XCM arrival)
   await proxy.executeInvestment(user, pool, weth, amount, -1, 1, positionId);
   # Creates Algebra NFT position
   ```

4. **Liquidate on Moonbase** (MANUAL)
   ```javascript
   await proxy.liquidatePosition(user, nftId, 0, positionId);
   // Burns NFT, swaps to ETH, gets proceeds
   ```

5. **Settle on Paseo** (MANUAL)
   ```bash
   # Switch back to Paseo
   npx hardhat console --network passethub
   
   # Settle liquidation (simulating XCM return)
   await assetHubVault.settleLiquidation(positionId, proceeds, true);
   # Updates user balance, closes position
   ```

**Why manual steps?**
- Contracts on different chains
- Test mode enabled (no automatic XCM)
- Allows inspection at each step
- Verifies state on both chains
- Educational - see exactly what happens

---

## 🔗 Contract Linking Requirements

Before testing cross-chain functionality, contracts MUST be linked:

### On AssetHub (Paseo):
```javascript
await assetHubVault.addChain(
  1287,                                        // Moonbase chainId
  "0x0001000100a10f041300c10f030400010300",    // XCM multilocation
  "Moonbase Alpha",                            // Name
  xcmProxyAddress                              // Proxy address
);
```

**What this does:**
- Adds Moonbase to `supportedChains` mapping
- Links chainId 1287 to XCMProxy address
- Stores XCM destination for message routing
- Enables `dispatchInvestment` to target Moonbase

### On XCMProxy (Moonbase):
```javascript
await xcmProxy.setTrustedXcmCaller(assetHubAddress);
```

**What this does:**
- Allows AssetHub to call `receiveAssets`
- Enables production mode (when test mode off)
- Links XCMProxy back to AssetHub

**Verification:**
```javascript
// On AssetHub
const chainInfo = await assetHubVault.supportedChains(1287);
console.log(chainInfo.active);        // true
console.log(chainInfo.proxyAddress);  // XCMProxy address

// On Moonbase
const caller = await xcmProxy.trustedXcmCaller();
console.log(caller);  // AssetHub address
```

---

## 📊 State Persistence & Idempotent Testing

### Why State Persists

**AssetHub deployed via Remix:**
- Cannot redeploy easily
- Contract at fixed address
- State accumulates across tests
- No "clean slate" per test

### How Tests Handle This

**Configuration Tests (read-only):**
```javascript
// Always safe - just reads state
const admin = await vault.admin();
const testMode = await vault.testMode();
```

**Deposit Tests (additive):**
```javascript
// Get balance BEFORE
const balanceBefore = await vault.getUserBalance(user);

// Perform action
await vault.deposit({ value: amount });

// Check RELATIVE change
const balanceAfter = await vault.getUserBalance(user);
expect(balanceAfter).to.equal(balanceBefore + amount);
// ✅ Works regardless of initial balance
```

**Investment Tests (conditional):**
```javascript
// Skip if user has insufficient balance
const balance = await vault.getUserBalance(user);
if (balance < investmentAmount) {
  console.log("Skipping - insufficient balance");
  this.skip();
}
```

**Idempotent Design:**
- Tests check relative changes, not absolute values
- Tests skip if preconditions not met
- Tests don't assume clean state
- Tests can run multiple times safely

---

## ⚠️ Critical Safety Checks

### Before Any Testing:

1. **Verify Test Mode Enabled**
   ```javascript
   const assetHubTestMode = await assetHubVault.testMode();
   const xcmProxyTestMode = await xcmProxy.testMode();
   
   if (!assetHubTestMode || !xcmProxyTestMode) {
     throw new Error("Enable test mode first!");
   }
   ```

2. **Verify Not Paused**
   ```javascript
   const assetHubPaused = await assetHubVault.paused();
   const xcmProxyPaused = await xcmProxy.paused();
   
   if (assetHubPaused || xcmProxyPaused) {
     throw new Error("Contracts are paused!");
   }
   ```

3. **Verify Correct Network**
   ```javascript
   const network = await ethers.provider.getNetwork();
   console.log("Current network:", network.chainId);
   
   // 420420422 = Paseo Asset Hub
   // 1287 = Moonbase Alpha
   ```

4. **Verify Sufficient Testnet Tokens**
   ```javascript
   const balance = await ethers.provider.getBalance(signer.address);
   console.log("Balance:", ethers.formatEther(balance), "ETH");
   
   if (balance < ethers.parseEther("1")) {
     console.log("⚠️  Low balance - get testnet tokens!");
   }
   ```

---

## 🎓 Learning from Tests

### What Each Test Teaches:

**Config Tests:**
- How to attach to deployed contract
- How to read contract state
- How to verify deployment
- How to check configuration

**Deposit Tests:**
- How to handle persistent state
- How to write idempotent tests
- How to use relative assertions
- How to test with multiple users

**Mock Integration Tests:**
- How cross-chain flow works
- How pending position pattern works
- How to simulate XCM manually
- How state links between chains
- Complete investment → liquidation cycle

**Guided Testnet Tests:**
- How to test on real chains
- How to switch networks
- How to manually execute cross-chain calls
- How to debug cross-chain state
- How to verify on both chains

---

## 📈 Success Metrics

### Configuration Phase ✅
- [ ] Can connect to both contracts
- [ ] All roles configured
- [ ] Test mode enabled
- [ ] Algebra integrations set
- [ ] Contracts not paused

### Linking Phase ✅
- [ ] Moonbase added to AssetHub registry
- [ ] AssetHub set as trusted caller on XCMProxy
- [ ] Can query chain info
- [ ] Configuration tests pass

### Basic Functionality Phase ✅
- [ ] Deposits work on AssetHub
- [ ] Withdrawals work on AssetHub
- [ ] Balance tracking accurate
- [ ] Multi-user operations work

### Local Integration Phase ✅
- [ ] Mock investment flow passes
- [ ] Mock liquidation flow passes
- [ ] Position created in Algebra
- [ ] Settlement updates balance
- [ ] Position lifecycle complete

### Testnet Integration Phase ✅
- [ ] Dispatch works on Paseo
- [ ] Execute works on Moonbase
- [ ] Position created on both chains
- [ ] Liquidation works on Moonbase
- [ ] Settlement works on Paseo
- [ ] User balance updates correctly
- [ ] Position closes properly

---

## 🚀 Production Readiness Path

### Current: Test Mode Enabled
```
AssetHub (Paseo)          Moonbase Alpha
     |                          |
     |  Manual function call    |
     |  (no XCM)               |
     └────────────────────────→
```

### Next: Test Mode Disabled, XCM Configured
```
AssetHub (Paseo)          Moonbase Alpha
     |                          |
     |  Real XCM message        |
     |  (automatic)             |
     └────────────────────────→
              XCM Channel
```

### Production: Mainnet Deployment
```
AssetHub (Mainnet)        Moonbeam (Mainnet)
     |                          |
     |  Production XCM          |
     |  (real funds)            |
     └────────────────────────→
           Production Channel
```

**Steps to Production:**
1. ✅ Test with test mode (current)
2. ⏳ Configure XCM properly
3. ⏳ Disable test mode
4. ⏳ Test real XCM on testnet
5. ⏳ Security audit
6. ⏳ Deploy to mainnet
7. ⏳ Enable production

---

## 📚 Key Takeaways

1. **Test Mode is Your Friend**
   - Allows testing without XCM
   - Prevents configuration errors
   - Enables manual verification
   - Safe for learning

2. **Contracts Are Separated by Design**
   - AssetHub = custody layer
   - XCMProxy = execution layer
   - Clear separation of concerns
   - Can expand to multiple chains

3. **Testing Mirrors Production**
   - Same contracts
   - Same logic
   - Same state changes
   - Only XCM is simulated

4. **Manual Steps Are Educational**
   - See exactly what happens
   - Understand state changes
   - Debug issues easily
   - Learn cross-chain mechanics

5. **State Persistence Requires Care**
   - Tests must be idempotent
   - Use relative assertions
   - Handle existing state
   - Don't assume clean slate

---

## 🎯 Immediate Next Steps

1. **Run Config Checks** (5 min)
   ```bash
   npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub
   npx hardhat run scripts/verify-xcmproxy-config.js --network moonbase
   ```

2. **Link Contracts** (10 min)
   ```bash
   npx hardhat run scripts/link-contracts.js --network passethub
   npx hardhat run scripts/link-contracts.js --network moonbase
   ```

3. **Test Deposits** (5 min)
   ```bash
   npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub
   ```

4. **Test Mock Integration** (15 min)
   ```bash
   npx hardhat test test/Integration/mock-xcm/1.mock-investment-flow.test.js
   npx hardhat test test/Integration/mock-xcm/2.mock-liquidation-flow.test.js
   ```

5. **Test Guided Flow** (30 min)
   ```bash
   npx hardhat test test/Integration/testnet/1.guided-investment-flow.test.js --network passethub
   ```

**Total: ~1 hour for complete verification**

You now have a **deep, rigorous understanding** of:
- How contracts work
- How they're deployed
- How test mode works
- How to test without XCM
- How to verify everything
- How to progress to production

Good luck! 🚀

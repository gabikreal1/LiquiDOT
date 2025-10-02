# AssetHubVault Testnet Testing Guide

## 🎯 Testing Constraints

**Your Setup:**
- ✅ AssetHubVault deployed on Asset Hub testnet (via Remix)
- ✅ Single contract instance (cannot redeploy)
- ✅ No XCM connection to Moonbase yet
- ✅ State persists across all tests
- ✅ Need to test on real network only

**What This Means:**
- ❌ Cannot deploy fresh contract for each test
- ❌ Cannot reset state between tests
- ❌ Cannot test XCM-dependent features yet
- ✅ Must design tests to work with shared state
- ✅ Tests must be idempotent (safe to run multiple times)
- ✅ Focus on state-independent behavior

## 📋 What Can Be Tested

### ✅ CAN Test (Safe for Testnet)

#### 1. **Configuration Checks** (Read-Only)
```javascript
it("should have correct admin", async function() {
  const admin = await vault.admin();
  expect(admin).to.be.properAddress;
});

it("should have XCM precompile set", async function() {
  const precompile = await vault.XCM_PRECOMPILE();
  expect(precompile).to.not.equal(ethers.ZeroAddress);
});
```

#### 2. **Deposit Behavior** (Additive, Safe)
```javascript
it("should accept deposits", async function() {
  const balanceBefore = await vault.getUserBalance(user1.address);
  const depositAmount = ethers.parseEther("1");
  
  await vault.connect(user1).deposit({ value: depositAmount });
  
  const balanceAfter = await vault.getUserBalance(user1.address);
  expect(balanceAfter).to.equal(balanceBefore + depositAmount);
});
```

#### 3. **Event Emission**
```javascript
it("should emit Deposit event", async function() {
  const amount = ethers.parseEther("1");
  
  await expect(
    vault.connect(user1).deposit({ value: amount })
  ).to.emit(vault, "Deposit");
});
```

#### 4. **Validation/Reverts** (No State Change)
```javascript
it("should revert on zero deposit", async function() {
  await expect(
    vault.connect(user1).deposit({ value: 0 })
  ).to.be.revertedWithCustomError(vault, "AmountZero");
});
```

#### 5. **View Functions** (Read-Only)
```javascript
it("should return user balance", async function() {
  const balance = await vault.getUserBalance(user1.address);
  expect(balance).to.be.gte(0); // Just check it returns something
});
```

### ❌ CANNOT Test (Until XCM Connected)

```javascript
// ❌ These require XCM connection
- dispatchInvestment with actual XCM sending
- settleLiquidation from Moonbase
- Cross-chain position tracking
```

### ⚠️ CAREFUL (May Affect State)

```javascript
// ⚠️ These modify state - use carefully
- Creating positions (uses up user balance)
- Emergency liquidation (marks positions inactive)
- Admin configuration changes (affects all users)
```

## 🔧 Test Structure for Testnet

### Setup Pattern
```javascript
describe("AssetHubVault - Testnet Tests", function() {
  let vault, signers;
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;

  before(async function() {
    if (!VAULT_ADDRESS) {
      throw new Error("Set ASSETHUB_CONTRACT environment variable");
    }

    signers = await ethers.getSigners();
    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    vault = AssetHubVault.attach(VAULT_ADDRESS);

    // Verify connection
    await vault.admin();
    console.log("✓ Connected to vault at", VAULT_ADDRESS);
  });

  // Tests here...
});
```

### Test Categories

#### Category 1: Read-Only Tests (100% Safe)
```javascript
describe("Configuration (Read-Only)", function() {
  it("should have correct roles configured", async function() {
    const admin = await vault.admin();
    const operator = await vault.operator();
    const emergency = await vault.emergency();
    
    expect(admin).to.be.properAddress;
    expect(operator).to.be.properAddress;
    expect(emergency).to.be.properAddress;
  });

  it("should have test mode enabled", async function() {
    const testMode = await vault.testMode();
    expect(testMode).to.be.true;
  });

  it("should not be paused", async function() {
    const paused = await vault.paused();
    expect(paused).to.be.false;
  });
});
```

#### Category 2: Deposit Tests (Safe, Additive)
```javascript
describe("Deposits (Additive State)", function() {
  it("should accept small test deposit", async function() {
    const [user] = await ethers.getSigners();
    const balanceBefore = await vault.getUserBalance(user.address);
    const depositAmount = ethers.parseEther("0.1"); // Small amount
    
    await vault.connect(user).deposit({ value: depositAmount });
    
    const balanceAfter = await vault.getUserBalance(user.address);
    expect(balanceAfter).to.equal(balanceBefore + depositAmount);
  });

  it("should emit Deposit event", async function() {
    const [user] = await ethers.getSigners();
    const amount = ethers.parseEther("0.01");
    
    await expect(
      vault.connect(user).deposit({ value: amount })
    ).to.emit(vault, "Deposit").withArgs(user.address, amount);
  });

  it("should revert on zero deposit", async function() {
    const [user] = await ethers.getSigners();
    
    await expect(
      vault.connect(user).deposit({ value: 0 })
    ).to.be.revertedWithCustomError(vault, "AmountZero");
  });
});
```

#### Category 3: Withdrawal Tests (Carefully)
```javascript
describe("Withdrawals (Conditional)", function() {
  it("should allow withdrawal if user has balance", async function() {
    const [user] = await ethers.getSigners();
    const balance = await vault.getUserBalance(user.address);
    
    if (balance > 0) {
      const withdrawAmount = ethers.parseEther("0.01");
      
      if (balance >= withdrawAmount) {
        await vault.connect(user).withdraw(withdrawAmount);
        
        const newBalance = await vault.getUserBalance(user.address);
        expect(newBalance).to.equal(balance - withdrawAmount);
      } else {
        console.log("⚠️ User balance too low for withdrawal test");
        this.skip();
      }
    } else {
      console.log("⚠️ User has no balance, skipping withdrawal test");
      this.skip();
    }
  });

  it("should revert on insufficient balance", async function() {
    const [user] = await ethers.getSigners();
    const balance = await vault.getUserBalance(user.address);
    const tooMuch = balance + ethers.parseEther("1000");
    
    await expect(
      vault.connect(user).withdraw(tooMuch)
    ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
  });
});
```

#### Category 4: Position Tests (Read-Only First)
```javascript
describe("Positions (Test Mode)", function() {
  it("should skip XCM call in test mode", async function() {
    const testMode = await vault.testMode();
    expect(testMode).to.be.true; // Must be true for safe testing
  });

  it("should create position without XCM (if you have permissions)", async function() {
    // Only run if you control the operator
    const [deployer] = await ethers.getSigners();
    const operator = await vault.operator();
    
    if (operator.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("⚠️ Not operator, skipping position creation test");
      this.skip();
    }
    
    // Ensure user has balance
    const user = deployer;
    const userBalance = await vault.getUserBalance(user.address);
    
    if (userBalance < ethers.parseEther("1")) {
      // Deposit first
      await vault.connect(user).deposit({ value: ethers.parseEther("1") });
    }
    
    const balanceBefore = await vault.getUserBalance(user.address);
    const investAmount = ethers.parseEther("0.5");
    
    // Create position in test mode (skips XCM)
    await vault.connect(user).dispatchInvestment(
      user.address,
      2004,
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      investAmount,
      -5,
      5,
      "0x030100001234",
      "0x0300010203"
    );
    
    const balanceAfter = await vault.getUserBalance(user.address);
    expect(balanceAfter).to.equal(balanceBefore - investAmount);
  });
});
```

## 🎯 Recommended Test Execution Order

### Phase 1: Safe Read-Only Tests
```bash
# Check configuration
npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js
```

### Phase 2: Non-Destructive Tests  
```bash
# Test deposits (adds to state, but safe)
npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js

# Test validation/reverts (no state change)
npx hardhat test test/AssetHubVault/testnet/3.validation.test.js
```

### Phase 3: Conditional Tests
```bash
# Only if you have operator permissions
npx hardhat test test/AssetHubVault/testnet/4.positions-testmode.test.js
```

## 💡 Best Practices

### 1. **Always Check State First**
```javascript
const balance = await vault.getUserBalance(user.address);
if (balance < requiredAmount) {
  console.log("⚠️ Insufficient balance, skipping test");
  this.skip();
}
```

### 2. **Use Small Test Amounts**
```javascript
// Use 0.01 or 0.1 instead of 10 or 100
const testAmount = ethers.parseEther("0.01");
```

### 3. **Make Tests Idempotent**
```javascript
// BAD: Assumes exact balance
expect(balance).to.equal(0);

// GOOD: Tests behavior
const balanceBefore = await vault.getUserBalance(user);
await vault.deposit({ value: amount });
const balanceAfter = await vault.getUserBalance(user);
expect(balanceAfter).to.equal(balanceBefore + amount);
```

### 4. **Skip Tests When Needed**
```javascript
if (!hasPermission) {
  console.log("⚠️ Skipping test: insufficient permissions");
  this.skip();
}
```

### 5. **Document State Requirements**
```javascript
/**
 * REQUIREMENTS:
 * - Operator must be test account
 * - Test mode must be enabled
 * - User must have at least 1 ETH balance
 */
it("should create position", async function() {
  // Check requirements
  // ...
});
```

## 🚨 Critical Warnings

### DO NOT Run These on Testnet (Yet)
```javascript
// ❌ Don't test these until XCM is connected:
- settleLiquidation (requires real XCM return)
- Cross-chain position verification
- XCM message validation

// ❌ Don't test these if you're not admin:
- pause/unpause
- role changes
- XCM precompile changes
```

### Safe to Run Anytime
```javascript
// ✅ Always safe:
- View function calls
- Revert/validation tests (no state change)
- Event emission checks
- Small deposits (additive)
```

## 📊 Example Test Suite Structure

```
test/AssetHubVault/testnet/
├── 1.config-check.test.js       # Read-only configuration
├── 2.deposits.test.js            # Deposit behavior (safe)
├── 3.validation.test.js          # Reverts/errors (safe)
├── 4.views.test.js               # View functions (safe)
├── 5.positions-testmode.test.js  # Positions without XCM
└── README.md                     # This file
```

## 🎓 Summary

**Key Point:** You have ONE contract, ONE state, NO resets.

**Strategy:**
1. Test configuration and view functions (safe)
2. Test deposits with small amounts (additive, safe)
3. Test validation/reverts (no state change)
4. Skip XCM-dependent tests until connected
5. Make all tests idempotent
6. Check state before modifying tests

**Remember:** Each test affects the contract for ALL future tests!


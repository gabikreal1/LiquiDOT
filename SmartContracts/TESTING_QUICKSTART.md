# LiquiDOT Testing - Quick Start

## ⚡ Run Tests Immediately

### 1. Set AssetHubVault Address (Required)

```powershell
# Windows PowerShell (you're using this)
$env:ASSETHUB_CONTRACT="0x84bc73388D2346B450a03041D27881d87a8F2314"
```

### 2. Run Your First Test

```bash
# Run the deployment test
npx hardhat test test/AssetHubVault.deployment.test.js
```

### 3. Run the Integration Example

```bash
# Run the full environment example
npx hardhat test test/EXAMPLE_USING_TEST_ENVIRONMENT.test.js
```

## 📝 What We Created

### ✅ Test Environment Setup (`test/setup/`)
- `deploy-algebra-suite.js` - Deploys Algebra DEX (production contracts)
- `deploy-xcm-proxy.js` - Deploys and configures XCMProxy
- `deploy-test-contracts.js` - Deploys test tokens, connects to your AssetHubVault
- `test-environment.js` - **Main orchestrator** (use this in integration tests!)

### ✅ Example Tests
- `AssetHubVault.deployment.test.js` - **Unit test example** (TEST-AHV-001, TEST-AHV-002)
- `EXAMPLE_USING_TEST_ENVIRONMENT.test.js` - **Integration test example**

### ✅ Documentation
- `TESTING_GUIDE.md` - Comprehensive testing guide
- `TESTING_QUICKSTART.md` - This file!

## 🎯 Your Next Steps

### Step 1: Run Existing Tests ✅

```bash
# Make sure the deployment test passes
npx hardhat test test/AssetHubVault.deployment.test.js

# Expected output:
#   AssetHubVault - Deployment & Initialization
#     TEST-AHV-001: Deployment
#       ✓ should deploy successfully
#       ✓ should set admin to deployer
#       ... (8 tests passing)
```

### Step 2: Create Access Control Tests

Create `test/AssetHubVault.access.test.js`:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Access Control", function () {
  let assetHubVault, deployer, user1;

  beforeEach(async function () {
    [deployer, user1] = await ethers.getSigners();
    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();
  });

  describe("TEST-AHV-003: Admin-only functions", function () {
    it("should revert setXcmPrecompile if not admin", async function () {
      await expect(
        assetHubVault.connect(user1).setXcmPrecompile(ethers.ZeroAddress)
      ).to.be.revertedWith("Only admin");
    });

    it("should allow admin to call setXcmPrecompile", async function () {
      const precompile = "0x0000000000000000000000000000000000000808";
      await expect(
        assetHubVault.setXcmPrecompile(precompile)
      ).to.not.be.reverted;
    });
  });
});
```

Then run:
```bash
npx hardhat test test/AssetHubVault.access.test.js
```

### Step 3: Continue Per TESTING-REQUIREMENTS.md

Follow the checklist in TESTING-REQUIREMENTS.md:

- [ ] TEST-AHV-003 to 006: Access control
- [ ] TEST-AHV-007 to 015: Deposit & withdrawal
- [ ] TEST-AHV-016 to 023: Investment dispatch
- [ ] TEST-AHV-024 to 028: Liquidation
- [ ] ... etc

## 🔑 Key Concepts

### Unit Tests (Single Contract)
**Use for:** Testing AssetHubVault in isolation

```javascript
beforeEach(async function () {
  // Deploy fresh contract for each test
  const AssetHubVault = await ethers.getContractFactory(...);
  assetHubVault = await AssetHubVault.deploy();
});
```

### Integration Tests (Full Stack)
**Use for:** Testing XCMProxy + Algebra, cross-contract interactions

```javascript
before(async function () {
  // Setup complete environment once
  env = await setupTestEnvironment({ ... });
});

it("test", async function () {
  // Use env.xcmProxy, env.algebraRouter, etc.
});
```

## 📊 Test Coverage

Check your progress:

```bash
# Run all tests
npx hardhat test

# Generate coverage report
npx hardhat coverage

# Goal: ≥80% line coverage
```

## 🐛 Troubleshooting

### "AssetHubVault address not provided"
```powershell
$env:ASSETHUB_CONTRACT="0xYourAddress"
```

### "Timeout of 40000ms exceeded"
```javascript
this.timeout(60000); // Increase timeout
```

### Can't find contract
```javascript
// Use full path:
const AssetHubVault = await ethers.getContractFactory(
  "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
);
```

## 🚀 Useful Commands

```bash
# Run all tests
npx hardhat test

# Run specific file
npx hardhat test test/AssetHubVault.deployment.test.js

# Run tests matching pattern
npx hardhat test --grep "deployment"

# Show console.log output
npx hardhat test --logs

# Generate coverage
npx hardhat coverage

# Compile contracts
npx hardhat compile
```

## 📁 File Structure

```
SmartContracts/
├── test/
│   ├── setup/                                # Test environment modules
│   │   ├── deploy-algebra-suite.js          # ← Algebra DEX deployment
│   │   ├── deploy-xcm-proxy.js              # ← XCMProxy deployment
│   │   ├── deploy-test-contracts.js         # ← Test helpers
│   │   └── test-environment.js              # ← USE THIS for integration!
│   │
│   ├── AssetHubVault.deployment.test.js     # ← START HERE (done!)
│   ├── AssetHubVault.access.test.js         # ← CREATE THIS NEXT
│   ├── AssetHubVault.deposit.test.js        # ← Then this
│   └── EXAMPLE_USING_TEST_ENVIRONMENT.test.js
│
├── TESTING_REQUIREMENTS.md                   # Full test spec
├── TESTING_GUIDE.md                          # Detailed guide
└── TESTING_QUICKSTART.md                     # This file!
```

## ✅ Success Criteria

Your test is working when you see:

```
  AssetHubVault - Deployment & Initialization
    TEST-AHV-001: Deployment
      ✓ should deploy successfully (100ms)
      ✓ should set admin to deployer
      ✓ should set operator to deployer
      ... 
    TEST-AHV-002: Initial State
      ✓ should have zero balance for any user
      ✓ should have no positions for any user
      ...

  11 passing (2s)
```

## 🎓 Learn More

- **Full Guide:** `TESTING_GUIDE.md`
- **Requirements:** `TESTING-REQUIREMENTS.md`
- **Examples:** `test/AssetHubVault.deployment.test.js` and `test/EXAMPLE_USING_TEST_ENVIRONMENT.test.js`

---

**You're ready to start testing!** 🚀

Begin with:
```bash
npx hardhat test test/AssetHubVault.deployment.test.js
```


# LiquiDOT Testing Guide

This guide shows you how to run the test environment and write tests according to the TESTING-REQUIREMENTS.md.

## 🚀 Quick Start

### 1. Set Environment Variables

Before running tests, you need to set the AssetHubVault address:

```bash
# Windows PowerShell
$env:ASSETHUB_CONTRACT="0xYourAssetHubVaultAddress"

# Windows CMD
set ASSETHUB_CONTRACT=0xYourAssetHubVaultAddress

# Linux/Mac
export ASSETHUB_CONTRACT=0xYourAssetHubVaultAddress
```

If you don't have a deployed AssetHubVault yet, you can deploy one locally or use a test address.

### 2. Run Individual Tests

```bash
# Run a specific test file
npx hardhat test test/AssetHubVault.deployment.test.js

# Run the example test
npx hardhat test test/EXAMPLE_USING_TEST_ENVIRONMENT.test.js

# Run all tests
npx hardhat test

# Run with verbose output
npx hardhat test --verbose
```

### 3. Run Tests with Coverage

```bash
npx hardhat coverage
```

## 📁 Test File Organization

```
SmartContracts/test/
├── setup/                              # Test environment setup modules
│   ├── deploy-algebra-suite.js       # Deploys Algebra DEX
│   ├── deploy-xcm-proxy.js           # Deploys & configures XCMProxy
│   ├── deploy-test-contracts.js      # Deploys test tokens, connects to vault
│   └── test-environment.js           # Main orchestrator (use this!)
│
├── AssetHubVault.deployment.test.js   # TEST-AHV-001, TEST-AHV-002
├── AssetHubVault.access.test.js       # TEST-AHV-003 to TEST-AHV-006
├── AssetHubVault.deposit.test.js      # TEST-AHV-007 to TEST-AHV-015
├── AssetHubVault.investment.test.js   # TEST-AHV-016 to TEST-AHV-023
├── ... (more test files per requirement)
│
└── EXAMPLE_USING_TEST_ENVIRONMENT.test.js  # Example integration test
```

## 📝 Writing Tests

### Approach 1: Unit Tests (Single Contract)

For testing a single contract in isolation, deploy fresh in each test:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Your Feature", function () {
  let assetHubVault;
  let deployer, user1;

  beforeEach(async function () {
    [deployer, user1] = await ethers.getSigners();
    
    // Deploy fresh contract for each test
    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();
  });

  it("should do something", async function () {
    // Your test here
  });
});
```

**Use this for:**
- AssetHubVault unit tests (most TEST-AHV-* tests)
- Testing deployment
- Testing access control
- Testing individual functions

### Approach 2: Integration Tests (Full Stack)

For testing cross-contract interactions, use the test environment:

```javascript
const { expect } = require("chai");
const { setupTestEnvironment } = require("./setup/test-environment");

describe("Integration Test", function () {
  let env;
  
  this.timeout(60000); // Environment setup takes time

  before(async function () {
    env = await setupTestEnvironment({
      tokenCount: 2,
      liquidityAmount: "1000",
      testMode: true,
      verbose: true,
    });
  });

  it("should do cross-contract interaction", async function () {
    // Use env.xcmProxy, env.assetHubVault, env.token0, etc.
  });
});
```

**Use this for:**
- XCMProxy tests that need Algebra DEX (TEST-XP-018, TEST-XP-020, etc.)
- Integration tests (TEST-INT-001 to TEST-INT-006)
- Testing swap functionality
- Testing full liquidation flow

## 📋 Test Checklist (from TESTING-REQUIREMENTS.md)

### Phase 1: AssetHubVault Tests (Start Here!)

- [x] **TEST-AHV-001**: Deployment ✅ (AssetHubVault.deployment.test.js created)
- [x] **TEST-AHV-002**: Initial state ✅ (AssetHubVault.deployment.test.js created)
- [ ] **TEST-AHV-003 to TEST-AHV-006**: Access control
- [ ] **TEST-AHV-007 to TEST-AHV-015**: Deposit & withdrawal
- [ ] **TEST-AHV-016 to TEST-AHV-023**: Investment dispatch
- [ ] **TEST-AHV-024 to TEST-AHV-028**: Liquidation settlement
- [ ] **TEST-AHV-029 to TEST-AHV-033**: Emergency functions
- [ ] **TEST-AHV-034 to TEST-AHV-037**: Configuration
- [ ] **TEST-AHV-038 to TEST-AHV-041**: View functions
- [ ] **TEST-AHV-042 to TEST-AHV-047**: Security & edge cases

### Phase 2: XCMProxy Tests

- [ ] **TEST-XP-001 to TEST-XP-002**: Deployment
- [ ] **TEST-XP-003 to TEST-XP-006**: Access control
- [ ] **TEST-XP-007 to TEST-XP-012**: Configuration
- [ ] **TEST-XP-013 to TEST-XP-017**: Asset reception
- [ ] **TEST-XP-018 to TEST-XP-023**: Investment execution
- [ ] ... (continue per TESTING-REQUIREMENTS.md)

### Phase 3: Integration Tests

- [ ] **TEST-INT-001 to TEST-INT-006**: Full flow tests

## 🎯 Next Steps

### Create Your Next Test File

Following the pattern in `AssetHubVault.deployment.test.js`, create:

```bash
# Create access control tests
test/AssetHubVault.access.test.js
```

Template:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetHubVault - Access Control", function () {
  let assetHubVault;
  let deployer, user1, operator;

  beforeEach(async function () {
    [deployer, user1, operator] = await ethers.getSigners();
    
    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();
  });

  /**
   * TEST-AHV-003: Only admin can call admin functions
   */
  describe("TEST-AHV-003: Admin-only functions", function () {
    it("should revert setXcmPrecompile if not admin", async function () {
      await expect(
        assetHubVault.connect(user1).setXcmPrecompile(ethers.ZeroAddress)
      ).to.be.revertedWith("Only admin");
    });

    it("should allow admin to call setXcmPrecompile", async function () {
      await expect(
        assetHubVault.connect(deployer).setXcmPrecompile("0x0000000000000000000000000000000000000808")
      ).to.not.be.reverted;
    });

    // Add more admin function tests...
  });

  // Continue with TEST-AHV-004, TEST-AHV-005, etc.
});
```

## 🔧 Debugging Tips

### View Test Output

```bash
# Run with console.log visible
npx hardhat test --logs

# Run single test
npx hardhat test test/YourTest.test.js

# Run tests matching pattern
npx hardhat test --grep "deployment"
```

### Check Contract Deployment

```javascript
it("debug: show contract address", async function () {
  const address = await assetHubVault.getAddress();
  console.log("AssetHubVault deployed at:", address);
});
```

### Verify Environment Setup

```bash
# Run the example test to verify setup works
npx hardhat test test/EXAMPLE_USING_TEST_ENVIRONMENT.test.js
```

## 📊 Coverage Goals

Per TESTING-REQUIREMENTS.md:
- **Overall Line Coverage:** ≥ 80%
- **Critical Functions:** ≥ 90%
- **Branch Coverage:** ≥ 75%
- **Function Coverage:** 100%

Check coverage:

```bash
npx hardhat coverage
```

## 🎓 Example Test Patterns

### Testing Events

```javascript
it("should emit Deposit event", async function () {
  await expect(
    assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") })
  )
    .to.emit(assetHubVault, "Deposit")
    .withArgs(user1.address, ethers.parseEther("10"));
});
```

### Testing Reverts

```javascript
it("should revert with AmountZero", async function () {
  await expect(
    assetHubVault.connect(user1).deposit({ value: 0 })
  ).to.be.revertedWithCustomError(assetHubVault, "AmountZero");
});
```

### Testing State Changes

```javascript
it("should update user balance", async function () {
  const balanceBefore = await assetHubVault.getUserBalance(user1.address);
  
  await assetHubVault.connect(user1).deposit({ value: ethers.parseEther("10") });
  
  const balanceAfter = await assetHubVault.getUserBalance(user1.address);
  expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("10"));
});
```

## 🚨 Common Issues

### Issue: "AssetHubVault address not provided"

**Solution:** Set the `ASSETHUB_CONTRACT` environment variable

```bash
$env:ASSETHUB_CONTRACT="0xYourAddress"  # PowerShell
```

### Issue: Test timeout

**Solution:** Increase timeout for environment setup

```javascript
this.timeout(60000); // 60 seconds
```

### Issue: Can't find contract

**Solution:** Use full path in getContractFactory

```javascript
const AssetHubVault = await ethers.getContractFactory(
  "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
);
```

## 📚 Resources

- `TESTING-REQUIREMENTS.md` - Full test specification
- `test/EXAMPLE_USING_TEST_ENVIRONMENT.test.js` - Integration test example
- `test/AssetHubVault.deployment.test.js` - Unit test example
- `test/setup/test-environment.js` - Environment setup source

## ✅ Recommended Testing Order

1. ✅ **Start with AssetHubVault deployment tests** (done!)
2. **Write AssetHubVault access control tests** (TEST-AHV-003 to 006)
3. **Write AssetHubVault deposit/withdrawal tests** (TEST-AHV-007 to 015)
4. **Write AssetHubVault investment tests** (TEST-AHV-016 to 023)
5. **Move to XCMProxy tests** (requires Algebra integration)
6. **Write integration tests** (full flow)
7. **Add fuzz tests with Foundry** (advanced)

Good luck! Start with `test/AssetHubVault.access.test.js` next! 🚀


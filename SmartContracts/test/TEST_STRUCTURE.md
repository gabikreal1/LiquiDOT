# Test Directory Structure

This document describes the organized test structure for LiquiDOT smart contracts.

## 📁 Directory Organization

```
SmartContracts/test/
├── AssetHubVault/              # All AssetHubVault contract tests
│   ├── 1.deployment.test.js    # TEST-AHV-001, 002: Deployment & initialization
│   ├── 2.access.test.js        # TEST-AHV-003 to 006: Access control
│   ├── 3.deposit.test.js       # TEST-AHV-007 to 015: Deposit & withdrawal
│   ├── 4.investment.test.js    # TEST-AHV-016 to 023: Investment dispatch
│   ├── 5.liquidation.test.js   # TEST-AHV-024 to 028: Liquidation settlement
│   ├── 6.emergency.test.js     # TEST-AHV-029 to 033: Emergency functions
│   ├── 7.config.test.js        # TEST-AHV-034 to 037: Configuration
│   ├── 8.views.test.js         # TEST-AHV-038 to 041: View functions
│   └── 9.security.test.js      # TEST-AHV-042 to 047: Security & edge cases
│
├── XCMProxy/                   # All XCMProxy contract tests
│   ├── 1.deployment.test.js    # TEST-XP-001, 002: Deployment & initialization
│   ├── 2.access.test.js        # TEST-XP-003 to 006: Access control
│   ├── 3.config.test.js        # TEST-XP-007 to 012: Token & configuration
│   ├── 4.receiveAssets.test.js # TEST-XP-013 to 017: Asset reception
│   ├── 5.investment.test.js    # TEST-XP-018 to 023: Investment execution
│   ├── 6.tickRange.test.js     # TEST-XP-024 to 027: Tick range calculation
│   ├── 7.monitoring.test.js    # TEST-XP-028 to 032: Position monitoring
│   ├── 8.liquidation.test.js   # TEST-XP-033 to 037: Liquidation
│   ├── 9.swapAndReturn.test.js # TEST-XP-038 to 046: Swap & return
│   ├── 10.returnAssets.test.js # TEST-XP-047 to 050: Return assets
│   ├── 11.swap.test.js         # TEST-XP-051 to 053: Swap helpers
│   └── 12.security.test.js     # TEST-XP-054 to 060: Security & edge cases
│
├── Integration/                # Cross-contract integration tests
│   ├── full-flow.test.js       # TEST-INT-001 to 004: Complete flows
│   ├── state-consistency.test.js # TEST-INT-005, 006: State sync
│   └── EXAMPLE_USING_TEST_ENVIRONMENT.test.js # Example integration test
│
├── setup/                      # Test environment setup modules
│   ├── deploy-algebra-suite.js     # Algebra DEX deployment
│   ├── deploy-xcm-proxy.js         # XCMProxy deployment
│   ├── deploy-test-contracts.js    # Test tokens & helpers
│   └── test-environment.js         # Main orchestrator (use in integration tests)
│
└── fixtures/                   # Test data and mock responses
    └── xcm-messages.json       # Pre-built XCM messages for testing
```

## 🎯 Test Categories

### AssetHubVault Tests (Unit Tests)
**Location:** `test/AssetHubVault/`  
**Total:** ~47 tests (TEST-AHV-001 to 047)  
**Approach:** Deploy fresh contract for each test file

**Coverage:**
- Deployment & initialization
- Access control (admin, operator, emergency)
- Deposit & withdrawal flows
- Investment dispatch
- Liquidation settlement
- Emergency functions
- Configuration management
- View functions
- Security & edge cases

### XCMProxy Tests (Integration Tests)
**Location:** `test/XCMProxy/`  
**Total:** ~60 tests (TEST-XP-001 to 060)  
**Approach:** Use `setupTestEnvironment()` from `test/setup/test-environment.js`

**Coverage:**
- Deployment & initialization
- Access control
- Token & configuration management
- Asset reception & validation
- Investment execution with Algebra
- Tick range calculations
- Position monitoring
- Liquidation flows
- Swap & return mechanics
- Security & reentrancy

### Integration Tests (Full Stack)
**Location:** `test/Integration/`  
**Total:** ~6+ tests (TEST-INT-001 to 006)  
**Approach:** Use complete test environment with all contracts

**Coverage:**
- Complete investment flow (Asset Hub → Moonbeam)
- Complete liquidation flow (Moonbeam → Asset Hub)
- Multi-user, multi-position scenarios
- Emergency liquidation flows
- Balance accounting consistency
- State synchronization between chains

## 📝 File Naming Convention

### Pattern
`{number}.{feature}.test.js`

- **Number:** Sequential order (1, 2, 3...)
- **Feature:** Descriptive name (deployment, access, deposit, etc.)
- **Extension:** `.test.js` for all test files

### Examples
- `1.deployment.test.js` - First test file, deployment tests
- `2.access.test.js` - Second test file, access control tests
- `3.deposit.test.js` - Third test file, deposit/withdrawal tests

## 🚀 Running Tests

### Run All Tests
```bash
npx hardhat test
```

### Run AssetHubVault Tests Only
```bash
npx hardhat test test/AssetHubVault/**/*.test.js
```

### Run XCMProxy Tests Only
```bash
npx hardhat test test/XCMProxy/**/*.test.js
```

### Run Integration Tests Only
```bash
npx hardhat test test/Integration/**/*.test.js
```

### Run Specific Test File
```bash
npx hardhat test test/AssetHubVault/1.deployment.test.js
```

### Run With Coverage
```bash
npx hardhat coverage
```

## 📋 Test Progress Tracking

### AssetHubVault (Unit Tests)
- [x] 1.deployment.test.js (TEST-AHV-001, 002) ✅
- [x] 2.access.test.js (TEST-AHV-003 to 006) ✅
- [x] 3.deposit.test.js (TEST-AHV-007 to 015) ✅
- [ ] 4.investment.test.js (TEST-AHV-016 to 023)
- [ ] 5.liquidation.test.js (TEST-AHV-024 to 028)
- [ ] 6.emergency.test.js (TEST-AHV-029 to 033)
- [ ] 7.config.test.js (TEST-AHV-034 to 037)
- [ ] 8.views.test.js (TEST-AHV-038 to 041)
- [ ] 9.security.test.js (TEST-AHV-042 to 047)

### XCMProxy (Integration Tests)
- [ ] 1.deployment.test.js (TEST-XP-001, 002)
- [ ] 2.access.test.js (TEST-XP-003 to 006)
- [ ] 3.config.test.js (TEST-XP-007 to 012)
- [ ] 4.receiveAssets.test.js (TEST-XP-013 to 017)
- [ ] 5.investment.test.js (TEST-XP-018 to 023)
- [ ] 6.tickRange.test.js (TEST-XP-024 to 027)
- [ ] 7.monitoring.test.js (TEST-XP-028 to 032)
- [ ] 8.liquidation.test.js (TEST-XP-033 to 037)
- [ ] 9.swapAndReturn.test.js (TEST-XP-038 to 046)
- [ ] 10.returnAssets.test.js (TEST-XP-047 to 050)
- [ ] 11.swap.test.js (TEST-XP-051 to 053)
- [ ] 12.security.test.js (TEST-XP-054 to 060)

### Integration
- [ ] full-flow.test.js (TEST-INT-001 to 004)
- [ ] state-consistency.test.js (TEST-INT-005, 006)

## 💡 Best Practices

### For Unit Tests (AssetHubVault)
```javascript
describe("AssetHubVault - Feature", function () {
  let assetHubVault, deployer, user1;

  beforeEach(async function () {
    [deployer, user1] = await ethers.getSigners();
    
    const AssetHubVault = await ethers.getContractFactory(
      "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
    );
    assetHubVault = await AssetHubVault.deploy();
    await assetHubVault.waitForDeployment();
  });

  it("should do something", async function () {
    // Test implementation
  });
});
```

### For Integration Tests (XCMProxy)
```javascript
const { setupTestEnvironment } = require("../setup/test-environment");

describe("XCMProxy - Feature", function () {
  let env;
  
  this.timeout(60000); // Longer timeout for setup

  before(async function () {
    env = await setupTestEnvironment({
      tokenCount: 2,
      liquidityAmount: "1000",
      testMode: true,
    });
  });

  it("should do something", async function () {
    // Use env.xcmProxy, env.algebraRouter, etc.
  });
});
```

## 📚 Related Documentation

- **TESTING-REQUIREMENTS.md** - Comprehensive test specifications
- **TESTING_GUIDE.md** - Detailed testing patterns and examples
- **TESTING_QUICKSTART.md** - Quick start guide

## ✅ Current Status

**Completed:**
- ✅ Test directory structure organized
- ✅ AssetHubVault deployment tests (TEST-AHV-001, 002)
- ✅ AssetHubVault access control tests (TEST-AHV-003 to 006)
- ✅ AssetHubVault deposit tests (TEST-AHV-007 to 015)
- ✅ Test environment setup modules
- ✅ Integration test example

**In Progress:**
- AssetHubVault investment tests (TEST-AHV-016 to 023)
- XCMProxy tests (TEST-XP series)

**Next Steps:**
1. Rename existing test files to follow naming convention
2. Continue implementing AssetHubVault tests
3. Begin XCMProxy test implementation
4. Implement integration tests


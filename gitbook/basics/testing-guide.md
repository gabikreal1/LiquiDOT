---
icon: vial
---

# Testing Guide

Comprehensive testing guide for LiquiDOT smart contracts, backend services, and integration flows.

## Overview

LiquiDOT uses multiple testing frameworks:
* **Hardhat** - Primary smart contract testing
* **Foundry** - Gas optimization and fuzzing
* **Jest** - Backend service testing
* **Cypress** - Frontend E2E testing (future)

## Quick Start

```bash
# Install dependencies
cd SmartContracts
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:coverage
```

## Smart Contract Testing

### Unit Tests

Test individual contract functions in isolation.

**Location:** `SmartContracts/test/unit/`

```bash
# Test Asset Hub Vault
npx hardhat test test/AssetHubVault/unit/**/*.test.js

# Test XCM Proxy
npx hardhat test test/XCMProxy/unit/**/*.test.js
```

**Example test:**
```javascript
describe("AssetHubVault - Deposits", function() {
  it("Should accept user deposits", async function() {
    const [owner, user] = await ethers.getSigners();
    
    // Deposit 100 DOT
    await vault.connect(user).deposit(
      ethers.parseUnits("100", 10),  // amount
      dotAddress                      // asset
    );
    
    // Verify balance
    const balance = await vault.getUserBalance(user.address, dotAddress);
    expect(balance).to.equal(ethers.parseUnits("100", 10));
  });
});
```

### Integration Tests

Test cross-contract interactions and full flows.

**Location:** `SmartContracts/test/Integration/`

```bash
npx hardhat test test/Integration/testnet/**/*.test.js --network passethub
```

**Example:**
```javascript
describe("Full Investment Flow", function() {
  it("Should complete deposit → invest → liquidate → return", async function() {
    // 1. Deposit to Asset Hub
    await assetHubVault.deposit(amount, dot);
    
    // 2. Trigger investment
    await assetHubVault.investInPool(
      1284,      // Moonbeam
      poolAddr,
      dot,
      [amount],
      -5,        // lower range
      10         // upper range
    );
    
    // 3. Verify position created on Moonbeam
    const position = await xcmProxy.getPosition(positionId);
    expect(position.liquidity).to.be.gt(0);
    
    // 4. Trigger liquidation
    await xcmProxy.executeFullLiquidation(positionId, 0);
    
    // 5. Verify assets returned
    const finalBalance = await assetHubVault.getUserBalance(user, dot);
    expect(finalBalance).to.be.closeTo(amount, tolerance);
  });
});
```

### Gas Testing

Measure and optimize gas consumption:

```bash
# Run with gas reporter
REPORT_GAS=true npx hardhat test
```

**Output:**
```
·-----------------------------------------|---------------------------|-------------|-----------------------------·
|  Solc version: 0.8.20                   ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 30000000 gas  │
··········································|···························|·············|······························
|  Methods                                                                                                         │
··························|·······················|·········|·········|·············|···············|··············
|  Contract               ·  Method               ·  Min    ·  Max    ·  Avg        ·  # calls      ·  usd (avg)  │
··························|·······················|·········|·········|·············|···············|··············
|  AssetHubVault          ·  deposit              ·  45123  ·  62341  ·  53732      ·  25           ·  $2.15      │
··························|·······················|·········|·········|·············|···············|··············
|  AssetHubVault          ·  investInPool         ·  210234 ·  245123 ·  227678     ·  15           ·  $9.11      │
··························|·······················|·········|·········|·············|···············|··············
```

### Fuzz Testing with Foundry

Test with randomized inputs:

```bash
forge test --match-test testFuzz
```

**Example:**
```solidity
function testFuzz_DepositAmounts(uint256 amount) public {
    // Bound amount to reasonable range
    amount = bound(amount, 1e10, 1e30);
    
    // Test deposit
    vm.prank(user);
    vault.deposit(amount, address(dot));
    
    // Verify
    assertEq(vault.getUserBalance(user, address(dot)), amount);
}
```

## Test Coverage

Generate coverage reports:

```bash
npx hardhat coverage
```

**Target coverage:**
* Overall: >90%
* Critical functions: 100%
* Edge cases: Well covered

**Coverage report:**
```
---------------------------|----------|----------|----------|----------|----------------|
File                       |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
---------------------------|----------|----------|----------|----------|----------------|
 contracts/                |      100 |    95.83 |      100 |      100 |                |
  AssetHubVault.sol        |      100 |    96.15 |      100 |      100 |                |
  XCMProxy.sol             |      100 |    95.45 |      100 |      100 |                |
---------------------------|----------|----------|----------|----------|----------------|
All files                  |      100 |    95.83 |      100 |      100 |                |
---------------------------|----------|----------|----------|----------|----------------|
```

## Backend Testing

### Service Tests

Test backend workers and services:

```bash
cd Backend
npm test
```

**Example:**
```javascript
describe('InvestmentDecisionWorker', () => {
  it('should find optimal pool based on user preferences', async () => {
    const userPrefs = {
      minAPY: 10,
      maxAllocation: 25,
      riskTolerance: 3,
      preferredAssets: ['DOT', 'USDC']
    };
    
    const optimalPool = await decisionWorker.findOptimalPool(userPrefs);
    
    expect(optimalPool.apy).toBeGreaterThanOrEqual(10);
    expect(optimalPool.pair).toContain('DOT' || 'USDC');
  });
});
```

### API Tests

Test backend API endpoints:

```bash
npm run test:api
```

## Testnet Testing

### Setup Testnet Environment

```bash
# Deploy contracts to testnets
npm run deploy:testnet

# Fund test accounts
npm run fund:testnet
```

### Run Testnet Tests

```bash
# Full testnet flow
npm run test:testnet

# Specific chain
npm run test:moonbase
npm run test:assethub
```

### Manual Testing

Test via frontend:

1. Connect to testnet
2. Deposit funds
3. Create position
4. Monitor liquidation
5. Verify final balance

## Load Testing (Future)

Simulate high load:

```bash
npm run load:test
```

**Scenarios:**
* 100 concurrent users
* 1000 positions
* Multiple liquidations
* Backend stress testing

## Security Testing

### Static Analysis

```bash
# Slither
slither contracts/

# Mythril
myth analyze contracts/AssetHubVault.sol

# Manticore (symbolic execution)
manticore contracts/XCMProxy.sol
```

### Security Checklist

- [ ] No reentrancy vulnerabilities
- [ ] Access control properly implemented
- [ ] No integer overflow/underflow
- [ ] XCM message validation
- [ ] Emergency pause functionality
- [ ] No unauthorized fund access

## CI/CD Testing

GitHub Actions runs tests on every commit:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Test Documentation

Each test file includes:
* **Purpose** - What is being tested
* **Setup** - Test environment configuration
* **Execution** - Test steps
* **Assertions** - Expected outcomes
* **Cleanup** - Teardown procedures

## Next Steps

* [Contract Deployment](contract-deployment.md) - Deploy and test live
* [Smart Contracts](smart-contracts.md) - Contract documentation
* [Architecture](architecture.md) - System design

*Detailed test commands available in `SmartContracts/test/.test-commands.md`*

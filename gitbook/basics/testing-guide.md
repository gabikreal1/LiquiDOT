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


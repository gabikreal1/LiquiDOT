---
icon: vial
---

# Testing Guide

Test LiquiDOT smart contracts and integration flows.

## Test Suites

Prior to testing ensure you install all necessary libraries

```bash
cd SmartContracts
npm install 
```

### Unit Tests

```bash
# Test Asset Hub Vault
npx hardhat test test/AssetHubVault/unit/**/*.test.js

# Test XCM Proxy
npx hardhat test test/XCMProxy/unit/**/*.test.js
```

### Integration Tests

```bash
# Full cross-chain flow
npx hardhat test test/Integration/**/*.test.js
```


## Test Structure

```javascript
describe("AssetHubVault - Deposits", function() {
  it("Should accept user deposits", async function() {
    const [owner, user] = await ethers.getSigners();
    
    await vault.connect(user).deposit(ethers.parseUnits("100", 10), dotAddress);
    
    const balance = await vault.getUserBalance(user.address, dotAddress);
    expect(balance).to.equal(ethers.parseUnits("100", 10));
  });
});
```

## Testing Frameworks

| Framework   | Purpose                    |
| ----------- | -------------------------- |
| **Hardhat** | Smart contract testing     |
| **Foundry** | Gas optimization & fuzzing |
| **Jest**    | Backend services           |

## Key Test Cases

**AssetHubVault:**

* ✓ Deposit/withdraw
* ✓ Investment dispatch
* ✓ Position confirmation
* ✓ Liquidation settlement

**XCMProxy:**

* ✓ Asset reception
* ✓ LP minting/burning
* ✓ Swap execution
* ✓ XCM returns

**Integration:**

* ✓ Full investment flow
* ✓ Liquidation flow
* ✓ Emergency scenarios

**Next:** [Contract Deployment](contract-deployment.md) • [Smart Contracts](smart-contracts.md)

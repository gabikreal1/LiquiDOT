# Foundry Tests for LiquiDOT Smart Contracts

This directory contains Foundry-based tests for the LiquiDOT smart contracts, providing comprehensive coverage of AssetHubVault and XCMProxy functionalities.

## 📁 Test Structure

```
test/foundry/
├── helpers/
│   └── TestSetup.sol          # Base test contract with common utilities
├── AssetHubVault.t.sol        # AssetHubVault contract tests (35+ tests)
├── XCMProxy.t.sol             # XCMProxy contract tests (25+ tests)
├── Integration.t.sol          # Integration tests across both contracts (10+ tests)
├── Emergency.t.sol            # Emergency procedure tests (15+ tests)
└── README.md                  # This file
```

## 🎯 Test Coverage

### AssetHubVault Tests (35 tests)
- ✅ Deployment and initialization
- ✅ Deposit functionality and events
- ✅ Withdrawal functionality and validations
- ✅ Investment dispatch and balance management
- ✅ Liquidation settlement
- ✅ Pause/unpause functionality
- ✅ Access control (admin, operator, emergency)
- ✅ View functions

### XCMProxy Tests (25 tests)
- ✅ Deployment and initialization
- ✅ Investment execution
- ✅ Position management
- ✅ Liquidation functionality
- ✅ Fee collection
- ✅ Pause/unpause functionality
- ✅ Access control (owner, operator)
- ✅ View functions and queries

### Integration Tests (10 tests)
- ✅ Full investment flow (Vault → Proxy)
- ✅ Full liquidation flow (Proxy → Vault)
- ✅ Multiple position scenarios
- ✅ State consistency across contracts
- ✅ Error handling
- ✅ Multi-user scenarios
- ✅ Partial liquidation

### Emergency Tests (15 tests)
- ✅ Emergency liquidation
- ✅ Emergency pause functionality
- ✅ Recovery from pause
- ✅ Emergency role transfer
- ✅ Emergency with active positions
- ✅ Full emergency scenario recovery

**Total: 85+ Foundry Tests**

## 🚀 Getting Started

### Prerequisites

1. **Install Foundry**

   **Windows:**
   ```powershell
   # Using foundryup (WSL or Git Bash required)
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   
   # OR download from GitHub releases:
   # https://github.com/foundry-rs/foundry/releases
   ```

   **macOS/Linux:**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Verify Installation**
   ```bash
   forge --version
   # Should show: forge 0.2.0 (or higher)
   ```

3. **Install Dependencies**
   ```bash
   # Install forge-std and other dependencies
   forge install foundry-rs/forge-std --no-commit
   ```

## ⚙️ Configuration

The Foundry configuration is in `foundry.toml` at the project root. Key settings:

```toml
[profile.default]
src = "contracts"
out = "out"
test = "test/foundry"
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
```

## 🧪 Running Tests

### Run All Foundry Tests
```bash
forge test
```

### Run Specific Test File
```bash
# AssetHubVault tests
forge test --match-path test/foundry/AssetHubVault.t.sol

# XCMProxy tests
forge test --match-path test/foundry/XCMProxy.t.sol

# Integration tests
forge test --match-path test/foundry/Integration.t.sol

# Emergency tests
forge test --match-path test/foundry/Emergency.t.sol
```

### Run Specific Test Function
```bash
# Run a specific test by name
forge test --match-test testDeposit

# Run tests matching a pattern
forge test --match-test "testDeposit*"
```

### Run with Verbosity
```bash
# Show gas usage
forge test -vv

# Show detailed logs
forge test -vvv

# Show trace for failed tests
forge test -vvvv

# Show trace for all tests
forge test -vvvvv
```

### Run with Gas Report
```bash
forge test --gas-report
```

### Run with Coverage
```bash
forge coverage
```

## 📊 Test Output Examples

### Successful Test Run
```
Running 85 tests for test/foundry/AssetHubVault.t.sol:AssetHubVaultTest
[PASS] testDeposit() (gas: 52341)
[PASS] testDepositEmitsEvent() (gas: 54123)
[PASS] testDepositZeroReverts() (gas: 28945)
...
Test result: ok. 35 passed; 0 failed; finished in 2.34s

Running 25 tests for test/foundry/XCMProxy.t.sol:XCMProxyTest
[PASS] testExecuteInvestment() (gas: 89234)
...
Test result: ok. 25 passed; 0 failed; finished in 1.89s

Running 10 tests for test/foundry/Integration.t.sol:IntegrationTest
[PASS] testFullInvestmentFlow() (gas: 145678)
...
Test result: ok. 10 passed; 0 failed; finished in 3.21s

Running 15 tests for test/foundry/Emergency.t.sol:EmergencyTest
[PASS] testEmergencyLiquidation() (gas: 112456)
...
Test result: ok. 15 passed; 0 failed; finished in 2.76s

Overall test result: ok. 85 passed; 0 failed; finished in 10.20s
```

### Gas Report Example
```
| Contract        | Function                | min    | avg    | median | max    |
|-----------------|-------------------------|--------|--------|--------|--------|
| AssetHubVault   | deposit                 | 45231  | 52341  | 52341  | 59451  |
| AssetHubVault   | withdraw                | 38945  | 42567  | 42567  | 46189  |
| AssetHubVault   | dispatchInvestment      | 98234  | 105678 | 105678 | 113122 |
| XCMProxy        | executeInvestment       | 82456  | 89234  | 89234  | 96012  |
| XCMProxy        | liquidatePosition       | 56789  | 63421  | 63421  | 70053  |
```

## 🔧 Troubleshooting

### Issue: "forge: command not found"
**Solution:** Foundry not installed or not in PATH. Install Foundry using instructions above.

### Issue: "Compiler version mismatch"
**Solution:** Ensure `foundry.toml` has `solc_version = "0.8.24"` and run `forge build`.

### Issue: "Dependency not found"
**Solution:** 
```bash
# Install forge-std
forge install foundry-rs/forge-std --no-commit

# Update dependencies
forge update
```

### Issue: Tests failing with "stack too deep"
**Solution:** This is a Solidity compiler limitation. Try:
1. Reduce local variables in test functions
2. Split complex tests into smaller ones
3. Use `via_ir = true` in `foundry.toml` (slower compilation)

### Issue: "Out of gas" errors
**Solution:**
```bash
# Increase gas limit for tests
forge test --gas-limit 30000000
```

## 📚 Writing New Tests

### Test Template

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./helpers/TestSetup.sol";

contract MyNewTest is TestSetup {
    AssetHubVault public vault;

    function setUp() public {
        setupAccounts();
        vault = deployAndConfigureVault();
    }

    function testMyFeature() public {
        // Arrange
        vm.prank(user1);
        vault.deposit{value: 10 ether}();

        // Act
        vm.prank(user1);
        vault.withdraw(5 ether);

        // Assert
        assertEq(vault.getUserBalance(user1), 5 ether);
    }
}
```

### Best Practices

1. **Use TestSetup Helpers:** Inherit from `TestSetup` for common utilities
2. **Clear Test Names:** Use descriptive function names like `testDepositEmitsEvent`
3. **Arrange-Act-Assert:** Structure tests clearly
4. **Use vm.prank():** For simulating different callers
5. **Use vm.expectRevert():** For testing error cases
6. **Use vm.expectEmit():** For testing events
7. **Test Edge Cases:** Zero amounts, insufficient balances, etc.
8. **Gas Optimization:** Keep tests lean to avoid "out of gas"

## 🎓 Foundry Cheatcodes

Common cheatcodes used in these tests:

```solidity
// Impersonate an address for the next call
vm.prank(address);

// Impersonate an address for all subsequent calls
vm.startPrank(address);
vm.stopPrank();

// Set balance of an address
vm.deal(address, amount);

// Expect next call to revert with specific error
vm.expectRevert(ErrorSelector);

// Expect next call to emit specific event
vm.expectEmit(checkTopic1, checkTopic2, checkTopic3, checkData);

// Create a labeled address
makeAddr("label");

// Warp to specific block timestamp
vm.warp(timestamp);

// Set block number
vm.roll(blockNumber);
```

For more cheatcodes, see: https://book.getfoundry.sh/cheatcodes/

## 📈 Continuous Integration

To run Foundry tests in CI:

```yaml
# .github/workflows/test.yml
- name: Run Foundry tests
  run: |
    forge test --gas-report
    forge coverage
```

## 🔗 Useful Links

- [Foundry Book](https://book.getfoundry.sh/)
- [Foundry Cheatcodes Reference](https://book.getfoundry.sh/cheatcodes/)
- [Foundry GitHub](https://github.com/foundry-rs/foundry)
- [Hardhat vs Foundry](https://book.getfoundry.sh/tutorials/best-practices#hardhat-compatibility)

## 🎉 Happy Testing!

For questions or issues with Foundry tests, please refer to the main project documentation or open an issue on GitHub.


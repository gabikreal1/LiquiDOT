# AssetHubVault Testing Modes

## 🎯 Two Testing Approaches

### 1. LOCAL MODE (Default) - For Development
- **When**: Local development with Hardhat
- **How**: Deploys fresh contract for each test
- **Pros**: Fast, isolated, no state conflicts
- **Cons**: Not testing against real deployment
- **Cost**: Free (local blockchain)

### 2. TESTNET MODE - For Asset Hub
- **When**: Testing against real deployment on Asset Hub (via Remix)
- **How**: Connects to your deployed contract
- **Pros**: Tests real deployment, real network conditions
- **Cons**: Slower, shared state, costs gas
- **Cost**: Uses real testnet tokens

## 🚀 How to Run Tests

### Local Mode (Default)
```bash
# No environment variable needed
npx hardhat test test/AssetHubVault/1.deployment.test.js

# Fast, deploys fresh contract each time
```

### Testnet Mode (Asset Hub)
```bash
# Set your deployed contract address
$env:ASSETHUB_CONTRACT="0xYourContractAddress"  # PowerShell
# OR
export ASSETHUB_CONTRACT="0xYourContractAddress"  # Linux/Mac

# Run tests against deployed contract
npx hardhat test test/AssetHubVault/1.deployment.test.js
```

## ⚠️ IMPORTANT: Testnet Mode Limitations

### State is NOT Reset Between Tests
Since you can't redeploy the contract, **state persists** across tests:

❌ **Won't Work**: Tests that assume clean state
```javascript
// This assumes balance is 0, but previous test may have left balance
expect(await vault.getUserBalance(user1.address)).to.equal(0);
```

✅ **Works**: Tests that check behavior regardless of state
```javascript
// This works - deposits always increase balance
const balanceBefore = await vault.getUserBalance(user1.address);
await vault.deposit({ value: amount });
const balanceAfter = await vault.getUserBalance(user1.address);
expect(balanceAfter).to.equal(balanceBefore + amount);
```

### Recommended Testnet Testing Strategy

**Option 1: Read-Only Tests** (Safest)
```javascript
// Only test view functions and configuration
it("should have correct admin", async function() {
  const admin = await vault.admin();
  expect(admin).to.be.properAddress;
});
```

**Option 2: Use Unique Test Data**
```javascript
const { getUniqueAmount } = require('./test-setup');

it("should deposit successfully", async function() {
  // Each run uses different amount to avoid conflicts
  const amount = getUniqueAmount("10");
  await vault.deposit({ value: amount });
});
```

**Option 3: State-Independent Tests**
```javascript
it("should revert on zero deposit", async function() {
  // This doesn't modify state
  await expect(
    vault.deposit({ value: 0 })
  ).to.be.revertedWithCustomError(vault, "AmountZero");
});
```

## 📝 Test File Pattern

### Pattern 1: Deployment Tests (Local Only)
```javascript
describe("AssetHubVault - Deployment", function () {
  let vault, signers;

  before(async function () {
    const { vault: v, signers: s, mode } = await setupAssetHubVault();
    
    // Skip deployment tests in testnet mode
    if (mode === 'TESTNET') {
      this.skip();
    }
    
    vault = v;
    signers = s;
  });

  it("should deploy with correct initial state", async function () {
    // These tests only make sense on fresh deployment
  });
});
```

### Pattern 2: Behavior Tests (Works Both Modes)
```javascript
describe("AssetHubVault - Deposits", function () {
  let vault, signers;

  before(async function () {
    const setup = await setupAssetHubVault();
    vault = setup.vault;
    signers = setup.signers;
  });

  it("should accept deposits", async function () {
    // Test behavior, not initial state
    const { user1 } = signers;
    const balanceBefore = await vault.getUserBalance(user1.address);
    
    await vault.connect(user1).deposit({ value: ethers.parseEther("10") });
    
    const balanceAfter = await vault.getUserBalance(user1.address);
    expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("10"));
  });
});
```

### Pattern 3: Configuration Tests (Testnet Friendly)
```javascript
describe("AssetHubVault - Configuration", function () {
  let vault, signers, mode;

  before(async function () {
    const setup = await setupAssetHubVault();
    vault = setup.vault;
    signers = setup.signers;
    mode = setup.mode;
  });

  it("should have XCM precompile configured", async function () {
    const precompile = await vault.XCM_PRECOMPILE();
    
    if (mode === 'LOCAL') {
      // Local: we set a dummy address
      expect(precompile).to.equal("0x0000000000000000000000000000000000000808");
    } else {
      // Testnet: should be real precompile
      expect(precompile).to.not.equal(ethers.ZeroAddress);
    }
  });
});
```

## 🔧 Recommended Test Organization

### Tests That Work in BOTH Modes
✅ Deposit/Withdrawal behavior
✅ Event emission  
✅ Error conditions (reverts)
✅ Access control (if you have permissions)
✅ View functions
✅ State transitions (before/after)

### Tests That Need LOCAL Mode
❌ Deployment checks
❌ Initial state assumptions
❌ Tests requiring admin/operator (unless you control them)
❌ Tests that need clean state
❌ Tests that would leave contract in bad state

## 💡 Best Practice

**For Development**: Use LOCAL mode
- Fast iteration
- Full test coverage
- No costs

**For Pre-Production**: Run subset in TESTNET mode
- Critical path tests
- Integration verification
- Real network validation

**Example Test Script**:
```bash
# Full test suite locally
npx hardhat test test/AssetHubVault/**/*.test.js

# Critical tests on testnet
$env:ASSETHUB_CONTRACT="0xYourAddress"
npx hardhat test test/AssetHubVault/1.deployment.test.js  # Skip
npx hardhat test test/AssetHubVault/3.deposit.test.js     # Run subset
npx hardhat test test/AssetHubVault/7.config.test.js      # Run subset
```

## 🎓 Summary

**LOCAL MODE**: Full testing, deploy fresh each time (DEFAULT)
**TESTNET MODE**: Smoke testing against real deployment (OPTIONAL)

Most development should use LOCAL mode. Use TESTNET mode sparingly for final validation before mainnet.


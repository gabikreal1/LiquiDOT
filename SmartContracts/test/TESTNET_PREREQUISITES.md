# 🎯 Testnet Testing Prerequisites & Setup Guide

## Quick Answer

**Can you test on testnet NOW?** ✅ **YES!**

**Do you need to redeploy AssetHubVault?** ❌ **NO!** Tests work with your existing deployment.

**How many wallets needed?** 🔑 **1-2 wallets** (1 is enough for most tests)

---

## 📋 Complete Prerequisites Checklist

### ✅ What You Already Have

1. **AssetHubVault Deployed on Testnet** ✅
   - You deployed it via Remix
   - You have the contract address
   - **No need to redeploy!**

2. **Contract Address** ✅
   - You know the address where it's deployed
   - Example: `0x1234...abcd`

---

## 🔑 Wallet & Private Key Requirements

### For Testnet Tests (Safe Tests)

**Minimum Requirement: 1 Wallet** 

```
Wallet 1 (Your Main Account):
├── Has testnet ETH for gas
├── Will be used for deposits
├── Will be used for withdrawals
└── Can be any role (user, admin, operator)
```

**Optional: 2-3 Wallets for Full Coverage**

```
Wallet 1 (Admin/Owner):
├── The deployer of AssetHubVault
├── Has admin role
└── Can run admin function tests

Wallet 2 (Test User):
├── Regular user account
├── Will test deposits/withdrawals
└── Tests multi-user scenarios

Wallet 3 (Optional - Operator):
├── If you have a separate operator role
└── For operator function tests
```

### How to Set Up Wallets

**Option 1: Use Your Existing Wallet** (Easiest)
```bash
# Just use the wallet you deployed AssetHubVault with
# It's already the admin/operator/emergency by default
```

**Option 2: Create Additional Test Wallets** (For multi-user tests)
```bash
# Hardhat will generate additional wallets automatically
# You just need to fund them with testnet ETH
```

---

## 💰 Testnet ETH Requirements

### For Safe Testing (Recommended)

| Test Type | Amount Needed | Why |
|-----------|---------------|-----|
| **Config Check** | ~0.01 ETH | Gas for read operations |
| **Deposit Tests** | ~0.5 ETH | Small test deposits (0.1-0.2 ETH) + gas |
| **Full Testnet Suite** | ~2 ETH | Multiple deposits + gas |

**Total Recommended: 1-2 ETH per wallet**

### Where to Get Testnet ETH

If testing on **Moonbase Alpha** (common for Polkadot projects):
- Faucet: https://faucet.moonbeam.network/
- Discord: Request in Moonbeam Discord

If testing on **Sepolia** or other testnet:
- Use respective faucet
- Or bridge from other testnets

---

## 🔧 Environment Setup

### 1. Install Dependencies (One Time)
```bash
cd SmartContracts
npm install
```

### 2. Configure Your Environment

Create `.env` file in `SmartContracts/` directory:

```bash
# SmartContracts/.env

# Your deployed AssetHubVault address (REQUIRED)
ASSETHUB_CONTRACT=0xYourContractAddressHere

# Your wallet private key (REQUIRED)
# This is the wallet you'll use for testing
PRIVATE_KEY=0xYourPrivateKeyHere

# Testnet RPC (Optional - has defaults)
# For Asset Hub testnet
ASSETHUB_RPC=https://rococo-asset-hub-rpc.polkadot.io

# Or for Moonbase Alpha
MOONBASE_RPC=https://rpc.api.moonbase.moonbeam.network

# Optional: Additional accounts for multi-user tests
PRIVATE_KEY_2=0xSecondWalletPrivateKey
PRIVATE_KEY_3=0xThirdWalletPrivateKey
```

**⚠️ SECURITY WARNING:**
- ✅ Add `.env` to `.gitignore`
- ❌ Never commit private keys to git
- ✅ Only use testnet wallets
- ❌ Never use mainnet private keys for testing

### 3. Verify Your Setup

```bash
# Check if your contract is accessible
npm run test:testnet:config
```

---

## 🎯 What Tests You Can Run on Testnet

### ✅ **Tier 1: Safe Tests** (Recommended to Start)

**These tests are 100% safe for your deployed contract:**

#### 1. Configuration Check (SAFEST - Read Only)
```bash
$env:ASSETHUB_CONTRACT="0xYourAddress"
npm run test:testnet:config
```

**What it does:**
- ✅ Reads contract configuration
- ✅ Checks admin, operator, emergency roles
- ✅ Verifies XCM precompile settings
- ✅ Shows contract balance
- ❌ **NO STATE CHANGES**
- ❌ **NO GAS COSTS** (just queries)

**You need:**
- 1 wallet
- Contract address
- ~0.001 ETH for gas

---

#### 2. Deposit/Withdrawal Tests
```bash
$env:ASSETHUB_CONTRACT="0xYourAddress"
npm run test:testnet:deposits
```

**What it does:**
- Deposits small amounts (0.01-0.1 ETH)
- Tests withdrawal functionality
- Verifies balance tracking
- Tests events
- All with **small, safe amounts**

**State changes:**
- ✅ Adds to your balance (you can withdraw later)
- ✅ Safe - just testing basic functions

**You need:**
- 1-2 wallets
- ~0.5-1 ETH (for deposits + gas)
- Can recover by withdrawing

---

### ⚠️ **Tier 2: Requires Permissions**

These tests require you to have specific roles:

#### 3. Admin Function Tests
**Requires:** You must be the admin (contract owner)

```bash
# Only if you deployed the contract or are admin
npm run test:testnet
```

**Tests:**
- Setting operator
- Pausing/unpausing
- Configuring XCM precompile
- Admin role transfer

**You need:**
- Admin role on the contract
- If you deployed via Remix, you ARE the admin ✅

---

#### 4. Operator Function Tests
**Requires:** You must be the operator

**Tests:**
- Investment dispatch (test mode)
- Position liquidation settlement

**You need:**
- Operator role
- By default, deployer is operator ✅

---

### ❌ **Tier 3: Cannot Run Yet**

These require XCM infrastructure:

```bash
# NOT YET - requires XCM channel
npm run test:integration:real
```

**Why not?**
- Requires XCM connection between Asset Hub and Moonbase
- Requires XCMProxy deployed on Moonbase
- You mentioned "no xcm connection between assethub and moonbase" yet

**When you CAN run these:**
- After XCM channel is established
- After deploying XCMProxy on Moonbase

---

### ✅ **Tier 4: Can Run Anytime** (Local/Mock)

These don't touch your testnet deployment at all:

```bash
# Mock integration tests (no testnet needed!)
npm run test:integration:mock

# Local development tests (deploys fresh contracts locally)
npm run test:local
npm run test:xcmproxy
```

**What they do:**
- Deploy contracts on local Hardhat network
- Test integration logic
- Simulate XCM manually
- **100% safe - doesn't touch testnet**

**You need:**
- Nothing! Just run the command
- No testnet ETH needed
- No contract address needed

---

## 📊 Recommended Testing Sequence

### Step 1: Verify Setup (5 minutes)
```bash
# Set your contract address
$env:ASSETHUB_CONTRACT="0xYourActualContractAddress"

# Run safest test
npm run test:testnet:config
```

**Expected Output:**
```
✅ Connected to vault at 0x...
  Admin: 0xYourAddress
  Operator: 0xYourAddress
  Emergency: 0xYourAddress
  XCM Precompile: 0x0000000000000000000000000000000000000808
  Test Mode: true
  Paused: false
  Contract Balance: 0 ETH

  8 passing (3s)
```

---

### Step 2: Test Basic Functionality (10 minutes)
```bash
# Make sure you have ~1 ETH for deposits
npm run test:testnet:deposits
```

**Expected Output:**
```
AssetHubVault Testnet - Deposits & Withdrawals
  Deposit Functionality
    ✓ should accept deposits
       ✓ Deposited 0.1 ETH
       ✓ New balance: 0.1 ETH
    ✓ should emit Deposit event
    ✓ should revert on zero deposit
  
  Withdrawal Functionality
    ✓ should allow withdrawal if balance exists
       ✓ Withdrew 0.01 ETH
    ✓ should revert on insufficient balance

  20 passing (12s)
```

---

### Step 3: Run Full Testnet Suite (Optional)
```bash
# If you want comprehensive testing
npm run test:testnet
```

**This runs:**
- Configuration checks
- Deposit/withdrawal tests
- All testnet-safe tests

**Cost:** ~0.5-1 ETH in deposits (recoverable)

---

### Step 4: Mock Integration Testing (Anytime)
```bash
# Test integration WITHOUT touching testnet
npm run test:integration:mock
```

**This tests:**
- Complete investment flow
- Complete liquidation flow
- **All WITHOUT XCM or testnet**

---

## 🔧 Hardhat Configuration

Make sure your `hardhat.config.js` has testnet configuration:

```javascript
require('dotenv').config();

module.exports = {
  networks: {
    // For Asset Hub testnet
    assethub: {
      url: process.env.ASSETHUB_RPC || "https://rococo-asset-hub-rpc.polkadot.io",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1000, // Asset Hub Rococo
    },
    
    // For Moonbase Alpha testnet
    moonbase: {
      url: process.env.MOONBASE_RPC || "https://rpc.api.moonbase.moonbeam.network",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1287,
    },
    
    // For local testing
    hardhat: {
      chainId: 31337,
    },
  },
};
```

---

## 🎯 Complete Prerequisite Checklist

Before running tests, make sure you have:

### Required ✅
- [ ] Node.js installed (v16+)
- [ ] npm install completed
- [ ] `.env` file with ASSETHUB_CONTRACT
- [ ] `.env` file with PRIVATE_KEY
- [ ] At least 0.5-1 testnet ETH in your wallet
- [ ] AssetHubVault deployed on testnet (you have this ✅)

### Optional (for full coverage)
- [ ] 2-3 testnet wallets with ETH
- [ ] Additional private keys in `.env`
- [ ] Operator role configured (if not deployer)

### Not Needed Yet
- [ ] ❌ XCMProxy deployment (for later)
- [ ] ❌ XCM channel (for later)
- [ ] ❌ Redeployment of AssetHubVault (use existing!)

---

## 🚀 Quick Start Commands

### Complete Setup (First Time)
```powershell
# 1. Navigate to project
cd SmartContracts

# 2. Install dependencies
npm install

# 3. Create .env file
# Add your contract address and private key

# 4. Verify setup
$env:ASSETHUB_CONTRACT="0xYourAddress"
npm run test:testnet:config
```

### Regular Testing
```powershell
# Just set your address and test
$env:ASSETHUB_CONTRACT="0xYourAddress"
npm run test:testnet:deposits
```

---

## 💡 Common Issues & Solutions

### Issue 1: "ASSETHUB_CONTRACT not set"
```powershell
# Solution: Set the environment variable
$env:ASSETHUB_CONTRACT="0xYourContractAddress"
```

### Issue 2: "Failed to connect to contract"
**Causes:**
- Wrong contract address
- Wrong network in hardhat.config.js
- RPC endpoint down

**Solution:**
```bash
# Verify your contract address
# Check RPC is working
# Make sure you're on the right network
```

### Issue 3: "Insufficient funds"
**Cause:** Wallet doesn't have enough testnet ETH

**Solution:**
- Get testnet ETH from faucet
- Or reduce test deposit amounts in test files

### Issue 4: "Not operator" (test skipped)
**Cause:** Your wallet doesn't have operator role

**Solution:**
- Tests will auto-skip (this is normal)
- Or grant operator role to your wallet if you're admin

---

## 📊 Cost Estimate

### Running Testnet Tests

| Test Suite | Time | ETH Used | Gas Cost | Recoverable? |
|------------|------|----------|----------|--------------|
| Config Check | 1 min | 0 ETH | ~0.001 ETH | N/A |
| Deposits | 5 min | 0.3 ETH | ~0.02 ETH | ✅ Yes (withdraw) |
| Full Suite | 10 min | 0.5 ETH | ~0.05 ETH | ✅ Mostly |

**Total for complete testnet validation: ~1 ETH**

---

## 🎓 Summary

### What You Need (Minimum)
1. **1 testnet wallet** with 1-2 ETH
2. **AssetHubVault address** (you have this)
3. **Private key** in `.env` file
4. **npm install** completed

### What You DON'T Need
- ❌ Redeploy AssetHubVault (use existing!)
- ❌ XCM connection (for testnet tests)
- ❌ XCMProxy (for testnet tests)
- ❌ Multiple wallets (1 is enough to start)

### What You Can Test NOW
- ✅ Configuration validation (free, read-only)
- ✅ Deposit/withdrawal (small amounts)
- ✅ Balance tracking
- ✅ Event emission
- ✅ Basic functionality

### What to Test Later
- ⏳ Integration tests (when XCM ready)
- ⏳ XCMProxy tests (when deployed on Moonbase)

### Start Testing Now!
```powershell
# 1. Set your contract
$env:ASSETHUB_CONTRACT="0xYourAddress"

# 2. Run safest test
npm run test:testnet:config

# 3. If that works, try deposits
npm run test:testnet:deposits
```

**You're ready to test! 🚀**


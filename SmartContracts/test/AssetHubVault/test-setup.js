/**
 * AssetHubVault Test Setup Helper
 * 
 * Supports two modes:
 * 1. LOCAL MODE: Deploy fresh contract for each test (fast, isolated)
 * 2. TESTNET MODE: Connect to existing deployed contract (for Asset Hub via Remix)
 * 
 * Set ASSETHUB_CONTRACT environment variable to use testnet mode
 * 
 * Usage in tests:
 *   const { setupAssetHubVault } = require('./test-setup');
 *   
 *   before(async function() {
 *     const setup = await setupAssetHubVault();
 *     assetHubVault = setup.vault;
 *   });
 */

const { ethers } = require("hardhat");

/**
 * Check if we're in testnet mode (connecting to existing deployment)
 */
function isTestnetMode() {
  return process.env.ASSETHUB_CONTRACT && process.env.ASSETHUB_CONTRACT !== ethers.ZeroAddress;
}

/**
 * Setup AssetHubVault for testing
 * 
 * LOCAL MODE (default):
 * - Deploys fresh AssetHubVault contract
 * - Configures with test settings
 * - Fast and isolated
 * 
 * TESTNET MODE (when ASSETHUB_CONTRACT env var is set):
 * - Connects to existing deployed contract
 * - Does NOT deploy or configure
 * - Uses existing state
 * 
 * @returns {Promise<Object>} { vault, mode, signers }
 */
async function setupAssetHubVault() {
  const signers = await ethers.getSigners();
  const [deployer, user1, user2, operator, emergency] = signers;
  
  const mode = isTestnetMode() ? 'TESTNET' : 'LOCAL';
  let vault;
  
  if (mode === 'TESTNET') {
    // TESTNET MODE: Connect to existing contract
    const vaultAddress = process.env.ASSETHUB_CONTRACT;
    console.log(`\n🔗 TESTNET MODE: Connecting to AssetHubVault at ${vaultAddress}`);
    
    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    vault = AssetHubVault.attach(vaultAddress);
    
    // Verify contract exists
    try {
      const admin = await vault.admin();
      console.log(`   ✓ Connected (admin: ${admin})`);
    } catch (error) {
      throw new Error(`Failed to connect to AssetHubVault at ${vaultAddress}: ${error.message}`);
    }
    
    console.log(`   ⚠️  WARNING: Tests will use EXISTING contract state!`);
    console.log(`   ⚠️  Use unique test data to avoid conflicts\n`);
    
  } else {
    // LOCAL MODE: Deploy fresh contract
    console.log(`\n🔧 LOCAL MODE: Deploying fresh AssetHubVault for testing`);
    
    const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault");
    vault = await AssetHubVault.deploy();
    await vault.waitForDeployment();
    
    console.log(`   ✓ Deployed at: ${await vault.getAddress()}`);
    
    // Configure for testing
    await vault.setOperator(operator.address);
    await vault.setTestMode(true);
    await vault.setXcmPrecompile("0x0000000000000000000000000000000000000808");
    
    console.log(`   ✓ Configured for testing\n`);
  }
  
  return {
    vault,
    mode,
    signers: {
      deployer,
      user1,
      user2,
      operator,
      emergency,
      all: signers
    }
  };
}

/**
 * Setup for tests that need fresh state each time
 * 
 * LOCAL MODE: Deploys new contract
 * TESTNET MODE: Warns that state is shared, provides unique test prefix
 */
async function setupFreshTest() {
  const setup = await setupAssetHubVault();
  
  if (setup.mode === 'TESTNET') {
    // Generate unique prefix for this test run to avoid data conflicts
    const testPrefix = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return {
      ...setup,
      testPrefix,
      warning: 'TESTNET MODE: State is shared! Use testPrefix for unique data'
    };
  }
  
  return setup;
}

/**
 * Clean up after tests (if possible)
 * 
 * LOCAL MODE: No cleanup needed (contract will be discarded)
 * TESTNET MODE: Cannot clean up (would require admin access and state reset)
 */
async function cleanupAssetHubVault(vault) {
  if (isTestnetMode()) {
    console.log(`\n⚠️  TESTNET MODE: Cannot clean up state on deployed contract`);
    console.log(`   Manual cleanup may be required\n`);
  }
  // Local mode: nothing to cleanup
}

/**
 * Get a unique amount for testnet testing
 * Prevents test data conflicts by using varying amounts
 */
function getUniqueAmount(baseAmount) {
  if (isTestnetMode()) {
    // Add small random amount to avoid exact collisions
    const randomOffset = Math.floor(Math.random() * 1000);
    return ethers.parseEther(baseAmount) + BigInt(randomOffset);
  }
  return ethers.parseEther(baseAmount);
}

module.exports = {
  setupAssetHubVault,
  setupFreshTest,
  cleanupAssetHubVault,
  isTestnetMode,
  getUniqueAmount
};


/**
 * Complete Test Environment Setup
 * 
 * This is the main orchestrator for setting up a comprehensive testing environment.
 * It combines multiple deployment modules to create a fully-functional local testnet
 * that mirrors the production LiquiDOT system.
 * 
 * The environment includes:
 * - Algebra Protocol DEX (production contracts from @cryptoalgebra packages)
 * - XCMProxy for cross-chain operations
 * - AssetHubVault for liquidity management
 * - Test ERC20 tokens with minting capability
 * - Initialized liquidity pools ready for trading
 * - Configured cross-chain parameters
 * 
 * This setup enables:
 * - Integration testing without external dependencies
 * - Fast iteration cycles (no waiting for testnet blocks)
 * - Deterministic test scenarios (no external state)
 * - Gas-efficient testing (no testnet tokens needed)
 * 
 * Usage:
 *   const env = await setupTestEnvironment();
 *   // env contains all deployed contracts and test accounts
 *   // Ready to use in your tests!
 * 
 * @module test/setup/test-environment
 */

const { ethers } = require("hardhat");
const { deployAlgebraSuite } = require("./deploy-algebra-suite");
const { deployXCMProxy } = require("./deploy-xcm-proxy");
const { 
  deployTestTokens, 
  deployMockXcmPrecompiles,
  connectToAssetHubVault,  // Changed from deployAssetHubVault - connects to existing deployment
  createAndInitializePool,
  addLiquidityToPool,
  mintTokens,
  approveTokens,
} = require("./deploy-test-contracts");

/**
 * Deploys and configures the complete test environment
 * 
 * This function orchestrates all deployment steps in the correct order,
 * handling dependencies between contracts and ensuring proper configuration.
 * 
 * Deployment sequence:
 * 1. Deploy Algebra Protocol (DEX infrastructure)
 * 2. Deploy test tokens (for trading pairs)
 * 3. Create and initialize Algebra pool (DEX liquidity)
 * 4. Deploy mock XCM precompiles (for cross-chain simulation)
 * 5. Connect to existing AssetHubVault (deployed via Remix)
 * 6. Deploy and configure XCMProxy (Moonbeam side contract)
 * 7. Cross-link contracts (set addresses and permissions)
 * 8. Add initial liquidity to pool (enable trading)
 * 
 * @param {object} options - Environment setup options
 * @param {number} [options.tokenCount=2] - Number of test tokens to deploy
 * @param {string} [options.liquidityAmount="100"] - Initial liquidity amount (in ether units)
 * @param {boolean} [options.skipLiquidity=false] - Skip adding initial liquidity
 * @param {boolean} [options.testMode=true] - Enable test mode on XCM contracts
 * @param {boolean} [options.verbose=true] - Enable detailed logging
 * @param {string} [options.vaultAddress] - Address of existing AssetHubVault (or use ASSETHUB_CONTRACT env var)
 * @param {boolean} [options.configureVault=false] - Whether to configure the existing vault
 * @returns {Promise<object>} Complete environment with all contracts and test accounts
 */
async function setupTestEnvironment(options = {}) {
  const tokenCount = options.tokenCount || 2;
  const liquidityAmount = options.liquidityAmount || "100";
  const skipLiquidity = options.skipLiquidity || false;
  const testMode = options.testMode !== false;  // Default true
  const verbose = options.verbose !== false;    // Default true
  
  if (verbose) {
    console.log("\n" + "=".repeat(60));
    console.log("  LiquiDOT Test Environment Setup");
    console.log("=".repeat(60) + "\n");
  }

  // ===== STEP 1: Get test accounts =====
  // Hardhat provides 20 pre-funded accounts for testing
  // We'll use the first few for different roles
  const [deployer, user1, user2, operator, emergency] = await ethers.getSigners();
  
  if (verbose) {
    console.log("👥 Test Accounts:");
    console.log(`   Deployer:  ${deployer.address}`);
    console.log(`   User1:     ${user1.address}`);
    console.log(`   User2:     ${user2.address}`);
    console.log(`   Operator:  ${operator.address}`);
    console.log(`   Emergency: ${emergency.address}\n`);
  }

  // ===== STEP 2: Deploy Algebra Protocol =====
  // This is the DEX infrastructure (equivalent to Uniswap V3 / PancakeSwap V3)
  // Deployed using official Algebra contracts for production fidelity
  if (verbose) console.log("📦 Step 1/8: Deploying Algebra Protocol...\n");
  
  const algebraResult = await deployAlgebraSuite({
    deployer,
    communityVault: deployer.address,  // Protocol fees go to deployer in tests
    wNative: ethers.ZeroAddress,       // No wrapped native token needed for testing
    saveDeployment: false,              // Don't save to file in test environment
  });
  
  const { factory, router, quoter, nfpm } = algebraResult.contracts;
  const algebraAddresses = algebraResult.addresses;
  
  if (verbose) {
    console.log("✅ Algebra Protocol deployed\n");
  }

  // ===== STEP 3: Deploy test tokens =====
  // These are mintable ERC20 tokens for creating trading pairs
  if (verbose) console.log(`📦 Step 2/8: Deploying ${tokenCount} test tokens...\n`);
  
  const tokens = await deployTestTokens({
    count: tokenCount,
    deployer,
  });
  
  // For convenience, extract first two tokens as token0/token1
  const [token0, token1] = tokens;
  
  if (verbose) {
    console.log("✅ Test tokens deployed\n");
  }

  // ===== STEP 4: Create and initialize Algebra pool =====
  // Pools must be created through the factory and initialized with a price
  if (verbose) console.log("📦 Step 3/8: Creating and initializing Algebra pool...\n");
  
  const token0Address = await token0.getAddress();
  const token1Address = await token1.getAddress();
  
  const pool = await createAndInitializePool({
    factory,
    token0: token0Address,
    token1: token1Address,
    // Default 1:1 price
  });
  
  const poolAddress = await pool.getAddress();
  
  if (verbose) {
    console.log("✅ Algebra pool ready\n");
  }

  // ===== STEP 5: Deploy mock XCM precompiles =====
  // Note: These are currently placeholder addresses as mocks were removed
  // For real XCM testing, deploy to Moonbeam testnet
  if (verbose) console.log("📦 Step 4/8: Setting up XCM precompiles...\n");
  
  const precompiles = await deployMockXcmPrecompiles({ deployer });
  
  if (verbose) {
    console.log("✅ XCM precompiles configured\n");
  }

  // ===== STEP 6: Connect to existing AssetHubVault =====
  // AssetHubVault is deployed separately (e.g., via Remix on Asset Hub)
  // We connect to the existing deployment using the ASSETHUB_CONTRACT env var
  if (verbose) console.log("📦 Step 5/8: Connecting to AssetHubVault...\n");
  
  const vaultResult = await connectToAssetHubVault({
    vaultAddress: options.vaultAddress || process.env.ASSETHUB_CONTRACT,
    deployer,
    operator: operator.address,
    emergency: emergency.address,
    xcmPrecompile: precompiles.mockXcmPrecompile,
    testMode,
    configureVault: options.configureVault || false,  // Only configure if explicitly requested
  });
  
  const vault = vaultResult.vault;
  const vaultAddress = vaultResult.address;
  
  if (verbose) {
    console.log("✅ AssetHubVault connected\n");
  }

  // ===== STEP 7: Deploy and configure XCMProxy =====
  // This is the main contract on Moonbeam that orchestrates DEX operations
  if (verbose) console.log("📦 Step 6/8: Deploying and configuring XCMProxy...\n");
  
  const proxyResult = await deployXCMProxy({
    deployer,
    owner: deployer.address,
    operator: operator.address,
    quoter: algebraAddresses.quoter,
    router: algebraAddresses.router,
    nfpm: algebraAddresses.nfpm,
    xtokensPrecompile: precompiles.mockXTokens,
    destWeight: 6_000_000_000n,
    assetHubParaId: 1000,  // Standard Asset Hub parachain ID
    trustedCaller: vaultAddress,  // Vault can trigger XCM callbacks
    xcmTransactor: ethers.ZeroAddress,
    defaultSlippageBps: 100,  // 1% default slippage
    supportedTokens: [token0Address, token1Address],
    freezeConfig: false,  // Don't freeze config in test environment
    saveState: false,     // Don't save to file in test environment
  });
  
  const proxy = proxyResult.proxy;
  const proxyAddress = proxyResult.address;
  
  if (verbose) {
    console.log("✅ XCMProxy deployed and configured\n");
  }

  // ===== STEP 8: Add initial liquidity to pool =====
  // Liquidity is needed for swaps to function
  // We add "full range" liquidity that's active at all prices
  if (!skipLiquidity) {
    if (verbose) console.log(`📦 Step 7/8: Adding ${liquidityAmount} initial liquidity...\n`);
    
    await addLiquidityToPool({
      pool,
      nfpm,
      token0,
      token1,
      provider: deployer,
      amount: liquidityAmount,
    });
    
    if (verbose) {
      console.log("✅ Initial liquidity added\n");
    }
  } else {
    if (verbose) {
      console.log("⏭️  Step 7/8: Skipped (liquidity addition disabled)\n");
    }
  }

  // ===== STEP 9: Final verification =====
  // Quick sanity check that everything is properly connected
  if (verbose) console.log("📦 Step 8/8: Verifying environment...\n");
  
  // Verify XCMProxy configuration
  const configuredRouter = await proxy.swapRouterContract();
  const configuredQuoter = await proxy.quoterContract();
  const configuredNFPM = await proxy.nfpmContract();
  const configuredOperator = await proxy.operator();
  
  if (configuredRouter !== algebraAddresses.router) {
    throw new Error(`Router mismatch: expected ${algebraAddresses.router}, got ${configuredRouter}`);
  }
  if (configuredQuoter !== algebraAddresses.quoter) {
    throw new Error(`Quoter mismatch: expected ${algebraAddresses.quoter}, got ${configuredQuoter}`);
  }
  if (configuredNFPM !== algebraAddresses.nfpm) {
    throw new Error(`NFPM mismatch: expected ${algebraAddresses.nfpm}, got ${configuredNFPM}`);
  }
  if (configuredOperator !== operator.address) {
    throw new Error(`Operator mismatch: expected ${operator.address}, got ${configuredOperator}`);
  }
  
  // Verify token support
  const token0Supported = await proxy.supportedTokens(token0Address);
  const token1Supported = await proxy.supportedTokens(token1Address);
  
  if (!token0Supported) {
    throw new Error(`Token0 ${token0Address} not marked as supported`);
  }
  if (!token1Supported) {
    throw new Error(`Token1 ${token1Address} not marked as supported`);
  }
  
  if (verbose) {
    console.log("✅ Environment verification passed\n");
    console.log("=".repeat(60));
    console.log("  🎉 Test Environment Ready!");
    console.log("=".repeat(60) + "\n");
  }

  // ===== Return complete environment =====
  // This object contains everything needed for testing
  return {
    // === LiquiDOT Contracts ===
    assetHubVault: vault,
    xcmProxy: proxy,
    
    // === Algebra DEX Contracts ===
    algebraFactory: factory,
    algebraRouter: router,
    algebraQuoter: quoter,
    algebraNFPM: nfpm,
    algebraPoolDeployer: algebraResult.contracts.poolDeployer,
    
    // === Liquidity Pool ===
    pool,
    
    // === Test Tokens ===
    tokens,      // Array of all tokens
    token0,      // First token
    token1,      // Second token
    
    // === Mock Precompiles ===
    mockXcmPrecompile: precompiles.mockXcmPrecompile,
    mockXTokens: precompiles.mockXTokens,
    
    // === Test Accounts ===
    signers: {
      deployer,
      user1,
      user2,
      operator,
      emergency,
    },
    deployer,    // Shorthand access
    user1,
    user2,
    operator,
    emergency,
    
    // === Contract Addresses (for reference) ===
    addresses: {
      assetHubVault: vaultAddress,
      xcmProxy: proxyAddress,
      factory: algebraAddresses.factory,
      router: algebraAddresses.router,
      quoter: algebraAddresses.quoter,
      nfpm: algebraAddresses.nfpm,
      poolDeployer: algebraAddresses.poolDeployer,
      pool: poolAddress,
      token0: token0Address,
      token1: token1Address,
    },
    
    // === Helper Functions ===
    // Re-export useful helpers for test convenience
    helpers: {
      mintTokens,
      approveTokens,
      addLiquidityToPool,
    },
    };
}

/**
 * Standalone script execution
 * Demonstrates setting up the complete environment
 */
async function main() {
  try {
    const env = await setupTestEnvironment({
      tokenCount: 2,
      liquidityAmount: "100",
      skipLiquidity: false,
      testMode: true,
      verbose: true,
    });
    
    console.log("Environment setup complete!");
    console.log("\nKey addresses:");
    console.log(JSON.stringify(env.addresses, null, 2));
    
    return env;
  } catch (error) {
    console.error("❌ Environment setup failed:", error);
    process.exit(1);
  }
}

// Execute main() if this script is run directly
if (require.main === module) {
  main();
}

// Export both the main setup function and individual components
module.exports = {
  setupTestEnvironment,
  
  // Re-export individual deployment modules for granular control
  deployAlgebraSuite,
  deployXCMProxy,
    deployTestTokens,
  deployMockXcmPrecompiles,
  connectToAssetHubVault,  // Changed from deployAssetHubVault
    createAndInitializePool,
  addLiquidityToPool,
    mintTokens,
    approveTokens,
};


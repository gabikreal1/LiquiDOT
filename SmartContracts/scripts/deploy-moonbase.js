/**
 * Moonbase Alpha Production Deployment Script
 * 
 * This script deploys the complete LiquiDOT infrastructure to Moonbase Alpha testnet:
 * 1. Algebra DEX suite (Factory, Router, Quoter, NFPM, PoolDeployer)
 * 2. XCMProxy contract with improved tick math (TickMath.getTickAtSqrtRatio for precise percent→tick)
 * 3. Test tokens (optional, for testing purposes)
 * 4. Test pool with liquidity (optional, for testing purposes)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-moonbase.js --network moonbase
 * 
 * Prerequisites:
 *   - MOON private key set in .env
 *   - DEV tokens in deployer account (get from https://faucet.moonbeam.network/)
 *   - Hardhat configured for moonbase network (already done in hardhat.config.js)
 * 
 * @module scripts/deploy-moonbase
 */

const { ethers } = require("hardhat");
const { deployAlgebraSuite } = require("../test/helpers/deploy-algebra-suite");
const { deployXCMProxy } = require("../test/helpers/deploy-xcm-proxy");
const { deployTestTokens, createAndInitializePool } = require("../test/helpers/deploy-test-contracts");
const fs = require("fs");
const path = require("path");

// Moonbase Alpha XCM precompile addresses
// See: https://docs.moonbeam.network/builders/interoperability/xcm/core-concepts/multilocations/
const MOONBASE_PRECOMPILES = {
  // xTokens precompile for cross-chain token transfers
  xTokens: "0x0000000000000000000000000000000000000804",
  // XCM Transactor precompile for executing XCM operations
  xcmTransactor: "0x0000000000000000000000000000000000000806",
  // Wrapped native token (WDEV on Moonbase Alpha)
  // Note: You may need to deploy WDEV or use existing deployment
  wNative: ethers.ZeroAddress, // Set to actual WDEV address if available
};

// Asset Hub parachain ID on Rococo
// See: https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Frococo-asset-hub-rpc.polkadot.io#/explorer
const ASSET_HUB_PARAID = 1000;

/**
 * Main deployment function
 * 
 * @param {object} options - Deployment options
 * @param {boolean} [options.deployTestTokens=true] - Whether to deploy test tokens
 * @param {boolean} [options.createTestPool=true] - Whether to create test pool with liquidity
 * @param {string} [options.assetHubVault] - AssetHubVault address (for setting trusted caller)
 * @param {string} [options.operator] - Custom operator address (defaults to deployer)
 * @param {number} [options.defaultSlippageBps=100] - Default slippage in basis points (100 = 1%)
 * @param {boolean} [options.freezeConfig=false] - Whether to freeze XCM config after deployment
 */
async function main(options = {}) {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║      LiquiDOT Moonbase Alpha Deployment Script            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Deployment Info:");
  console.log(`   Network: ${network.name}`);
  console.log(`   Chain ID: ${network.chainId}`);
  console.log(`   Deployer: ${deployer.address}`);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} DEV`);
  
  if (balance < ethers.parseEther("1")) {
    console.warn("\n⚠️  WARNING: Low balance! Get DEV tokens from https://faucet.moonbeam.network/\n");
  }
  
  console.log("\n" + "=".repeat(60) + "\n");

  // ===== STEP 1: Deploy Algebra DEX Suite =====
  console.log("STEP 1: Deploying Algebra DEX Suite");
  console.log("-".repeat(60));
  
  const algebraResult = await deployAlgebraSuite({
    deployer,
    communityVault: deployer.address, // Set to community multisig in production
    wNative: MOONBASE_PRECOMPILES.wNative,
    saveDeployment: true,
    outputDir: "./deployments",
  });
  
  const { factory, router, quoter, nfpm } = algebraResult.contracts;
  const algebraAddresses = algebraResult.addresses;
  
  console.log("\n✅ Algebra DEX Suite deployed successfully!");
  console.log(`   Factory: ${algebraAddresses.factory}`);
  console.log(`   Router: ${algebraAddresses.router}`);
  console.log(`   Quoter: ${algebraAddresses.quoter}`);
  console.log(`   NFPM: ${algebraAddresses.nfpm}`);
  
  console.log("\n" + "=".repeat(60) + "\n");

  // ===== STEP 2: Deploy XCMProxy =====
  console.log("STEP 2: Deploying and Configuring XCMProxy");
  console.log("-".repeat(60));
  
  const operatorAddress = options.operator || deployer.address;
  const assetHubVault = options.assetHubVault || process.env.ASSETHUB_CONTRACT || ethers.ZeroAddress;
  
  // Deploy and configure XCMProxy using shared helper (persists state)
  const xcmpResult = await deployXCMProxy({
    owner: deployer.address,
    operator: operatorAddress,
    quoter: algebraAddresses.quoter,
    router: algebraAddresses.router,
    nfpm: algebraAddresses.nfpm,
    xtokensPrecompile: MOONBASE_PRECOMPILES.xTokens,
    xcmTransactor: MOONBASE_PRECOMPILES.xcmTransactor,
    assetHubParaId: ASSET_HUB_PARAID,
    defaultSlippageBps: options.defaultSlippageBps || 100,
    trustedCaller: assetHubVault, // can be ZeroAddress and set later via link script
    supportedTokens: [], // will add after deploying test tokens
    freezeConfig: false,
    saveState: true,
  });

  const xcmProxy = xcmpResult.proxy;
  const xcmProxyAddress = xcmpResult.address;

  // Ensure test mode is enabled for safe testnet flows
  let tx = await xcmProxy.setTestMode(true);
  await tx.wait();
  console.log(`   ✓ XCMProxy deployed at ${xcmProxyAddress} and configured (test mode enabled)`);
  console.log(`   Operator: ${operatorAddress}`);
  console.log(`   Asset Hub Vault: ${assetHubVault === ethers.ZeroAddress ? "Not set (set later via link script)" : assetHubVault}`);
  
  console.log("\n" + "=".repeat(60) + "\n");

  // ===== STEP 3: Deploy Test Infrastructure (Optional) =====
  let testTokens = [];
  let testPool = null;
  
  if (options.deployTestTokens !== false) {
    console.log("STEP 3: Deploying Test Tokens and Bootstrapping Liquidity");
    console.log("-".repeat(60));
    
    // 3a. Deploy two mintable ERC20s for testing
    testTokens = await deployTestTokens({
      count: 2,
      names: ["TestUSDC", "TestUSDT"],
      symbols: ["USDC", "USDT"],
      deployer,
    });
    const tokenA = testTokens[0];
    const tokenB = testTokens[1];
    const tokenAAddr = await tokenA.getAddress();
    const tokenBAddr = await tokenB.getAddress();
    console.log(`   ✓ Test tokens: ${tokenAAddr} (USDC), ${tokenBAddr} (USDT)`);

    // 3b. Add supported tokens to XCMProxy
    const supported = [tokenAAddr, tokenBAddr];
    for (const t of supported) {
      const isSupported = await xcmProxy.supportedTokens(t);
      if (!isSupported) {
        const addTx = await xcmProxy.addSupportedToken(t);
        await addTx.wait();
        console.log(`   ✓ Added supported token: ${t}`);
      }
    }

    // 3c. Create and initialize an Algebra pool for the pair
    const [t0, t1] = tokenAAddr.toLowerCase() < tokenBAddr.toLowerCase() ? [tokenAAddr, tokenBAddr] : [tokenBAddr, tokenAAddr];
    testPool = await createAndInitializePool({
      factory: factory,
      token0: t0,
      token1: t1,
      initialize: true,
      // defaults to 1:1 price if sqrtPriceX96 not provided
    });
    const poolAddress = await testPool.getAddress();
    console.log(`   ✓ Pool ready at: ${poolAddress}`);

    console.log("\nℹ️  Skipping initial liquidity provision in deployment (use helper later):");
    console.log("   npx hardhat run test/helpers/provide-liquidity.js --network moonbase");
    console.log("   Configure LP_AMOUNT0/LP_AMOUNT1 and MOONBASE_NFPM if needed\n");
  }
  
  console.log("\n" + "=".repeat(60) + "\n");

  // ===== STEP 4: Deployment Summary =====
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║              DEPLOYMENT SUMMARY                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  console.log("📦 Core Contracts:");
  console.log(`   AlgebraFactory: ${algebraAddresses.factory}`);
  console.log(`   SwapRouter: ${algebraAddresses.router}`);
  console.log(`   Quoter: ${algebraAddresses.quoter}`);
  console.log(`   NFPM: ${algebraAddresses.nfpm}`);
  console.log(`   XCMProxy: ${xcmProxyAddress}`);
  
  if (testTokens.length > 0) {
    console.log("\n🧪 Test Infrastructure:");
    for (let i = 0; i < testTokens.length; i++) {
      console.log(`   Token${i}: ${await testTokens[i].getAddress()}`);
    }
    if (testPool) {
      console.log(`   Test Pool: ${await testPool.getAddress()}`);
    }
  }
  
  // Save bootstrap file for test suite consumption
  try {
    const deploymentsDir = path.join(process.cwd(), "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    const bootstrap = {
      network: { name: network.name, chainId: Number(network.chainId) },
      xcmProxy: { address: xcmProxyAddress },
      algebra: algebraAddresses,
      supportedTokens: testTokens.length > 0 ? await Promise.all(testTokens.map(t => t.getAddress())) : [],
      baseToken: testTokens[0] ? { address: await testTokens[0].getAddress() } : undefined,
      quoteToken: testTokens[1] ? { address: await testTokens[1].getAddress() } : undefined,
      pool: testPool ? { address: await testPool.getAddress() } : undefined,
    };
    const filePath = path.join(deploymentsDir, "moonbase_bootstrap.json");
    fs.writeFileSync(filePath, JSON.stringify(bootstrap, null, 2));
    console.log(`\n💾 Test bootstrap saved to: ${filePath}`);
  } catch (e) {
    console.warn("\n⚠️  Failed to save test bootstrap:", e?.message || e);
  }
  
  console.log("\n⚙️  Configuration:");
  console.log(`   Network: Moonbase Alpha (${network.chainId})`);
  console.log(`   Operator: ${operatorAddress}`);
  console.log(`   xTokens Precompile: ${MOONBASE_PRECOMPILES.xTokens}`);
  console.log(`   XCM Transactor: ${MOONBASE_PRECOMPILES.xcmTransactor}`);
  console.log(`   Asset Hub ParaID: ${ASSET_HUB_PARAID}`);
  console.log(`   Default Slippage: ${options.defaultSlippageBps || 100} bps (${(options.defaultSlippageBps || 100) / 100}%)`);
  
  console.log("\n📝 Next Steps:");
  console.log("   1. Verify contracts on Moonscan (optional but recommended)");
  console.log("   2. Update CONTRACT_ADDRESSES.md with deployment info");
  console.log("   3. Set AssetHubVault address as trusted caller if not set:");
  console.log(`      await xcmProxy.setTrustedXcmCaller("0xAssetHubVaultAddress")`);
  console.log("   4. Add supported tokens for cross-chain operations:");
  console.log(`      await xcmProxy.addSupportedToken("0xTokenAddress")`);
  console.log("   5. Test contract interactions using Hardhat console");
  console.log("   6. Create DEPLOYMENT_GUIDE.md documentation");
  
  console.log("\n✅ Deployment complete! All contract addresses saved to deployments/\n");
  
  // Return deployment data
  return {
    network: {
      name: network.name,
      chainId: network.chainId,
    },
    deployer: deployer.address,
    contracts: {
      algebra: algebraAddresses,
      xcmProxy: xcmProxyAddress,
      testTokens: testTokens.length > 0 ? await Promise.all(testTokens.map(t => t.getAddress())) : [],
      testPool: testPool ? await testPool.getAddress() : null,
    },
  };
}

// Execute main() when script is run directly
if (require.main === module) {
  main({
    deployTestTokens: true,   // Deploy test tokens for end-to-end testing
    createTestPool: true,     // Create and initialize pool
  })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main };

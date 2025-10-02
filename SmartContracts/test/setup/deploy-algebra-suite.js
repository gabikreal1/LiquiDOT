/**
 * Algebra Protocol Suite Deployment
 * 
 * This module deploys the complete Algebra DEX infrastructure including:
 * - AlgebraPoolDeployer: Factory for creating individual pool contracts
 * - AlgebraFactory: Main factory contract for pool creation and management
 * - SwapRouter: Handles token swaps across Algebra pools
 * - Quoter: Provides swap price quotes without executing transactions
 * - NonfungiblePositionManager (NFPM): Manages liquidity positions as NFTs
 * 
 * Uses the official Algebra Integral contracts from @cryptoalgebra npm packages
 * to ensure production-grade behavior in testing and deployment environments.
 * 
 * @module test/setup/deploy-algebra-suite
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Fully-qualified artifact paths to load real Algebra contracts from node_modules
// This ensures we're using the exact same contracts as production Algebra DEX
const ALGEBRA_ARTIFACTS = {
  PoolDeployer: "@cryptoalgebra/integral-core/contracts/AlgebraPoolDeployer.sol:AlgebraPoolDeployer",
  Factory: "@cryptoalgebra/integral-core/contracts/AlgebraFactory.sol:AlgebraFactory",
  Router: "@cryptoalgebra/integral-periphery/contracts/SwapRouter.sol:SwapRouter",
  Quoter: "@cryptoalgebra/integral-periphery/contracts/Quoter.sol:Quoter",
  NFPM: "@cryptoalgebra/integral-periphery/contracts/NonfungiblePositionManager.sol:NonfungiblePositionManager",
};

/**
 * Deploys the complete Algebra protocol suite
 * 
 * Deployment order is critical:
 * 1. PoolDeployer first (required by Factory)
 * 2. Factory second (uses PoolDeployer, required by periphery contracts)
 * 3. Periphery contracts (Router, Quoter, NFPM) - depend on Factory
 * 
 * @param {object} options - Deployment configuration options
 * @param {string} options.deployer - Signer account for deployment
 * @param {string} [options.communityVault] - Address for community fees (defaults to deployer)
 * @param {string} [options.wNative] - Wrapped native token address (defaults to zero address)
 * @param {boolean} [options.saveDeployment=true] - Whether to save deployment addresses to file
 * @param {string} [options.outputDir] - Custom output directory for deployment data
 * @returns {Promise<object>} Deployed contract instances and addresses
 */
async function deployAlgebraSuite(options = {}) {
  // Extract deployer or use default signer
  const [defaultSigner] = await ethers.getSigners();
  const deployer = options.deployer || defaultSigner;
  
  const network = await ethers.provider.getNetwork();
  console.log(`\n=== Deploying Algebra Suite on ${network.name} (chainId: ${network.chainId}) ===`);
  console.log(`Deployer address: ${deployer.address}\n`);

  // ===== STEP 1: Deploy Core Contracts =====
  
  // AlgebraPoolDeployer - Creates and manages pool contracts
  // This is the factory for individual pool instances
  console.log("📦 Deploying AlgebraPoolDeployer...");
  const PoolDeployer = await ethers.getContractFactory(ALGEBRA_ARTIFACTS.PoolDeployer, deployer);
  const poolDeployer = await PoolDeployer.deploy();
  await poolDeployer.waitForDeployment();
  const poolDeployerAddress = await poolDeployer.getAddress();
  console.log(`✅ PoolDeployer deployed: ${poolDeployerAddress}`);

  // AlgebraFactory - Main entry point for creating pools
  // Constructor params: (_poolDeployer, _communityVault)
  // - _poolDeployer: Address of the pool deployer contract
  // - _communityVault: Address that receives community fees (protocol revenue)
  console.log("\n📦 Deploying AlgebraFactory...");
  const communityVault = options.communityVault || deployer.address;
  const Factory = await ethers.getContractFactory(ALGEBRA_ARTIFACTS.Factory, deployer);
  const factory = await Factory.deploy(poolDeployerAddress, communityVault);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`✅ Factory deployed: ${factoryAddress}`);
  console.log(`   Community vault set to: ${communityVault}`);

  // ===== STEP 2: Deploy Periphery Contracts =====
  
  // SwapRouter - Executes token swaps through Algebra pools
  // Handles single and multi-hop swaps with slippage protection
  // Constructor params: (_factory, _WNative)
  // - _factory: Address of the Algebra factory
  // - _WNative: Wrapped native token (e.g., WETH) for native token swaps
  console.log("\n📦 Deploying SwapRouter...");
  const wNative = options.wNative || ethers.ZeroAddress;
  const Router = await ethers.getContractFactory(ALGEBRA_ARTIFACTS.Router, deployer);
  const router = await Router.deploy(factoryAddress, wNative);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✅ Router deployed: ${routerAddress}`);

  // Quoter - Provides swap price quotes without state changes
  // Used to preview swap outcomes before execution
  // Returns expected output amounts and gas estimates
  console.log("\n📦 Deploying Quoter...");
  const Quoter = await ethers.getContractFactory(ALGEBRA_ARTIFACTS.Quoter, deployer);
  const quoter = await Quoter.deploy(factoryAddress);
  await quoter.waitForDeployment();
  const quoterAddress = await quoter.getAddress();
  console.log(`✅ Quoter deployed: ${quoterAddress}`);

  // NonfungiblePositionManager (NFPM) - Manages liquidity positions as ERC-721 NFTs
  // Each liquidity position is represented by a unique NFT
  // Handles minting, burning, and modifying liquidity positions
  // Constructor params: (_factory, _WNativeToken)
  console.log("\n📦 Deploying NonfungiblePositionManager...");
  const NFPM = await ethers.getContractFactory(ALGEBRA_ARTIFACTS.NFPM, deployer);
  const nfpm = await NFPM.deploy(factoryAddress, wNative);
  await nfpm.waitForDeployment();
  const nfpmAddress = await nfpm.getAddress();
  console.log(`✅ NFPM deployed: ${nfpmAddress}`);

  // ===== STEP 3: Prepare deployment data =====
  
  const deploymentData = {
    chainId: Number(network.chainId),
    networkName: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      poolDeployer: poolDeployerAddress,
      factory: factoryAddress,
      router: routerAddress,
      quoter: quoterAddress,
      nfpm: nfpmAddress,
    },
    config: {
      communityVault,
      wNative,
    },
  };

  // ===== STEP 4: Save deployment data to file (optional) =====
  
  if (options.saveDeployment !== false) {
    const outputDir = options.outputDir || path.join(__dirname, "../../deployments");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `${network.name}_algebra.json`);
    fs.writeFileSync(outputFile, JSON.stringify(deploymentData, null, 2));
    console.log(`\n💾 Deployment data saved to: ${outputFile}`);
  }

  console.log("\n✅ Algebra suite deployment complete!\n");

  // Return both contract instances and addresses for flexibility
  return {
    contracts: {
      poolDeployer,
      factory,
      router,
      quoter,
      nfpm,
    },
    addresses: deploymentData.contracts,
    deploymentData,
  };
}

/**
 * Standalone script execution
 * Runs when this file is executed directly (not imported as a module)
 */
async function main() {
  try {
    const result = await deployAlgebraSuite({
      saveDeployment: true,
    });
    console.log("Deployment successful!");
    return result;
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Execute main() if this script is run directly
if (require.main === module) {
  main();
}

module.exports = {
  deployAlgebraSuite,
  ALGEBRA_ARTIFACTS,
};


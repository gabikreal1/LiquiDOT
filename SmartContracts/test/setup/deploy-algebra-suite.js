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

// Paths to pre-compiled Algebra artifacts from npm packages
// These packages come with pre-compiled bytecode and ABIs
const ALGEBRA_ARTIFACT_PATHS = {
  PoolDeployer: path.join(__dirname, "../../node_modules/@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json"),
  Factory: path.join(__dirname, "../../node_modules/@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json"),
  Router: path.join(__dirname, "../../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  Quoter: path.join(__dirname, "../../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json"),
  NFPM: path.join(__dirname, "../../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};

/**
 * Load a contract factory from a pre-compiled artifact
 * @param {string} artifactPath - Path to the artifact JSON file
 * @param {Signer} signer - Signer to use for deployment
 * @returns {ContractFactory} Contract factory ready for deployment
 */
function getContractFactoryFromArtifact(artifactPath, signer) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
}

/**
 * Load existing deployment state or create new
 */
function loadDeploymentState(outputDir) {
  const stateFile = path.join(outputDir, "algebra-deployment-state.json");
  if (fs.existsSync(stateFile)) {
    console.log("📂 Found existing deployment state, will resume from checkpoint...\n");
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  }
  return { deployed: {} };
}

/**
 * Save deployment checkpoint
 */
function saveDeploymentState(state, outputDir) {
  const stateFile = path.join(outputDir, "algebra-deployment-state.json");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Deploys the complete Algebra protocol suite
 * 
 * Deployment order is critical:
 * 1. PoolDeployer first (with zero address for factory initially)
 * 2. Factory second (with PoolDeployer address)
 * 3. Set Factory address in PoolDeployer
 * 4. Periphery contracts (Router, Quoter, NFPM) - depend on Factory
 * 
 * Supports resuming from checkpoints if deployment fails partway through.
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

  // Load existing deployment state for checkpointing
  const outputDir = options.outputDir || path.join(__dirname, "../../deployments");
  const deploymentState = loadDeploymentState(outputDir);

  // ===== STEP 1: Predict PoolDeployer address and deploy Factory =====
  let factory, factoryAddress, poolDeployer, poolDeployerAddress;
  
  if (deploymentState.deployed.factory && deploymentState.deployed.poolDeployer) {
    console.log(`♻️  Using existing Factory: ${deploymentState.deployed.factory}`);
    console.log(`♻️  Using existing PoolDeployer: ${deploymentState.deployed.poolDeployer}`);
    factoryAddress = deploymentState.deployed.factory;
    poolDeployerAddress = deploymentState.deployed.poolDeployer;
    const Factory = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Factory, deployer);
    const PoolDeployer = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.PoolDeployer, deployer);
    factory = Factory.attach(factoryAddress);
    poolDeployer = PoolDeployer.attach(poolDeployerAddress);
  } else {
    // Get current nonce
    const currentNonce = await deployer.getNonce();
    console.log(`📍 Current nonce: ${currentNonce}`);
    
    // Calculate addresses: Factory will be at nonce, PoolDeployer at nonce+1
    const predictedFactoryAddress = ethers.getCreateAddress({
      from: deployer.address,
      nonce: currentNonce
    });
    const predictedPoolDeployerAddress = ethers.getCreateAddress({
      from: deployer.address,
      nonce: currentNonce + 1
    });
    
    console.log(`📍 Predicted Factory address: ${predictedFactoryAddress}`);
    console.log(`📍 Predicted PoolDeployer address: ${predictedPoolDeployerAddress}`);
    
    // Deploy Factory first (will use predicted PoolDeployer address)
    console.log("\n📦 Deploying AlgebraFactory...");
    const Factory = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Factory, deployer);
    factory = await Factory.deploy(predictedPoolDeployerAddress);
    await factory.waitForDeployment();
    factoryAddress = await factory.getAddress();
    
    if (factoryAddress !== predictedFactoryAddress) {
      throw new Error(`Factory address mismatch! Expected ${predictedFactoryAddress}, got ${factoryAddress}`);
    }
    console.log(`✅ Factory deployed: ${factoryAddress}`);
    
    // Save checkpoint
    deploymentState.deployed.factory = factoryAddress;
    saveDeploymentState(deploymentState, outputDir);
    
    // Deploy PoolDeployer second (will use Factory address)
    console.log("\n📦 Deploying AlgebraPoolDeployer...");
    const PoolDeployer = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.PoolDeployer, deployer);
    poolDeployer = await PoolDeployer.deploy(factoryAddress);
    await poolDeployer.waitForDeployment();
    poolDeployerAddress = await poolDeployer.getAddress();
    
    if (poolDeployerAddress !== predictedPoolDeployerAddress) {
      throw new Error(`PoolDeployer address mismatch! Expected ${predictedPoolDeployerAddress}, got ${poolDeployerAddress}`);
    }
    console.log(`✅ PoolDeployer deployed: ${poolDeployerAddress}`);
    
    // Save checkpoint
    deploymentState.deployed.poolDeployer = poolDeployerAddress;
    saveDeploymentState(deploymentState, outputDir);
    
    console.log("\n✅ Factory and PoolDeployer correctly linked!");
  }

  // ===== STEP 4: Deploy Periphery Contracts =====
  const wNative = options.wNative || ethers.ZeroAddress;
  
  // SwapRouter - Executes token swaps through Algebra pools
  let router, routerAddress;
  if (deploymentState.deployed.router) {
    console.log(`\n♻️  Using existing SwapRouter: ${deploymentState.deployed.router}`);
    routerAddress = deploymentState.deployed.router;
    const Router = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Router, deployer);
    router = Router.attach(routerAddress);
  } else {
    console.log("\n📦 Deploying SwapRouter...");
    const Router = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Router, deployer);
    router = await Router.deploy(factoryAddress, wNative, poolDeployerAddress);
    await router.waitForDeployment();
    routerAddress = await router.getAddress();
    console.log(`✅ Router deployed: ${routerAddress}`);
    
    deploymentState.deployed.router = routerAddress;
    saveDeploymentState(deploymentState, outputDir);
  }

  // Quoter - Provides swap price quotes without state changes
  let quoter, quoterAddress;
  if (deploymentState.deployed.quoter) {
    console.log(`\n♻️  Using existing Quoter: ${deploymentState.deployed.quoter}`);
    quoterAddress = deploymentState.deployed.quoter;
    const Quoter = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Quoter, deployer);
    quoter = Quoter.attach(quoterAddress);
  } else {
    console.log("\n📦 Deploying Quoter...");
    const Quoter = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Quoter, deployer);
    quoter = await Quoter.deploy(factoryAddress, wNative, poolDeployerAddress);
    await quoter.waitForDeployment();
    quoterAddress = await quoter.getAddress();
    console.log(`✅ Quoter deployed: ${quoterAddress}`);
    
    deploymentState.deployed.quoter = quoterAddress;
    saveDeploymentState(deploymentState, outputDir);
  }

  // NonfungiblePositionManager (NFPM) - Manages liquidity positions as ERC-721 NFTs
  let nfpm, nfpmAddress;
  if (deploymentState.deployed.nfpm) {
    console.log(`\n♻️  Using existing NFPM: ${deploymentState.deployed.nfpm}`);
    nfpmAddress = deploymentState.deployed.nfpm;
    const NFPM = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.NFPM, deployer);
    nfpm = NFPM.attach(nfpmAddress);
  } else {
    console.log("\n📦 Deploying NonfungiblePositionManager...");
    const NFPM = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.NFPM, deployer);
    nfpm = await NFPM.deploy(factoryAddress, wNative, ethers.ZeroAddress, poolDeployerAddress);
    await nfpm.waitForDeployment();
    nfpmAddress = await nfpm.getAddress();
    console.log(`✅ NFPM deployed: ${nfpmAddress}`);
    
    deploymentState.deployed.nfpm = nfpmAddress;
    saveDeploymentState(deploymentState, outputDir);
  }

  // ===== STEP 5: Prepare deployment data =====
  
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
      wNative,
    },
  };

  // ===== STEP 6: Save final deployment data and clean up checkpoint =====
  
  if (options.saveDeployment !== false) {
    const outputFile = path.join(outputDir, `${network.name}_algebra.json`);
    fs.writeFileSync(outputFile, JSON.stringify(deploymentData, null, 2));
    console.log(`\n💾 Deployment data saved to: ${outputFile}`);
    
    // Clean up checkpoint file on successful completion
    const checkpointFile = path.join(outputDir, "algebra-deployment-state.json");
    if (fs.existsSync(checkpointFile)) {
      fs.unlinkSync(checkpointFile);
      console.log(`🗑️  Checkpoint file removed (deployment complete)`);
    }
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
  getContractFactoryFromArtifact,
  ALGEBRA_ARTIFACT_PATHS,
};


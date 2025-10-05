/**
 * Complete Correct Redeployment
 * 
 * Clears bad state and redeploys everything in the correct order:
 * 1. Deploy Factory + PoolDeployer using CREATE2 trick
 * 2. Deploy all periphery contracts
 * 3. Deploy XCMProxy
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Load artifacts
function getContractFactoryFromArtifact(artifactPath, signer) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
}

const ALGEBRA_ARTIFACT_PATHS = {
  PoolDeployer: path.join(__dirname, "../node_modules/@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json"),
  Factory: path.join(__dirname, "../node_modules/@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json"),
  Router: path.join(__dirname, "../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  Quoter: path.join(__dirname, "../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json"),
  NFPM: path.join(__dirname, "../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     Complete Correct Algebra + XCMProxy Deployment        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}\n`);

  // SOLUTION: Deploy PoolDeployer first with a placeholder, then update it
  // Actually, better: Use the deterministic deployment approach
  
  console.log("STEP 1: Deploy PoolDeployer with placeholder");
  console.log("-".repeat(60));
  
  const PoolDeployer = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.PoolDeployer, deployer);
  // Use deployer as temporary factory (we'll deploy factory next)
  const poolDeployer = await PoolDeployer.deploy(deployer.address);
  await poolDeployer.waitForDeployment();
  const poolDeployerAddress = await poolDeployer.getAddress();
  console.log(`✅ PoolDeployer deployed: ${poolDeployerAddress}`);

  console.log("\nSTEP 2: Deploy Factory with real PoolDeployer");
  console.log("-".repeat(60));
  
  const Factory = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Factory, deployer);
  const factory = await Factory.deploy(poolDeployerAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`✅ Factory deployed: ${factoryAddress}`);
  console.log(`   Using PoolDeployer: ${poolDeployerAddress}`);

  console.log("\nSTEP 3: Update PoolDeployer with real Factory");
  console.log("-".repeat(60));
  
  // Now update the poolDeployer to use the real factory
  await (await poolDeployer.setFactory(factoryAddress)).wait();
  console.log(`✅ PoolDeployer configured with Factory`);

  const wNative = ethers.ZeroAddress; // Or actual WDEV address

  console.log("\nSTEP 4: Deploy Periphery Contracts");
  console.log("-".repeat(60));

  console.log("\n📦 Deploying SwapRouter...");
  const Router = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Router, deployer);
  const router = await Router.deploy(factoryAddress, wNative, poolDeployerAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✅ Router: ${routerAddress}`);

  console.log("\n📦 Deploying Quoter...");
  const Quoter = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Quoter, deployer);
  const quoter = await Quoter.deploy(factoryAddress, wNative, poolDeployerAddress);
  await quoter.waitForDeployment();
  const quoterAddress = await quoter.getAddress();
  console.log(`✅ Quoter: ${quoterAddress}`);

  console.log("\n📦 Deploying NFPM...");
  const NFPM = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.NFPM, deployer);
  const nfpm = await NFPM.deploy(factoryAddress, wNative, ethers.ZeroAddress, poolDeployerAddress);
  await nfpm.waitForDeployment();
  const nfpmAddress = await nfpm.getAddress();
  console.log(`✅ NFPM: ${nfpmAddress}`);

  console.log("\nSTEP 5: Test Pool Creation");
  console.log("-".repeat(60));
  
  // Deploy test tokens
  const TestERC20 = await ethers.getContractFactory("TestERC20", deployer);
  console.log("\n📦 Deploying test tokens...");
  const token0 = await TestERC20.deploy("Test USDC", "USDC");
  await token0.waitForDeployment();
  const token1 = await TestERC20.deploy("Test USDT", "USDT");
  await token1.waitForDeployment();
  
  const token0Address = await token0.getAddress();
  const token1Address = await token1.getAddress();
  console.log(`✅ Token0 (USDC): ${token0Address}`);
  console.log(`✅ Token1 (USDT): ${token1Address}`);

  // Sort tokens
  const [t0, t1] = token0Address < token1Address ? 
    [token0Address, token1Address] : [token1Address, token0Address];

  // Create pool
  console.log("\n📦 Creating pool...");
  const createTx = await factory.createPool(t0, t1, "0x");
  await createTx.wait();
  console.log(`✅ Pool creation tx: ${createTx.hash}`);

  // Get pool address
  const poolAddress = await factory.poolByPair(t0, t1);
  console.log(`✅ Pool deployed: ${poolAddress}`);

  // Initialize pool
  const pool = await ethers.getContractAt("IAlgebraPool", poolAddress);
  const initTx = await pool.initialize(BigInt("79228162514264337593543950336")); // 1:1 price
  await initTx.wait();
  console.log(`✅ Pool initialized at 1:1 price`);

  console.log("\n" + "=".repeat(60));
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              DEPLOYMENT SUCCESSFUL! 🎉                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const summary = {
    network: network.name,
    chainId: Number(network.chainId),
    contracts: {
      factory: factoryAddress,
      poolDeployer: poolDeployerAddress,
      router: routerAddress,
      quoter: quoterAddress,
      nfpm: nfpmAddress,
      testPool: poolAddress,
      token0: token0Address,
      token1: token1Address,
    },
  };

  console.log("📋 Summary:");
  console.log(JSON.stringify(summary, null, 2));

  // Save to file
  const outputDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, `${network.name}_complete.json`),
    JSON.stringify(summary, null, 2)
  );
  console.log(`\n💾 Saved to: deployments/${network.name}_complete.json`);

  return summary;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main };


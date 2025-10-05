/**
 * Debug Pool Setup - Check why NFPM can't mint to our pool
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

function loadArtifact(artifactPath) {
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           Debug Pool Setup                                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  // Load deployment
  const deploymentFile = path.join(__dirname, `../deployments/${network.name}_algebra.json`);
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found.");
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const factoryAddress = deployment.contracts.factory;
  const poolDeployerAddress = deployment.contracts.poolDeployer;
  const nfpmAddress = deployment.contracts.nfpm;
  
  console.log("Deployed Contracts:");
  console.log(`  Factory: ${factoryAddress}`);
  console.log(`  PoolDeployer: ${poolDeployerAddress}`);
  console.log(`  NFPM: ${nfpmAddress}\n`);
  
  // Load contracts
  const factoryArtifact = loadArtifact(
    path.join(__dirname, "../node_modules/@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json")
  );
  const factory = new ethers.Contract(factoryAddress, factoryArtifact.abi, deployer);
  
  const nfpmArtifact = loadArtifact(
    path.join(__dirname, "../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json")
  );
  const nfpm = new ethers.Contract(nfpmAddress, nfpmArtifact.abi, deployer);
  
  // Check NFPM configuration
  console.log("NFPM Configuration:");
  const nfpmFactory = await nfpm.factory();
  const nfpmPoolDeployer = await nfpm.poolDeployer();
  const nfpmWNative = await nfpm.WNativeToken();
  
  console.log(`  Factory: ${nfpmFactory}`);
  console.log(`  PoolDeployer: ${nfpmPoolDeployer}`);
  console.log(`  WNative: ${nfpmWNative}\n`);
  
  if (nfpmFactory.toLowerCase() !== factoryAddress.toLowerCase()) {
    console.error("❌ NFPM Factory mismatch!");
    console.error(`   Expected: ${factoryAddress}`);
    console.error(`   Got: ${nfpmFactory}`);
  } else {
    console.log("✅ NFPM Factory matches");
  }
  
  if (nfpmPoolDeployer.toLowerCase() !== poolDeployerAddress.toLowerCase()) {
    console.error("❌ NFPM PoolDeployer mismatch!");
    console.error(`   Expected: ${poolDeployerAddress}`);
    console.error(`   Got: ${nfpmPoolDeployer}`);
  } else {
    console.log("✅ NFPM PoolDeployer matches");
  }
  
  // Check Factory configuration
  console.log("\nFactory Configuration:");
  const defaultCommunityFee = await factory.defaultCommunityFee();
  console.log(`  Default Community Fee: ${defaultCommunityFee}`);
  
  // Try to get pool deployer from factory
  try {
    const factoryPoolDeployer = await factory.poolDeployer();
    console.log(`  PoolDeployer: ${factoryPoolDeployer}`);
    
    if (factoryPoolDeployer.toLowerCase() !== poolDeployerAddress.toLowerCase()) {
      console.error("❌ Factory PoolDeployer mismatch!");
    } else {
      console.log("✅ Factory PoolDeployer matches");
    }
  } catch (e) {
    console.log(`  ⚠️  Could not read factory.poolDeployer(): ${e.message}`);
  }
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  Recommendation: Use Algebra's official pool creation UI   ║");
  console.log("║  or interact via their SDK instead of raw contract calls   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Debug failed:", error);
      process.exit(1);
    });
}

module.exports = { main };


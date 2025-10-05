/**
 * Fix Factory Deployment
 * 
 * Redeploys AlgebraFactory with the correct PoolDeployer address.
 * The first deployment used deployer address as poolDeployer (wrong),
 * so we need to deploy a new Factory with the real PoolDeployer.
 */

const { ethers } = require("hardhat");
const { getContractFactoryFromArtifact, ALGEBRA_ARTIFACT_PATHS } = require("../test/setup/deploy-algebra-suite");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("\n=== Fixing AlgebraFactory Deployment ===");
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}\n`);

  // Load existing deployment
  const stateFile = path.join(__dirname, "../deployments/algebra-deployment-state.json");
  let state = {};
  if (fs.existsSync(stateFile)) {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  }

  // Get existing PoolDeployer address
  const poolDeployerAddress = state.deployed?.poolDeployer;
  if (!poolDeployerAddress) {
    console.error("❌ PoolDeployer not found in deployment state!");
    console.log("   Run the main deployment first.");
    process.exit(1);
  }

  console.log(`✓ Found existing PoolDeployer: ${poolDeployerAddress}`);

  // Deploy NEW Factory with correct PoolDeployer address
  console.log("\n📦 Deploying NEW AlgebraFactory with correct PoolDeployer...");
  const Factory = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Factory, deployer);
  const factory = await Factory.deploy(poolDeployerAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  
  console.log(`✅ New Factory deployed: ${factoryAddress}`);
  console.log(`   Using PoolDeployer: ${poolDeployerAddress}`);

  // Update state
  state.deployed = state.deployed || {};
  state.deployed.factoryOld = state.deployed.factory; // Save old address
  state.deployed.factory = factoryAddress;
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log("\n💾 Updated deployment state");

  // Now need to redeploy periphery contracts with new Factory
  console.log("\n⚠️  IMPORTANT: Periphery contracts need to be redeployed!");
  console.log("   Run: node scripts/redeploy-periphery.js");
  
  return { factoryAddress, poolDeployerAddress };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Failed:", error);
      process.exit(1);
    });
}

module.exports = { main };


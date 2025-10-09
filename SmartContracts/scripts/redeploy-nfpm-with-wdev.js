/**
 * Redeploy NFPM with proper WDEV token
 * 
 * The original NFPM was deployed with zero address for wNative
 * This redeploys it with a proper WDEV contract
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        Redeploy NFPM with WDEV                              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}\n`);

  // Load existing deployment
  const algebraFile = path.join(__dirname, `../deployments/${network.name}_algebra.json`);
  const algebra = JSON.parse(fs.readFileSync(algebraFile, "utf8"));
  
  const factoryAddress = algebra.contracts.factory;
  const poolDeployerAddress = algebra.contracts.poolDeployer;

  console.log("Existing Contracts:");
  console.log(`  Factory: ${factoryAddress}`);
  console.log(`  PoolDeployer: ${poolDeployerAddress}`);
  console.log(`  Old NFPM: ${algebra.contracts.nfpm} (deployed with wNative = 0x0)\n`);

  // ===== STEP 1: Deploy WDEV =====
  console.log("STEP 1: Deploy WDEV");
  console.log("=".repeat(60));

  const WDEV = await ethers.getContractFactory("WDEV");
  const wdev = await WDEV.deploy();
  await wdev.waitForDeployment();
  const wdevAddress = await wdev.getAddress();
  console.log(`✅ WDEV deployed: ${wdevAddress}\n`);

  // ===== STEP 2: Deploy NEW NFPM with WDEV =====
  console.log("STEP 2: Deploy NEW NFPM");
  console.log("=".repeat(60));

  // Load NFPM artifact
  const nfpmArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
      "utf8"
    )
  );

  const NFPM = new ethers.ContractFactory(nfpmArtifact.abi, nfpmArtifact.bytecode, deployer);
  
  console.log("📦 Deploying NonfungiblePositionManager with:");
  console.log(`   Factory: ${factoryAddress}`);
  console.log(`   WNative: ${wdevAddress}`);
  console.log(`   TokenDescriptor: ${ethers.ZeroAddress}`);
  console.log(`   PoolDeployer: ${poolDeployerAddress}`);

  const nfpm = await NFPM.deploy(
    factoryAddress,
    wdevAddress,  // Use real WDEV instead of zero address!
    ethers.ZeroAddress,  // Token descriptor (optional)
    poolDeployerAddress
  );

  await nfpm.waitForDeployment();
  const nfpmAddress = await nfpm.getAddress();
  console.log(`✅ NEW NFPM deployed: ${nfpmAddress}\n`);

  // ===== STEP 3: Update deployment file =====
  algebra.contracts.nfpm = nfpmAddress;
  algebra.contracts.wdev = wdevAddress;
  algebra.config.wNative = wdevAddress;
  algebra.timestamp = new Date().toISOString();

  fs.writeFileSync(algebraFile, JSON.stringify(algebra, null, 2));
  console.log(`✅ Updated ${algebraFile}\n`);

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║              NFPM REDEPLOYED! 🎉                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n✅ WDEV: ${wdevAddress}`);
  console.log(`✅ NEW NFPM: ${nfpmAddress}`);
  console.log(`\n🎯 Now try test-nfpm-direct.js again with the new NFPM!`);

  return {
    wdev: wdevAddress,
    nfpm: nfpmAddress
  };
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




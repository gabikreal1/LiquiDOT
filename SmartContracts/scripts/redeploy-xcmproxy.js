/**
 * XCMProxy Redeploy Script
 * 
 * Deploys a new XCMProxy contract using existing Algebra DEX infrastructure.
 * Updates the bootstrap file with the new address.
 * 
 * Usage:
 *   npx hardhat run scripts/redeploy-xcmproxy.js --network moonbase
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Moonbase Alpha XCM precompile addresses
const MOONBASE_PRECOMPILES = {
  xcmPallet: "0x000000000000000000000000000000000000081A",
  xcmTransactor: "0x0000000000000000000000000000000000000806",
};

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║         XCMProxy Redeploy Script (Moonbase Alpha)          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Load existing bootstrap
  const bootstrapPath = path.join(__dirname, "../deployments/moonbase_bootstrap.json");
  const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, "utf-8"));
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Deployment Info:");
  console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`   Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} DEV\n`);

  // Extract existing config
  const algebraAddresses = bootstrap.algebra;
  const oldConfig = bootstrap.xcmProxy;
  
  console.log("📦 Using existing Algebra DEX:");
  console.log(`   Factory: ${algebraAddresses.factory}`);
  console.log(`   Router: ${algebraAddresses.router}`);
  console.log(`   Quoter: ${algebraAddresses.quoter}`);
  console.log(`   NFPM: ${algebraAddresses.nfpm}\n`);
  
  console.log("📦 Previous XCMProxy config:");
  console.log(`   Old Address: ${oldConfig.address}`);
  console.log(`   Operator: ${oldConfig.operator}`);
  console.log(`   AssetHub ParaId: ${oldConfig.assetHubParaId}`);
  console.log(`   Trusted XCM Caller: ${oldConfig.trustedXcmCaller}\n`);

  // Deploy new XCMProxy
  console.log("🚀 Deploying new XCMProxy...");
  const XCMProxy = await ethers.getContractFactory("XCMProxy");
  const proxy = await XCMProxy.deploy(deployer.address);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`   ✅ Deployed at: ${proxyAddress}\n`);

  // Configure with same settings as before
  console.log("⚙️ Configuring XCMProxy...");
  
  // Set integrations (quoter, router)
  let tx = await proxy.setIntegrations(algebraAddresses.quoter, algebraAddresses.router);
  await tx.wait();
  console.log("   ✓ Set Quoter and Router");
  
  // Set NFPM
  tx = await proxy.setNFPM(algebraAddresses.nfpm);
  await tx.wait();
  console.log("   ✓ Set NFPM");
  
  // Set operator
  tx = await proxy.setOperator(oldConfig.operator);
  await tx.wait();
  console.log(`   ✓ Set Operator: ${oldConfig.operator}`);
  
  // Set XCM precompile (PalletXcm)
  tx = await proxy.setXcmPrecompile(MOONBASE_PRECOMPILES.xcmPallet);
  await tx.wait();
  console.log("   ✓ Set XCM Precompile");

  // Set XCM Transactor precompile
  tx = await proxy.setXcmTransactorPrecompile(MOONBASE_PRECOMPILES.xcmTransactor);
  await tx.wait();
  console.log("   ✓ Set XCM Transactor Precompile");

  // Set Asset Hub ParaId
  tx = await proxy.setAssetHubParaId(oldConfig.assetHubParaId);
  await tx.wait();
  console.log(`   ✓ Set Asset Hub ParaId: ${oldConfig.assetHubParaId}`);
  
  // Set default slippage
  tx = await proxy.setDefaultSlippageBps(oldConfig.defaultSlippageBps);
  await tx.wait();
  console.log(`   ✓ Set Default Slippage: ${oldConfig.defaultSlippageBps} bps`);
  
  // Set trusted XCM caller
  if (oldConfig.trustedXcmCaller && oldConfig.trustedXcmCaller !== ethers.ZeroAddress) {
    tx = await proxy.setTrustedXcmCaller(oldConfig.trustedXcmCaller);
    await tx.wait();
    console.log(`   ✓ Set Trusted XCM Caller: ${oldConfig.trustedXcmCaller}`);
  }
  
  // Enable test mode
  tx = await proxy.setTestMode(true);
  await tx.wait();
  console.log("   ✓ Enabled Test Mode");
  
  // Add supported tokens
  for (const token of bootstrap.tokens) {
    tx = await proxy.addSupportedToken(token.address);
    await tx.wait();
    console.log(`   ✓ Added supported token: ${token.symbol} (${token.address})`);
  }

  // Update bootstrap file
  console.log("\n📝 Updating bootstrap file...");
  bootstrap.xcmProxy.address = proxyAddress;
  bootstrap.xcmProxy.previousAddress = oldConfig.address;
  bootstrap.generatedAt = new Date().toISOString();
  
  fs.writeFileSync(bootstrapPath, JSON.stringify(bootstrap, null, 2));
  console.log("   ✓ Updated moonbase_bootstrap.json");

  console.log("\n" + "=".repeat(60));
  console.log("✅ XCMProxy Redeployment Complete!");
  console.log("=".repeat(60));
  console.log(`\nNew XCMProxy Address: ${proxyAddress}`);
  console.log(`Old XCMProxy Address: ${oldConfig.address}`);
  console.log("\n⚠️  Remember to:");
  console.log("   1. Fund the new proxy with test tokens");
  console.log("   2. Update AssetHubVault if needed (setChainExecutor)");
  console.log("   3. Run tests to verify functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

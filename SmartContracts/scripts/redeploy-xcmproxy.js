/**
 * Moonbase Alpha XCMProxy-Only Redeployment Script
 * 
 * This script redeploys ONLY the XCMProxy contract, reusing the existing Algebra DEX suite
 * and test tokens from the previous deployment (moonbase_bootstrap.json).
 * 
 * Usage:
 *   npx hardhat run scripts/redeploy-xcmproxy.js --network moonbase
 */

const { ethers } = require("hardhat");
const { deployXCMProxy } = require("../test/helpers/deploy-xcm-proxy");
const fs = require("fs");
const path = require("path");

// Moonbase Alpha XCM precompile addresses
const MOONBASE_PRECOMPILES = {
  xTokens: "0x0000000000000000000000000000000000000804",
  xcmTransactor: "0x0000000000000000000000000000000000000806",
};

const ASSET_HUB_PARAID = 1000;

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║      LiquiDOT Moonbase Alpha XCMProxy Redeployment        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Deployment Info:");
  console.log(`   Network: ${network.name}`);
  console.log(`   Deployer: ${deployer.address}`);

  // Load existing bootstrap data
  const bootstrapPath = path.join(process.cwd(), "deployments", "moonbase_bootstrap.json");
  if (!fs.existsSync(bootstrapPath)) {
    throw new Error("Bootstrap file not found! Run full deployment first.");
  }
  const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, "utf8"));
  
  console.log("\n♻️  Reusing Existing Infrastructure:");
  console.log(`   Algebra Factory: ${bootstrap.algebra.factory}`);
  console.log(`   SwapRouter: ${bootstrap.algebra.router}`);
  console.log(`   Quoter: ${bootstrap.algebra.quoter}`);
  console.log(`   NFPM: ${bootstrap.algebra.nfpm}`);

  // ===== Deploy XCMProxy =====
  console.log("\n🚀 Deploying Updated XCMProxy...");
  
  const xcmpResult = await deployXCMProxy({
    owner: deployer.address,
    operator: bootstrap.xcmProxy.operator || deployer.address,
    quoter: bootstrap.algebra.quoter,
    router: bootstrap.algebra.router,
    nfpm: bootstrap.algebra.nfpm,
    xtokensPrecompile: MOONBASE_PRECOMPILES.xTokens,
    xcmTransactor: MOONBASE_PRECOMPILES.xcmTransactor,
    assetHubParaId: bootstrap.xcmProxy.assetHubParaId || ASSET_HUB_PARAID,
    defaultSlippageBps: bootstrap.xcmProxy.defaultSlippageBps || 100,
    trustedCaller: bootstrap.xcmProxy.trustedXcmCaller || ethers.ZeroAddress,
    supportedTokens: [], 
    freezeConfig: false,
    saveState: false, // We'll update the bootstrap file manually
  });

  const xcmProxy = xcmpResult.proxy;
  const xcmProxyAddress = xcmpResult.address;

  // Enable test mode
  let tx = await xcmProxy.setTestMode(true);
  await tx.wait();
  console.log(`   ✓ XCMProxy deployed at ${xcmProxyAddress} (test mode enabled)`);

  // Add supported tokens from previous deployment
  if (bootstrap.tokens && bootstrap.tokens.length > 0) {
    console.log("\n🔗 Re-linking Supported Tokens...");
    for (const token of bootstrap.tokens) {
        console.log(`   Adding ${token.symbol} (${token.address})...`);
        const addTx = await xcmProxy.addSupportedToken(token.address);
        await addTx.wait();
    }
  }

  // Update bootstrap file
  bootstrap.xcmProxy.address = xcmProxyAddress;
  bootstrap.generatedAt = new Date().toISOString();
  
  fs.writeFileSync(bootstrapPath, JSON.stringify(bootstrap, null, 2));
  console.log(`\n💾 Updated bootstrap file: ${bootstrapPath}`);
  
  console.log("\n✅ Redeployment complete!");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Deployment failed:", error);
      process.exit(1);
    });
}

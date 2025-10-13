/**
 * Deploy XCMProxy to Moonbase Alpha
 * 
 * This script deploys XCMProxy with the new constructor (initialOwner)
 * and provides next steps for configuration.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-xcmproxy-moonbase.js --network moonbase
 * 
 * Prerequisites:
 * 1. Set MOON_PK in .env file
 * 2. Fund account with DEV tokens from https://faucet.moonbeam.network/
 * 3. Have AssetHub address ready for configuration
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Deploying XCMProxy to Moonbase Alpha...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📋 Deployment Details:");
  console.log("  Network:", network.name);
  console.log("  Chain ID:", network.chainId);
  console.log("  Deployer:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("  Balance:", ethers.formatEther(balance), "DEV\n");

  if (balance === 0n) {
    console.error("❌ Error: Deployer has no balance!");
    console.error("   Get DEV tokens from: https://faucet.moonbeam.network/");
    process.exit(1);
  }

  // Deploy XCMProxy with new constructor (initialOwner)
  console.log("📦 Deploying XCMProxy contract...");
  const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
  
  console.log("   Constructor parameter: initialOwner =", deployer.address);
  const xcmProxy = await XCMProxy.deploy(deployer.address);
  
  console.log("   Waiting for deployment...");
  await xcmProxy.waitForDeployment();

  const address = await xcmProxy.getAddress();
  const deployTx = xcmProxy.deploymentTransaction();

  console.log("✅ XCMProxy deployed successfully!\n");
  console.log("📍 Contract Address:", address);
  if (deployTx) {
    console.log("   Deployment Tx:", deployTx.hash);
  }

  // Verify initial state
  console.log("\n🔍 Verifying Initial State:");
  const owner = await xcmProxy.owner();
  const operator = await xcmProxy.operator();
  const testMode = await xcmProxy.testMode();
  const paused = await xcmProxy.paused();

  console.log("   Owner:", owner);
  console.log("   Operator:", operator);
  console.log("   Test Mode:", testMode);
  console.log("   Paused:", paused);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    contract: "XCMProxy",
    address: address,
    deployer: deployer.address,
    owner: owner,
    operator: operator,
    timestamp: new Date().toISOString(),
    deploymentTx: deployTx ? deployTx.hash : "N/A",
    blockNumber: deployTx ? deployTx.blockNumber : "N/A"
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to JSON file
  const filename = path.join(deploymentsDir, `xcmproxy-moonbase-${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved:", filename);

  // Configuration guide
  console.log("\n" + "=".repeat(70));
  console.log("📝 NEXT STEPS - Configuration Required");
  console.log("=".repeat(70));

  console.log("\n1️⃣  Set XCM Parameters:");
  console.log("   ----------------------------------------");
  console.log("   await xcmProxy.setXTokensPrecompile('0x0000000000000000000000000000000000000804')");
  console.log("   await xcmProxy.setAssetHubParaId(1000)");
  console.log("   await xcmProxy.setDefaultDestWeight(6000000000n)");

  console.log("\n2️⃣  Set Operator (can execute investments):");
  console.log("   ----------------------------------------");
  console.log("   await xcmProxy.setOperator('YOUR_OPERATOR_ADDRESS')");

  console.log("\n3️⃣  Set Trusted XCM Caller (AssetHub address):");
  console.log("   ----------------------------------------");
  console.log("   await xcmProxy.setTrustedXcmCaller('ASSETHUB_ADDRESS_ON_PASEO')");

  console.log("\n4️⃣  Add Supported Tokens:");
  console.log("   ----------------------------------------");
  console.log("   await xcmProxy.addSupportedToken('WDEV_ADDRESS')");
  console.log("   await xcmProxy.addSupportedToken('OTHER_TOKEN_ADDRESS')");

  console.log("\n5️⃣  Set Algebra DEX Integrations (if available):");
  console.log("   ----------------------------------------");
  console.log("   await xcmProxy.setIntegrations('QUOTER_ADDRESS', 'ROUTER_ADDRESS')");
  console.log("   await xcmProxy.setNFPM('NFPM_ADDRESS')");

  console.log("\n6️⃣  Enable Test Mode (for testing):");
  console.log("   ----------------------------------------");
  console.log("   await xcmProxy.setTestMode(true)");

  console.log("\n7️⃣  Update AssetHub with this address:");
  console.log("   ----------------------------------------");
  console.log("   On AssetHub, call:");
  console.log("   await assetHub.addChain(");
  console.log("     1287,                                        // Moonbase chainId");
  console.log("     '0x0001000100a10f041300c10f030400010300',  // XCM destination");
  console.log("     'Moonbase Alpha',                           // Chain name");
  console.log("     '" + address + "'  // This XCMProxy address");
  console.log("   )");

  console.log("\n" + "=".repeat(70));
  console.log("📚 Documentation");
  console.log("=".repeat(70));
  console.log("See XCMPROXY_CONFIG_VALUES.md for detailed configuration guide");
  console.log("See REMIX_DEPLOYMENT_GUIDE.md for AssetHub deployment");

  console.log("\n✅ Deployment Complete!\n");

  return {
    xcmProxy,
    address,
    deploymentInfo
  };
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Deployment failed:");
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

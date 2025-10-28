const hre = require("hardhat");

async function main() {
  const ASSETHUB_ADDRESS = process.env.ASSETHUB_CONTRACT;
  const XCMPROXY_ADDRESS = process.env.XCMPROXY_CONTRACT;

  if (!ASSETHUB_ADDRESS || !XCMPROXY_ADDRESS) {
    console.error("\n❌ Error: Both ASSETHUB_CONTRACT and XCMPROXY_CONTRACT must be set!");
    console.error("   $env:ASSETHUB_CONTRACT=\"0xYourAssetHubAddress\"");
    console.error("   $env:XCMPROXY_CONTRACT=\"0xYourXCMProxyAddress\"\n");
    process.exit(1);
  }

  console.log("\n🔗 Linking Contracts");
  console.log("=".repeat(70));
  console.log(`   AssetHubVault: ${ASSETHUB_ADDRESS}`);
  console.log(`   XCMProxy: ${XCMPROXY_ADDRESS}`);
  console.log(`   Network: ${hre.network.name}`);
  console.log("=".repeat(70) + "\n");

  const [signer] = await hre.ethers.getSigners();
  console.log(`Using signer: ${signer.address}\n`);

  // Determine which network we're on
  const networkName = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  if (networkName === "passethub" || chainId === 420420422n) {
    // ===== CONFIGURE ASSETHUB (On Paseo) =====
    await configureAssetHub(ASSETHUB_ADDRESS, XCMPROXY_ADDRESS, signer);
  } else if (networkName === "moonbase" || chainId === 1287n) {
    // ===== CONFIGURE XCMPROXY (On Moonbase) =====
    await configureXCMProxy(XCMPROXY_ADDRESS, ASSETHUB_ADDRESS, signer);
  } else {
    console.error(`\n❌ Error: Unknown network "${networkName}" (chainId: ${chainId})`);
    console.error("   This script must be run on either:");
    console.error("   - passethub (Asset Hub testnet)");
    console.error("   - moonbase (Moonbase Alpha)\n");
    process.exit(1);
  }

  console.log("\n✅ Configuration complete!\n");
  
  // Show next steps
  if (networkName === "passethub" || chainId === 420420422n) {
    console.log("📋 Next Steps:");
    console.log("   1. Switch to Moonbase network");
    console.log("   2. Run this script again:");
    console.log("      npx hardhat run test/helpers/link-contracts.js --network moonbase\n");
  } else {
    console.log("🎉 Both contracts are now linked!");
    console.log("\n📋 Next Steps:");
    console.log("   1. Verify configuration:");
    console.log("      npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub");
    console.log("   2. Run testnet tests:");
    console.log("      npx hardhat test test/AssetHubVault/testnet/2.deposits.test.js --network passethub");
    console.log("   3. Test integration flow with guided settlement\n");
  }
}

async function configureAssetHub(assetHubAddress, xcmProxyAddress, signer) {
  console.log("📝 Configuring AssetHubVault on Paseo Asset Hub...\n");

  const AssetHubVault = await hre.ethers.getContractFactory(
    "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
  );
  const vault = AssetHubVault.attach(assetHubAddress);

  // Verify we're authorized (admin or owner)
  let admin;
  try {
    admin = await vault.admin();
  } catch (_) {
    admin = await vault.owner();
  }
  if (admin.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`❌ Error: Signer ${signer.address} is not authorized (${admin})`);
    console.error("   Only admin/owner can add chains\n");
    process.exit(1);
  }

  console.log(`✅ Verified authorization: ${admin}\n`);

  // Check if Moonbase already added
  const existingChain = await vault.supportedChains(1287);
  
  if (existingChain.active) {
    console.log("⚠️  Moonbase Alpha already in chain registry!");
    console.log(`   Proxy Address: ${existingChain.proxyAddress}`);
    console.log(`   Name: ${existingChain.name}`);
    console.log(`   XCM Destination: ${existingChain.xcmDestination}`);
    
    if (existingChain.proxyAddress.toLowerCase() !== xcmProxyAddress.toLowerCase()) {
      console.log("\n⚠️  WARNING: Existing proxy address differs from provided address!");
      console.log(`   Existing: ${existingChain.proxyAddress}`);
      console.log(`   Provided: ${xcmProxyAddress}`);
      console.log("\n   To update, first remove the chain then re-add it:");
      console.log("   await vault.removeChain(1287)");
      console.log("   await vault.addChain(...)");
    }
    
    return;
  }

  // Add Moonbase to chain registry
  console.log("Adding Moonbase Alpha to chain registry...");
  
  // Moonbase Alpha XCM multilocation (from Polkadot Asset Hub perspective)
  // This is the XCM destination for Moonbase parachain
  const moonbaseXcmDestination = "0x0001000100a10f041300c10f030400010300";
  
  console.log("   Chain ID: 1287");
  console.log(`   XCM Destination: ${moonbaseXcmDestination}`);
  console.log("   Name: Moonbase Alpha");
  console.log(`   Proxy Address: ${xcmProxyAddress}`);

  const tx = await vault.addChain(
    1287,
    moonbaseXcmDestination,
    "Moonbase Alpha",
    xcmProxyAddress
  );

  console.log(`\n   Transaction hash: ${tx.hash}`);
  console.log("   Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

  // Verify
  const chainInfo = await vault.supportedChains(1287);
  console.log("\n✅ Moonbase Alpha added successfully!");
  console.log("   Verification:");
  console.log(`   - Active: ${chainInfo.active}`);
  console.log(`   - Proxy: ${chainInfo.proxyAddress}`);
  console.log(`   - Name: ${chainInfo.name}`);
  console.log(`   - XCM Destination: ${chainInfo.xcmDestination}`);
}

async function configureXCMProxy(xcmProxyAddress, assetHubAddress, signer) {
  console.log("📝 Configuring XCMProxy on Moonbase Alpha...\n");

  const XCMProxy = await hre.ethers.getContractFactory(
    "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
  );
  const proxy = XCMProxy.attach(xcmProxyAddress);

  // Verify we're owner
  const owner = await proxy.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`❌ Error: Signer ${signer.address} is not owner (${owner})`);
    console.error("   Only owner can set trusted XCM caller\n");
    process.exit(1);
  }

  console.log(`✅ Verified owner role: ${owner}\n`);

  // Check if trusted caller already set
  const existingCaller = await proxy.trustedXcmCaller();
  
  if (existingCaller !== hre.ethers.ZeroAddress) {
    console.log("⚠️  Trusted XCM caller already set!");
    console.log(`   Current: ${existingCaller}`);
    
    if (existingCaller.toLowerCase() === assetHubAddress.toLowerCase()) {
      console.log("   ✅ Already set to AssetHubVault address - no action needed");
      return;
    } else {
      console.log(`   ⚠️  Different from AssetHub: ${assetHubAddress}`);
      console.log("\n   Updating to AssetHub address...");
    }
  }

  // Set AssetHub as trusted XCM caller
  console.log("Setting AssetHubVault as trusted XCM caller...");
  console.log(`   AssetHub Address: ${assetHubAddress}`);

  const tx = await proxy.setTrustedXcmCaller(assetHubAddress);

  console.log(`\n   Transaction hash: ${tx.hash}`);
  console.log("   Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

  // Verify
  const newCaller = await proxy.trustedXcmCaller();
  console.log("\n✅ Trusted XCM caller set successfully!");
  console.log(`   Verification: ${newCaller}`);
  
  if (newCaller.toLowerCase() !== assetHubAddress.toLowerCase()) {
    console.error("\n❌ Error: Verification failed!");
    console.error(`   Expected: ${assetHubAddress}`);
    console.error(`   Got: ${newCaller}`);
    process.exit(1);
  }

  // Also check test mode
  const testMode = await proxy.testMode();
  console.log(`\n   Test Mode: ${testMode}`);
  
  if (testMode) {
    console.log("   ✅ Test mode enabled - safe for testing");
  } else {
    console.log("   ⚠️  Production mode - XCM will be attempted");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

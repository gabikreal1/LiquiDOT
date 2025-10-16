/**
 * Add Moonbase Chain Configuration to AssetHubVault
 * 
 * This script adds the Moonbase Alpha chain as a supported destination
 * for investment dispatch via XCM.
 * 
 * Usage:
 *   npx hardhat run scripts/add-moonbase-chain.js --network passethub
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔧 Adding Moonbase Chain Configuration to AssetHubVault\n");

  // Get contract address from environment
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;
  if (!VAULT_ADDRESS || VAULT_ADDRESS === ethers.ZeroAddress) {
    throw new Error("❌ ASSETHUB_CONTRACT not set in .env");
  }

  // Get signer (must be admin)
  const [admin] = await ethers.getSigners();
  console.log(`📝 Admin address: ${admin.address}`);

  // Attach to deployed contract
  const AssetHubVault = await ethers.getContractFactory(
    "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
  );
  const vault = AssetHubVault.attach(VAULT_ADDRESS);

  // Verify admin
  const contractAdmin = await vault.admin();
  if (contractAdmin.toLowerCase() !== admin.address.toLowerCase()) {
    throw new Error(`❌ Not admin! Contract admin: ${contractAdmin}, Your address: ${admin.address}`);
  }

  console.log(`✅ Confirmed admin access\n`);

  // ==========================================
  // Moonbase Alpha Chain Configuration
  // ==========================================
  
  const chainConfig = {
    chainId: 1287, // Use Moonbase's actual parachain ID
    name: "Moonbase Alpha",
    
    // XCM MultiLocation for Moonbase Alpha from Asset Hub perspective
    // { parents: 1, interior: X1(Parachain(1000)) }
    // Encoded as SCALE bytes
    xcmDestination: ethers.hexlify(
      ethers.concat([
        "0x01", // parents: 1
        "0x01", // interior: X1
        "0x00", // Parachain selector
        ethers.toBeHex(1287, 4) // paraId: 1287 as 4 bytes
      ])
    ),
    
    // Optional: Set executor address (use XCMProxy contract on Moonbase)
    executor: process.env.XCMPROXY_CONTRACT || ethers.ZeroAddress
  };

  console.log("📋 Chain Configuration:");
  console.log("========================");
  console.log(`Chain ID: ${chainConfig.chainId}`);
  console.log(`Name: ${chainConfig.name}`);
  console.log(`XCM Destination: ${chainConfig.xcmDestination}`);
  console.log(`Executor: ${chainConfig.executor}`);
  console.log("");

  // Add chain configuration
  console.log("🚀 Submitting addChain transaction...");
  
  const tx = await vault.addChain(
    chainConfig.chainId,
    chainConfig.xcmDestination,
    chainConfig.name,
    chainConfig.executor
  );

  console.log(`⏳ Transaction submitted: ${tx.hash}`);
  console.log("⏳ Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

  // Verify the chain was added
  console.log("\n🔍 Verifying chain configuration...");
  
  const chainInfo = await vault.supportedChains(chainConfig.chainId);
  console.log("\n📊 Stored Chain Info:");
  console.log("====================");
  console.log(`Supported: ${chainInfo.supported}`);
  console.log(`Chain Name: ${chainInfo.chainName}`);
  console.log(`XCM Destination: ${chainInfo.xcmDestination}`);
  console.log(`Timestamp: ${new Date(Number(chainInfo.timestamp) * 1000).toISOString()}`);

  const executor = await vault.chainExecutors(chainConfig.chainId);
  if (executor !== ethers.ZeroAddress) {
    console.log(`Executor: ${executor}`);
  }

  if (chainInfo.supported) {
    console.log("\n✅ Moonbase chain successfully added!");
  } else {
    console.log("\n⚠️  Chain not properly configured");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ MOONBASE CHAIN CONFIGURATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`\nYou can now dispatch investments to Moonbase Alpha (chainId: ${chainConfig.chainId})`);
  console.log("\nNext steps:");
  console.log("  1. Ensure users have deposited funds");
  console.log("  2. Test dispatchInvestment in test mode");
  console.log("  3. Verify XCMProxy receives messages");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

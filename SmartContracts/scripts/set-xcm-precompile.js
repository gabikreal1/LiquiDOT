/**
 * Set XCM Precompile Address for AssetHubVault
 * 
 * Sets the XCM precompile contract address required for cross-chain operations.
 * The XCM precompile on Paseo Asset Hub is at a fixed address.
 * 
 * Usage:
 *   npx hardhat run scripts/set-xcm-precompile.js --network passethub
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔧 Setting XCM Precompile Address for AssetHubVault\n");

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

  // XCM Precompile address on Paseo Asset Hub
  // This is a standard precompile address for XCM operations
  const XCM_PRECOMPILE = "0x0000000000000000000000000000000000000816";

  console.log("📋 XCM Precompile Configuration:");
  console.log("=================================");
  console.log(`Precompile Address: ${XCM_PRECOMPILE}`);
  console.log(`Network: Paseo Asset Hub`);
  console.log("");

  // Check current value
  const currentPrecompile = await vault.XCM_PRECOMPILE();
  console.log(`Current XCM Precompile: ${currentPrecompile}`);

  if (currentPrecompile === XCM_PRECOMPILE) {
    console.log("✅ XCM Precompile already set correctly!");
    console.log("   No transaction needed.");
    return;
  }

  // Set XCM precompile
  console.log("\n🚀 Submitting setXcmPrecompile transaction...");
  
  const tx = await vault.setXcmPrecompile(XCM_PRECOMPILE);

  console.log(`⏳ Transaction submitted: ${tx.hash}`);
  console.log("⏳ Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

  // Verify the change
  const newPrecompile = await vault.XCM_PRECOMPILE();
  console.log(`\n🔍 New XCM Precompile: ${newPrecompile}`);

  if (newPrecompile === XCM_PRECOMPILE) {
    console.log("✅ XCM Precompile successfully set!");
  } else {
    console.log("⚠️  Warning: Value mismatch!");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ XCM PRECOMPILE CONFIGURATION COMPLETE");
  console.log("=".repeat(60));
  console.log("\nThe contract can now:");
  console.log("  • Build XCM messages for cross-chain transfers");
  console.log("  • Dispatch investments to Moonbase");
  console.log("  • Execute XCM calls (when test mode is disabled)");
  console.log("\nNext steps:");
  console.log("  1. Ensure chain is added (Moonbase)");
  console.log("  2. Test investment dispatch in test mode");
  console.log("  3. Verify position creation");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

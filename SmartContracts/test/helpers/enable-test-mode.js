const hre = require("hardhat");

async function main() {
  const ASSETHUB_ADDRESS = process.env.ASSETHUB_CONTRACT || process.env.ASSETHUB_ADDRESS;

  if (!ASSETHUB_ADDRESS) {
    console.error("\n❌ Error: AssetHub address not set!");
    console.error("   Set ASSETHUB_CONTRACT or ASSETHUB_ADDRESS in .env\n");
    process.exit(1);
  }

  console.log("\n🔧 Enabling Test Mode on AssetHubVault");
  console.log("=".repeat(70));
  console.log(`   Contract: ${ASSETHUB_ADDRESS}`);
  console.log(`   Network: ${hre.network.name}`);

  const [signer] = await hre.ethers.getSigners();
  console.log(`   Signer: ${signer.address}`);
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH`);
  console.log("=".repeat(70) + "\n");

  // Attach to deployed contract
  const AssetHubVault = await hre.ethers.getContractFactory(
    "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault"
  );
  const vault = AssetHubVault.attach(ASSETHUB_ADDRESS);

  // Check current test mode
  console.log("📊 Current State:");
  const currentTestMode = await vault.testMode();
  console.log(`   Test Mode: ${currentTestMode}`);

  if (currentTestMode) {
    console.log("\n✅ Test mode is already enabled!");
    console.log("   No action needed.\n");
    return;
  }

  // Check if signer is admin
  const admin = await vault.admin();
  console.log(`   Admin: ${admin}`);

  if (admin.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`\n❌ Error: Signer is not admin!`);
    console.error(`   Current signer: ${signer.address}`);
    console.error(`   Required admin: ${admin}`);
    console.error("\n   Switch to the admin account and try again.\n");
    process.exit(1);
  }

  console.log(`   ✅ Signer is admin\n`);

  // Enable test mode
  console.log("🚀 Enabling test mode...");
  const tx = await vault.setTestMode(true);
  
  console.log(`   Transaction hash: ${tx.hash}`);
  console.log("   Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}\n`);

  // Verify
  const newTestMode = await vault.testMode();
  console.log("✅ Test Mode Enabled!");
  console.log(`   Verification: ${newTestMode}`);

  if (!newTestMode) {
    console.error("\n❌ Error: Test mode not enabled after transaction!");
    console.error("   Something went wrong.\n");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(70));
  console.log("  SUCCESS!");
  console.log("=".repeat(70));
  console.log("\n✅ Test mode is now enabled on AssetHubVault");
  console.log("   XCM calls will be skipped (safe for testing)");
  console.log("\n📋 Next Steps:");
  console.log("   1. Run config check to verify:");
  console.log("      npx hardhat test test/AssetHubVault/testnet/1.config-check.test.js --network passethub");
  console.log("\n   2. Continue with testing plan:");
  console.log("      See QUICK_START_TESTNET.md for next steps\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

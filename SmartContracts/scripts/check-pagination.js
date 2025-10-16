const { ethers } = require("hardhat");

async function main() {
  const VAULT_ADDRESS = process.env.ASSETHUB_CONTRACT;
  console.log(`\nChecking contract at: ${VAULT_ADDRESS}\n`);

  const vault = await ethers.getContractAt(
    "contracts/V1(Current)/AssetHubVault.sol:AssetHubVault",
    VAULT_ADDRESS
  );

  const [signer] = await ethers.getSigners();
  
  try {
    const count = await vault.getUserPositionCount(signer.address);
    console.log("✅ Pagination functions available!");
    console.log(`   Position count: ${count.toString()}\n`);
    
    // Try stats function
    const stats = await vault.getUserPositionStats(signer.address);
    console.log("✅ Stats function available!");
    console.log(`   Total: ${stats.total}, Pending: ${stats.pending}, Active: ${stats.active}, Liquidated: ${stats.liquidated}\n`);
    
    return true;
  } catch (e) {
    console.log("❌ Pagination functions NOT available");
    console.log("   Error:", e.message.split('\n')[0]);
    console.log("\n   🔧 Contract needs to be redeployed with pagination functions\n");
    return false;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

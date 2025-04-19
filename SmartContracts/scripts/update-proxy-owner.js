const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Updating XCMProxy owner on Moonbase Alpha...");

  // Check if we have the necessary addresses in the environment variables
  const proxyAddress = process.env.PROXY_ADDRESS;
  const assetHubAddress = process.env.ASSET_HUB_ADDRESS;

  if (!proxyAddress) {
    console.error("ERROR: PROXY_ADDRESS not found in .env file");
    process.exit(1);
  }

  if (!assetHubAddress) {
    console.error("ERROR: ASSET_HUB_ADDRESS not found in .env file");
    process.exit(1);
  }

  console.log(`XCMProxy address: ${proxyAddress}`);
  console.log(`AILiquidityProvider address: ${assetHubAddress}`);

  // Get the proxy contract interface
  const proxy = await hre.ethers.getContractAt("XCMProxy", proxyAddress);
  
  // Get the current owner for verification
  const currentOwner = await proxy.owner();
  console.log(`Current proxy owner: ${currentOwner}`);

  // Update the owner to the AILiquidityProvider address
  const tx = await proxy.setOwner(assetHubAddress);
  await tx.wait();

  // Verify the owner has been updated
  const newOwner = await proxy.owner();
  console.log(`New proxy owner: ${newOwner}`);

  if (newOwner.toLowerCase() === assetHubAddress.toLowerCase()) {
    console.log("✅ Owner updated successfully!");
  } else {
    console.error("❌ Owner update failed. Please check the addresses and try again.");
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
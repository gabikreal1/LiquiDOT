const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Deploying AILiquidityProvider to Asset Hub (Westmint)...");

  // Get the contract factory
  const AILiquidityProvider = await hre.ethers.getContractFactory("AILiquidityProvider");

  // Check if we have a proxy address in the environment variables
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) {
    console.error("ERROR: PROXY_ADDRESS not found in .env file");
    console.error("Please deploy the XCMProxy to Moonbase first using deploy-proxy-to-moonbase.js");
    process.exit(1);
  }

  // Initial XCM fee amount - you may want to adjust this based on current network conditions
  const initialXcmFeeAmount = hre.ethers.parseEther("0.1"); // 0.1 native token as fee

  console.log(`Using XCM Proxy address: ${proxyAddress}`);
  console.log(`Initial XCM fee amount: ${initialXcmFeeAmount}`);

  // Deploy the contract
  const liquidityProvider = await AILiquidityProvider.deploy(proxyAddress, initialXcmFeeAmount);
  await liquidityProvider.deploymentTransaction().wait();

  console.log(`AILiquidityProvider deployed to Asset Hub at: ${liquidityProvider.target}`);
  console.log(`Run this command to save the Asset Hub contract address to your .env file:`);
  console.log(`echo "ASSET_HUB_ADDRESS=${liquidityProvider.target}" >> .env`);

  // Now update the proxy owner to the AILiquidityProvider address
  console.log("\nNext steps:");
  console.log("1. Run the following command to update the proxy owner:");
  console.log(`npx hardhat run scripts/update-proxy-owner.js --network moonbase`);
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

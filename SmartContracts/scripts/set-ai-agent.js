const hre = require("hardhat");
require("dotenv").config();

async function main() {
  // Check if we have the Asset Hub contract address
  const assetHubAddress = process.env.ASSET_HUB_ADDRESS;
  if (!assetHubAddress) {
    console.error("ERROR: ASSET_HUB_ADDRESS not found in .env file");
    process.exit(1);
  }

  // Get the address to set as AI agent (you can also specify this in .env)
  const [deployer] = await hre.ethers.getSigners();
  // Default to the deployer address if AI_AGENT_ADDRESS is not set
  const aiAgentAddress = process.env.AI_AGENT_ADDRESS || deployer.address;

  console.log(`Asset Hub Contract: ${assetHubAddress}`);
  console.log(`Setting AI Agent address to: ${aiAgentAddress}`);

  // Get the AILiquidityProvider contract
  const aiLiquidityProvider = await hre.ethers.getContractAt("AILiquidityProvider", assetHubAddress);

  // Call the setAIAgent function
  const tx = await aiLiquidityProvider.setAIAgent(aiAgentAddress);
  await tx.wait();

  console.log(`✅ AI Agent address set to ${aiAgentAddress}`);
  console.log("You can now call addLiquidity() from this address.");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
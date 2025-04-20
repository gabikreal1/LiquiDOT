const { ethers, network } = require("hardhat");
require("dotenv").config();

async function main() {
  try {
    // Check if we have the Asset Hub contract address
    const assetHubAddress = process.env.ASSET_HUB_ADDRESS;
    if (!assetHubAddress) {
      console.error("ERROR: ASSET_HUB_ADDRESS not found in .env file");
      process.exit(1);
    }

    // Get the address to set as AI agent (you can also specify this in .env)
    const [deployer] = await ethers.getSigners();
    
    console.log("Network:", network.name);
    console.log("Account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));
    
    // Default to the deployer address if AI_AGENT_ADDRESS is not set
    const aiAgentAddress = process.env.AI_AGENT_ADDRESS || deployer.address;

    console.log(`Asset Hub Contract: ${assetHubAddress}`);
    console.log(`Setting AI Agent address to: ${aiAgentAddress}`);

    // Get the AILiquidityProvider contract
    const aiLiquidityProvider = await ethers.getContractAt("AILiquidityProvider", assetHubAddress);
    
    // Check if contract exists
    const code = await deployer.provider.getCode(assetHubAddress);
    if (code === '0x') {
      console.error("No contract found at the specified address!");
      process.exit(1);
    }
    
    console.log("Contract verified at address. Attempting to call setAIAgent...");

    // Try with a much higher gas limit for Asset Hub's higher gas costs
    const gasLimit = 29000000; // 1 million gas
    console.log(`Using gas limit: ${gasLimit}`);
    
    // Call the setAIAgent function with lower gas limit and explicit gasPrice
    const tx = await aiLiquidityProvider.setAIAgent(aiAgentAddress, {
      gasLimit: gasLimit,
      gasPrice: 1000000000000000
    });
    
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for transaction confirmation...");
    
    await tx.wait();

    console.log(`✅ AI Agent address set to ${aiAgentAddress}`);
    console.log("You can now call addLiquidity() from this address.");
  } catch (error) {
    console.error("Detailed error:");
    console.error(error);
    
    if (error.error) {
      console.error("Inner error:", error.error);
    }
    
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Top-level error:", error);
    process.exit(1);
  });
  
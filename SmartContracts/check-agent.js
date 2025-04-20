// Check the current AI agent without trying to set it
// Run with: node check-agent.js
const { ethers } = require('ethers');
require('dotenv').config();

// Minimal ABI for just reading the aiAgent address
const ABI = [
  {
    "inputs": [],
    "name": "aiAgent",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main() {
  try {
    // Create provider
    const providerUrl = "https://westend-asset-hub-eth-rpc.polkadot.io";
    const provider = new ethers.JsonRpcProvider(providerUrl);
    console.log(`Connected to: ${providerUrl}`);

    // Contract address
    const contractAddress = process.env.ASSET_HUB_ADDRESS;
    if (!contractAddress) {
      console.error("ERROR: ASSET_HUB_ADDRESS not found in .env file");
      process.exit(1);
    }
    console.log(`Contract: ${contractAddress}`);

    // Create contract interface (no need for signer for read-only)
    const contract = new ethers.Contract(contractAddress, ABI, provider);
    
    // Check current AI agent
    try {
      const currentAgent = await contract.aiAgent();
      console.log(`Current AI agent: ${currentAgent}`);
      
      // Check if it's zero address
      if (currentAgent === '0x0000000000000000000000000000000000000000') {
        console.log("⚠️ AI agent is not set (zero address)");
      } else {
        console.log("✅ AI agent is already set to a non-zero address");
      }
      
      // If you want to check against the address you're trying to set
      const aiAgentAddress = process.env.AI_AGENT_ADDRESS;
      if (aiAgentAddress) {
        if (currentAgent.toLowerCase() === aiAgentAddress.toLowerCase()) {
          console.log("✅ The AI agent is already set to your desired address");
        } else {
          console.log(`ℹ️ The current AI agent is different from your desired address (${aiAgentAddress})`);
        }
      }
      
    } catch (error) {
      console.error("Failed to get current AI agent:", error.message);
    }
  } catch (error) {
    console.error("Script error:", error.message);
  }
}

main(); 
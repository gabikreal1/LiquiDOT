// Diagnostic script to check why the function is reverting
// Run with: node call-test.js
const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABI - just the setAIAgent function and aiAgent getter
const ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_aiAgent",
        "type": "address"
      }
    ],
    "name": "setAIAgent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
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

    // Create wallet
    const privateKey = process.env.ASSET;
    if (!privateKey) {
      console.error("ERROR: PRIVATE_KEY not found in .env file");
      process.exit(1);
    }
    
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Account: ${wallet.address}`);

    // Contract address
    const contractAddress = process.env.ASSET_HUB_ADDRESS;
    if (!contractAddress) {
      console.error("ERROR: ASSET_HUB_ADDRESS not found in .env file");
      process.exit(1);
    }
    console.log(`Contract: ${contractAddress}`);

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, ABI, wallet);
    
    // Check current AI agent
    try {
      const currentAgent = await contract.aiAgent();
      console.log(`Current AI agent: ${currentAgent}`);
    } catch (error) {
      console.error("Failed to get current AI agent:", error.message);
    }
    
    // Check if caller is owner
    try {
      const contractOwner = await contract.owner();
      console.log(`Contract owner: ${contractOwner}`);
      
      if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`WARNING: You (${wallet.address}) are not the owner (${contractOwner})`);
      } else {
        console.log("✅ You are the contract owner");
      }
    } catch (error) {
      console.error("Failed to check owner:", error.message);
    }

    // Check if the function will revert with static call
    console.log("\nDiagnosing setAIAgent function...");
    const aiAgentAddress = process.env.AI_AGENT_ADDRESS || wallet.address;
    
    try {
      // This will check if the function would revert without sending a transaction
      await contract.setAIAgent.staticCall(aiAgentAddress);
      console.log("✅ Static call successful - function should work");
    } catch (error) {
      console.error("❌ Static call failed - function will revert:");
      console.error("  Reason:", error.message);
    }
    
    // Try getting the revert reason using a custom provider call
    try {
      console.log("\nAttempting to get detailed revert reason...");
      const callData = contract.interface.encodeFunctionData("setAIAgent", [aiAgentAddress]);
      
      const callResult = await provider.call({
        to: contractAddress,
        data: callData,
        from: wallet.address
      });
      
      console.log("Call result:", callResult);
    } catch (error) {
      console.log("Detailed error info:", error);
      
      // Try to decode the revert reason if available
      if (error && error.data) {
        try {
          const decodedError = contract.interface.parseError(error.data);
          console.log("Decoded error:", decodedError);
        } catch (e) {
          console.log("Could not decode error data");
        }
      }
    }
  } catch (error) {
    console.error("Script error:", error.message);
  }
}

main(); 
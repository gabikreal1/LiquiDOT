// Direct interaction with Asset Hub using ethers.js
// Run with: node direct-set-agent.js
const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABI - just the setAIAgent function
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
    
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} WND`);

    // Contract address
    const contractAddress = process.env.ASSET_HUB_ADDRESS;
    if (!contractAddress) {
      console.error("ERROR: ASSET_HUB_ADDRESS not found in .env file");
      process.exit(1);
    }
    console.log(`Contract: ${contractAddress}`);

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, ABI, wallet);
    
    // Check if caller is owner
    try {
      const contractOwner = await contract.owner();
      console.log(`Contract owner: ${contractOwner}`);
      
      if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`ERROR: You (${wallet.address}) are not the owner (${contractOwner})`);
        process.exit(1);
      } else {
        console.log("✅ You are the contract owner");
      }
    } catch (error) {
      console.error("Couldn't check owner, proceeding anyway:", error.message);
    }

    // Set AI agent address
    const aiAgentAddress = process.env.AI_AGENT_ADDRESS || wallet.address;
    console.log(`Setting AI Agent to: ${aiAgentAddress}`);

    // Get nonce
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`Using nonce: ${nonce}`);

    // Get gas price
    const gasPrice = 100000000000000;
    console.log(`Gas price: ${gasPrice.toString()}`);

    // Use a normal contract call with high gas limit
    console.log(`Setting AI Agent to: ${aiAgentAddress} with high gas limit`);
    const tx = await contract.setAIAgent(aiAgentAddress, {
      gasLimit: 100000000000, // 1 million gas
      gasPrice: gasPrice
    });
    
    console.log("Transaction hash:", tx.hash);
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    console.log(`✅ AI Agent address set to ${aiAgentAddress}`);
  } catch (error) {
    console.error("Error details:");
    console.error(error.message);
    
    if (error.error) {
      console.error("Inner error:", error.error);
    }
  }
}

main(); 
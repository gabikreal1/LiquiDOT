// Direct manual transaction to set AI agent
// Run with: node manual-set-agent.js
const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  try {
    // Create provider
    const providerUrl = "https://westend-asset-hub-eth-rpc.polkadot.io";
    const provider = new ethers.JsonRpcProvider(providerUrl);
    console.log(`Connected to: ${providerUrl}`);

    // Create wallet
    const privateKey = process.env.ASSET;
    if (!privateKey) {
      console.error("ERROR: ASSET not found in .env file");
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

    // AI Agent address (default to wallet address if not provided)
    const aiAgentAddress = process.env.AI_AGENT_ADDRESS || wallet.address;
    
    // Manually create the function signature and encode parameters
    // Function signature: setAIAgent(address)
    // keccak256("setAIAgent(address)") = 0x6ebe941b42f92be83d9f41a72d85304a4fcdc147af666ef344abcf0bb6d35dee
    // Function selector: first 4 bytes = 0x6ebe941b
    
    // Encode the address parameter (pad to 32 bytes)
    const encodedAddress = ethers.zeroPadValue(aiAgentAddress, 32);
    
    // Full call data = function selector + encoded parameters
    const data = '0x6ebe941b' + encodedAddress.substring(2); // remove 0x from encodedAddress
    
    console.log("Generated transaction data:", data);
    console.log("Setting AI Agent to:", aiAgentAddress);
    
    // Get nonce and gas price
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`Using nonce: ${nonce}`);
    
    // Construct the transaction
    const txData = {
      to: contractAddress,
      data: data,
      gasLimit: 30000000,
      gasPrice: 10000000000000,
      nonce: nonce
    };
    
    console.log("Sending transaction with parameters:", txData);
    
    // Sign and send
    const tx = await wallet.sendTransaction(txData);
    console.log("Transaction hash:", tx.hash);
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Transaction status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // If successful
    if (receipt.status === 1) {
      console.log(`✅ AI Agent address set to ${aiAgentAddress}`);
    } else {
      console.error("❌ Transaction failed");
    }
  } catch (error) {
    console.error("Error details:", error.message);
    
    if (error.transaction) {
      console.error("Transaction:", error.transaction);
    }
    if (error.receipt) {
      console.error("Receipt:", error.receipt);
    }
  }
}

main(); 
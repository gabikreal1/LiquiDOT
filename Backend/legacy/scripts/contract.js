import { ethers } from 'ethers';

// Connect to an EVM-compatible parachain (Moonbeam/Moonbase Alpha testnet)
const provider = new ethers.providers.WebSocketProvider('wss://wss.api.moonbase.moonbeam.network');

// Your contract ABI - you need to get this from your compiled contract
const contractABI = [
	[
		{
			"inputs": [],
			"name": "retrieve",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "num",
					"type": "uint256"
				}
			],
			"name": "store",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		}
	]
];

// Your contract address on the EVM parachain
const contractAddress = '0x1A5ccdE94578f6E0301F36b2B86Ebf08a777D3ad'; // Replace with actual deployed address

// Create a contract instance
const contract = new ethers.Contract(contractAddress, contractABI, provider);

// To send transactions, you need a wallet with funds
// const privateKey = '0xYourPrivateKey'; // Never hardcode in production
// const wallet = new ethers.Wallet(privateKey, provider);
// const contractWithSigner = contract.connect(wallet);

// Example: Read function call
async function getTokenBalance(tokenAddress) {
  try {
    const balance = await contract.getTokenBalance(tokenAddress);
    console.log(`Token balance: ${balance.toString()}`);
    return balance;
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw error;
  }
}

// Example: Write function call (requires a signer/wallet)
async function depositTokens(tokenAddress, amount) {
  try {
    // const tx = await contractWithSigner.depositTokens(tokenAddress, amount);
    // await tx.wait();
    // console.log('Transaction confirmed:', tx.hash);
    console.log('Function not implemented: requires a signer');
  } catch (error) {
    console.error('Error depositing tokens:', error);
    throw error;
  }
}

export {
  contract,
  getTokenBalance,
  depositTokens
};


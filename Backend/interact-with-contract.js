import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ABI for AILiquidityProvider contract
const AILiquidityProviderABI = [
  // Basic contract info
  "function xcmProxyAddress() view returns (address)",
  "function xcmFeeAmount() view returns (uint256)",
  "function tokenBalances(address) view returns (uint256)",
  "function aiAgent() view returns (address)",
  
  // Admin functions
  "function setAIAgent(address _aiAgent) external",
  "function setXCMProxyAddress(address _xcmProxyAddress) external",
  "function setXCMFeeAmount(uint256 _xcmFeeAmount) external",
  
  // Token management functions
  "function depositTokens(address token, uint256 amount) external",
  "function withdrawTokens(address token, uint256 amount) external",
  "function transferAssetsToMoonbeam(address token, uint256 amount) external",
  
  // Liquidity functions
  "function addLiquidity(address pool, address token0, address token1, uint8 rangeSize, uint128 liquidityDesired) external",
  "function removeLiquidity(address pool, int24 bottomTick, int24 topTick, uint128 liquidity) external",
  
  // Swap functions
  "function swapExactInputSingle(address tokenIn, address tokenOut, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice) external",
  "function swapExactOutputSingle(address tokenIn, address tokenOut, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 limitSqrtPrice) external",
  "function swapExactInput(bytes calldata path, address recipient, uint256 amountIn, uint256 amountOutMinimum) external",
  "function swapExactOutput(bytes calldata path, address recipient, uint256 amountOut, uint256 amountInMaximum) external",
  
  // General XCM execution
  "function executeViaXCM(bytes memory callData) external"
];

// ABI for AILiquidityRouter contract
const AILiquidityRouterABI = [
  "function liquidityProvider() view returns (address)",
  "function setProvider(address _provider) external",
  "function forwardApproval(address token, uint256 amount) external",
  "function batchDeposit(address[] calldata tokens, uint256[] calldata amounts) external",
  "function batchWithdraw(address[] calldata tokens, uint256[] calldata amounts) external"
];

// ABI for ERC20 tokens
const ERC20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) external returns (bool)"
];

// Connect to an EVM-compatible provider (Moonbeam/Moonbase Alpha testnet)
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc.api.moonbase.moonbeam.network');

// Get contract addresses and private key from environment variables
const PROVIDER_CONTRACT_ADDRESS = process.env.PROVIDER_CONTRACT_ADDRESS; 
const ROUTER_CONTRACT_ADDRESS = process.env.ROUTER_CONTRACT_ADDRESS;

// To send transactions, you need a wallet with funds
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Check for required environment variables
if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable is required');
  process.exit(1);
}
if (!PROVIDER_CONTRACT_ADDRESS) {
  console.error('Error: PROVIDER_CONTRACT_ADDRESS environment variable is required');
  process.exit(1);
}
if (!ROUTER_CONTRACT_ADDRESS) {
  console.error('Error: ROUTER_CONTRACT_ADDRESS environment variable is required');
  process.exit(1);
}

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Create contract instances
const providerContract = new ethers.Contract(PROVIDER_CONTRACT_ADDRESS, AILiquidityProviderABI, provider);
const routerContract = new ethers.Contract(ROUTER_CONTRACT_ADDRESS, AILiquidityRouterABI, provider);

// Connected contract instances for sending transactions
const providerWithSigner = providerContract.connect(wallet);
const routerWithSigner = routerContract.connect(wallet);

// Example functions to interact with the contract

// Read contract state
async function getContractInfo() {
  try {
    const xcmProxyAddress = await providerContract.xcmProxyAddress();
    const xcmFeeAmount = await providerContract.xcmFeeAmount();
    const aiAgent = await providerContract.aiAgent();
    
    console.log('Contract Info:');
    console.log('XCM Proxy Address:', xcmProxyAddress);
    console.log('XCM Fee Amount:', xcmFeeAmount.toString());
    console.log('AI Agent Address:', aiAgent);
    
    return { xcmProxyAddress, xcmFeeAmount, aiAgent };
  } catch (error) {
    console.error('Error getting contract info:', error);
    throw error;
  }
}

// Get token balance in the contract
async function getTokenBalance(tokenAddress) {
  try {
    const balance = await providerContract.tokenBalances(tokenAddress);
    console.log(`Token ${tokenAddress} balance:`, balance.toString());
    return balance;
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw error;
  }
}

// Deposit tokens to the liquidity provider
async function depositTokens(tokenAddress, amount) {
  try {
    // First, approve the token transfer
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, wallet);
    const approveTx = await tokenContract.approve(PROVIDER_CONTRACT_ADDRESS, amount);
    await approveTx.wait();
    console.log('Token approval confirmed:', approveTx.hash);
    
    // Then, deposit the tokens
    const tx = await providerWithSigner.depositTokens(tokenAddress, amount);
    await tx.wait();
    console.log('Token deposit confirmed:', tx.hash);
    return tx;
  } catch (error) {
    console.error('Error depositing tokens:', error);
    throw error;
  }
}

// Withdraw tokens from the liquidity provider
async function withdrawTokens(tokenAddress, amount) {
  try {
    const tx = await providerWithSigner.withdrawTokens(tokenAddress, amount);
    await tx.wait();
    console.log('Token withdrawal confirmed:', tx.hash);
    return tx;
  } catch (error) {
    console.error('Error withdrawing tokens:', error);
    throw error;
  }
}

// Transfer assets to Moonbeam via XCM
async function transferAssetsToMoonbeam(tokenAddress, amount) {
  try {
    const tx = await providerWithSigner.transferAssetsToMoonbeam(tokenAddress, amount);
    await tx.wait();
    console.log('Asset transfer to Moonbeam confirmed:', tx.hash);
    return tx;
  } catch (error) {
    console.error('Error transferring assets to Moonbeam:', error);
    throw error;
  }
}

// Add liquidity via the provider
async function addLiquidity(poolAddress, token0Address, token1Address, rangeSize, liquidityDesired) {
  try {
    const tx = await providerWithSigner.addLiquidity(
      poolAddress,
      token0Address,
      token1Address,
      rangeSize, // 0 = NARROW, 1 = MEDIUM, 2 = WIDE, 3 = MAXIMUM
      liquidityDesired
    );
    await tx.wait();
    console.log('Add liquidity transaction confirmed:', tx.hash);
    return tx;
  } catch (error) {
    console.error('Error adding liquidity:', error);
    throw error;
  }
}

// Remove liquidity via the provider
async function removeLiquidity(poolAddress, bottomTick, topTick, liquidity) {
  try {
    const tx = await providerWithSigner.removeLiquidity(
      poolAddress,
      bottomTick,
      topTick,
      liquidity
    );
    await tx.wait();
    console.log('Remove liquidity transaction confirmed:', tx.hash);
    return tx;
  } catch (error) {
    console.error('Error removing liquidity:', error);
    throw error;
  }
}

// Batch deposit tokens via the router
async function batchDeposit(tokenAddresses, amounts) {
  try {
    // First, approve all tokens
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenContract = new ethers.Contract(tokenAddresses[i], ERC20ABI, wallet);
      const approveTx = await tokenContract.approve(ROUTER_CONTRACT_ADDRESS, amounts[i]);
      await approveTx.wait();
      console.log(`Token ${tokenAddresses[i]} approval confirmed:`, approveTx.hash);
    }
    
    // Then, batch deposit
    const tx = await routerWithSigner.batchDeposit(tokenAddresses, amounts);
    await tx.wait();
    console.log('Batch deposit confirmed:', tx.hash);
    return tx;
  } catch (error) {
    console.error('Error batch depositing tokens:', error);
    throw error;
  }
}

// Batch withdraw tokens via the router
async function batchWithdraw(tokenAddresses, amounts) {
  try {
    const tx = await routerWithSigner.batchWithdraw(tokenAddresses, amounts);
    await tx.wait();
    console.log('Batch withdrawal confirmed:', tx.hash);
    return tx;
  } catch (error) {
    console.error('Error batch withdrawing tokens:', error);
    throw error;
  }
}

// Example usage:
async function main() {
  try {
    // Read contract info
    await getContractInfo();
    
    // Example token addresses (replace with actual addresses)
    const token0Address = '0x...';
    const token1Address = '0x...';
    const poolAddress = '0x...';
    
    // Example operations (uncomment as needed)
    
    // Check token balances
    // await getTokenBalance(token0Address);
    // await getTokenBalance(token1Address);
    
    // Deposit tokens
    // const amount0 = ethers.parseUnits('10', 18); // 10 tokens with 18 decimals
    // await depositTokens(token0Address, amount0);
    
    // Add liquidity
    // const liquidityDesired = ethers.parseUnits('5', 18);
    // await addLiquidity(poolAddress, token0Address, token1Address, 2, liquidityDesired);
    
    // Batch deposit
    // const tokens = [token0Address, token1Address];
    // const amounts = [ethers.parseUnits('1', 18), ethers.parseUnits('1', 18)];
    // await batchDeposit(tokens, amounts);
    
    console.log('Interactions completed successfully');
  } catch (error) {
    console.error('Error in main execution:', error);
  }
}

// Uncomment to run the script
// main();

export {
  getContractInfo,
  getTokenBalance,
  depositTokens,
  withdrawTokens,
  transferAssetsToMoonbeam,
  addLiquidity,
  removeLiquidity,
  batchDeposit,
  batchWithdraw
}; 
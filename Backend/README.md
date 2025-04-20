# CrossLiquidity Provider Backend

This directory contains the JavaScript utilities for interacting with the CrossLiquidity smart contracts on Polkadot's EVM parachains (Moonbeam/Moonbase Alpha).

## Files

- `interact-with-contract.js` - Main interaction examples for basic contract functions
- `liquidity-swapper.js` - Advanced examples for token swapping functionality
- `example.js` - Example usage showing how to interact with the contracts
- `.env.example` - Example environment variable configuration

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create an environment file for your secrets:

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file with your actual values
nano .env  # or use any text editor
```

3. Configure your environment variables in the `.env` file:

```
# RPC endpoint (defaults to Moonbase Alpha if not specified)
RPC_URL=https://rpc.api.moonbase.moonbeam.network

# Contract addresses
PROVIDER_CONTRACT_ADDRESS=0x123...  # Your LiquidityProvider address
ROUTER_CONTRACT_ADDRESS=0x456...    # Your LiquidityRouter address

# Your private key (keep this secret!)
PRIVATE_KEY=0x789...

# Example token addresses for testing
TOKEN0_ADDRESS=0xAcc15dC74880C9944775448304B263D191c6077F  # WGLMR on Moonbase Alpha
TOKEN1_ADDRESS=0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080  # xcDOT on Moonbase Alpha
POOL_ADDRESS=0xabc...
```

⚠️ **Security Warning**: 
- Never commit your `.env` file to version control
- Add `.env` to your `.gitignore` file
- Consider using a vault service for production deployments

## Running the Code

### Running the Example Script

The easiest way to test that everything is set up correctly is to run the example script:

```bash
# Make sure you're in the Backend directory
node example.js
```

This script will:
1. Connect to the contracts using your environment variables
2. Get basic contract information
3. Check token balances if TOKEN0_ADDRESS is set
4. Show an example of how to deposit tokens (commented out by default)

### Creating Your Own Scripts

You can create your own scripts by importing the functions from the utility files:

```javascript
// myScript.js
import { ethers } from 'ethers';
import { 
  getContractInfo, 
  addLiquidity,
  depositTokens 
} from './interact-with-contract.js';

async function main() {
  try {
    // Your custom logic here
    const info = await getContractInfo();
    console.log('Contract info:', info);
    
    // Example: Add liquidity (uncomment and modify as needed)
    /*
    const poolAddress = process.env.POOL_ADDRESS;
    const token0 = process.env.TOKEN0_ADDRESS;
    const token1 = process.env.TOKEN1_ADDRESS;
    const rangeSize = 2; // WIDE range
    const liquidityAmount = ethers.parseUnits('1', 18);
    
    await addLiquidity(poolAddress, token0, token1, rangeSize, liquidityAmount);
    */
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

Then run your script:

```bash
node myScript.js
```

## Available Functions

### Basic Contract Interaction (`interact-with-contract.js`)

- `getContractInfo()` - Get basic information about the contract
- `getTokenBalance(tokenAddress)` - Get token balance in the contract
- `depositTokens(tokenAddress, amount)` - Deposit tokens to the liquidity provider
- `withdrawTokens(tokenAddress, amount)` - Withdraw tokens from the liquidity provider
- `transferAssetsToMoonbeam(tokenAddress, amount)` - Transfer assets to Moonbeam via XCM
- `addLiquidity(poolAddress, token0Address, token1Address, rangeSize, liquidityDesired)` - Add liquidity to a pool
- `removeLiquidity(poolAddress, bottomTick, topTick, liquidity)` - Remove liquidity from a pool
- `batchDeposit(tokenAddresses, amounts)` - Batch deposit tokens via the router
- `batchWithdraw(tokenAddresses, amounts)` - Batch withdraw tokens via the router

### Advanced Swapping (`liquidity-swapper.js`)

- `swapExactInputSingle(tokenIn, tokenOut, amountIn, slippage)` - Swap exact input amount of tokens
- `swapExactOutputSingle(tokenIn, tokenOut, amountOut, slippage)` - Swap for exact output amount of tokens
- `swapExactInputMultihop(tokensPath, fees, amountIn, slippage)` - Multi-hop swap with exact input
- `swapExactOutputMultihop(tokensPath, fees, amountOut, slippage)` - Multi-hop swap for exact output

## Usage Examples

### Basic Contract Information

```javascript
// Import functions
import { getContractInfo } from './interact-with-contract.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Get basic contract info
    const info = await getContractInfo();
    console.log('Contract info:', info);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

### Token Operations

```javascript
import { depositTokens, withdrawTokens, getTokenBalance } from './interact-with-contract.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    const tokenAddress = process.env.TOKEN0_ADDRESS;
    if (!tokenAddress) {
      console.error('Error: TOKEN0_ADDRESS not set in environment variables');
      return;
    }
    
    const amount = ethers.parseUnits('10', 18); // 10 tokens with 18 decimals
    console.log(`Working with token address: ${tokenAddress}`);
    
    // Check balance before operations
    const initialBalance = await getTokenBalance(tokenAddress);
    console.log(`Initial balance: ${ethers.formatUnits(initialBalance, 18)} tokens`);
    
    // Deposit tokens
    console.log(`Depositing ${ethers.formatUnits(amount, 18)} tokens...`);
    await depositTokens(tokenAddress, amount);
    
    // Check balance after deposit
    const balanceAfterDeposit = await getTokenBalance(tokenAddress);
    console.log(`Balance after deposit: ${ethers.formatUnits(balanceAfterDeposit, 18)} tokens`);
    
    // Withdraw tokens
    console.log(`Withdrawing ${ethers.formatUnits(amount, 18)} tokens...`);
    await withdrawTokens(tokenAddress, amount);
    
    // Check final balance
    const finalBalance = await getTokenBalance(tokenAddress);
    console.log(`Final balance: ${ethers.formatUnits(finalBalance, 18)} tokens`);
  } catch (error) {
    console.error('Error in token operations:', error);
  }
}

main();
```

### Adding Liquidity

```javascript
import { addLiquidity } from './interact-with-contract.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Get values from environment variables
    const poolAddress = process.env.POOL_ADDRESS;
    const token0 = process.env.TOKEN0_ADDRESS;
    const token1 = process.env.TOKEN1_ADDRESS;
    
    // Validate environment variables
    if (!poolAddress || !token0 || !token1) {
      console.error('Error: Required environment variables not set');
      console.error('Please ensure POOL_ADDRESS, TOKEN0_ADDRESS, and TOKEN1_ADDRESS are set in your .env file');
      return;
    }
    
    const rangeSize = 2;               // 0=NARROW, 1=MEDIUM, 2=WIDE, 3=MAXIMUM
    const liquidity = ethers.parseUnits('5', 18); // Amount of liquidity to add
    
    console.log(`Adding liquidity to pool: ${poolAddress}`);
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    console.log(`Range size: ${rangeSize} (WIDE)`);
    console.log(`Liquidity amount: ${ethers.formatUnits(liquidity, 18)}`);
    
    await addLiquidity(poolAddress, token0, token1, rangeSize, liquidity);
    console.log('Liquidity added successfully!');
  } catch (error) {
    console.error('Error adding liquidity:', error);
  }
}

main();
```

### Token Swaps

```javascript
import { swapExactInputSingle, swapExactInputMultihop } from './liquidity-swapper.js';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Get token addresses from environment variables
    const WGLMR = process.env.TOKEN0_ADDRESS; // Assuming TOKEN0_ADDRESS is WGLMR
    const DOT = process.env.TOKEN1_ADDRESS;   // Assuming TOKEN1_ADDRESS is DOT
    const USDT = process.env.TOKEN2_ADDRESS;  // You would need to add this to your .env file
    
    // Validate environment variables
    if (!WGLMR || !DOT) {
      console.error('Error: Required environment variables not set');
      console.error('Please ensure TOKEN0_ADDRESS and TOKEN1_ADDRESS are set in your .env file');
      return;
    }
    
    console.log('Token addresses:');
    console.log(`WGLMR: ${WGLMR}`);
    console.log(`DOT: ${DOT}`);
    if (USDT) console.log(`USDT: ${USDT}`);
    
    // Simple swap
    const amountIn = ethers.parseUnits('1', 18); // 1 WGLMR
    console.log(`\nPerforming simple swap: ${ethers.formatUnits(amountIn)} WGLMR -> DOT with 5% slippage`);
    await swapExactInputSingle(WGLMR, DOT, amountIn, 5); // 5% slippage
    
    // Multi-hop swap (only if USDT is defined)
    if (USDT) {
      console.log(`\nPerforming multi-hop swap: ${ethers.formatUnits(amountIn)} WGLMR -> DOT -> USDT with 5% slippage`);
      const tokensPath = [WGLMR, DOT, USDT];
      const fees = [3000, 500]; // Fee tiers in basis points
      await swapExactInputMultihop(tokensPath, fees, amountIn, 5);
    }
    
    console.log('\nSwap operations completed successfully!');
  } catch (error) {
    console.error('Error performing swaps:', error);
  }
}

main();
```

## Troubleshooting

### Common Issues

1. **"Error: PRIVATE_KEY environment variable is required"**
   - Make sure you've created a `.env` file with your private key
   - Ensure the private key is correctly formatted (with or without '0x' prefix)

2. **"Error: PROVIDER_CONTRACT_ADDRESS environment variable is required"**
   - Make sure you've set the contract addresses in your `.env` file

3. **Connection Issues**
   - Check that the RPC_URL in your `.env` file is correct and the node is accessible
   - Try using a different RPC provider if you're experiencing connection timeouts

4. **Transaction Errors**
   - Ensure your wallet has sufficient funds for transactions
   - Check that the contract addresses are correct and deployed on the network you're connecting to

### Getting Help

If you encounter issues not covered here, please:
1. Check the contract's documentation
2. Review the error messages carefully, they often provide useful information
3. Open an issue on the GitHub repository with details about the problem

## Note on Mock Functions

Some functions in `liquidity-swapper.js` use mock implementations for price quotes:

- `getEstimatedOutput`
- `getEstimatedInput`
- `getEstimatedMultihopOutput`
- `getEstimatedMultihopInput`

In a production environment, these should be replaced with actual price oracle calls or on-chain quote functions. 
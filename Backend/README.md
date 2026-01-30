# LiquiDOT Backend

Automated DeFi liquidity management service for Polkadot ecosystem. Optimizes LP positions across Moonbeam DEXes using cross-chain messaging (XCM) from Asset Hub.

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [**README**](./docs/README.md) | Complete backend overview and quick start |
| [**API Reference**](./docs/API_REFERENCE.md) | Full REST API documentation |
| [**Database Schema**](./docs/DATABASE_SCHEMA.md) | Entity relationships and table definitions |
| [**Investment Algorithm**](./docs/INVESTMENT_ALGORITHM.md) | How the optimization math works |
| [**Architecture**](./docs/ARCHITECTURE.md) | System design and data flows |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your environment (see .env.example for all options)
# Required: DATABASE_URL, MOONBEAM_RPC_URL, PRIVATE_KEY

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev
```

## 🏗️ Tech Stack

- **NestJS 10** - Backend framework
- **TypeORM** - Database ORM with PostgreSQL
- **Ethers.js 6** - Ethereum/Moonbeam interactions
- **Polkadot.js** - Asset Hub / XCM operations
- **TypeChain** - Type-safe contract bindings

## 📁 Project Structure

```
src/
├── modules/
│   ├── blockchain/           # Chain interactions (Asset Hub, Moonbeam)
│   ├── investment-decision/  # Core optimization algorithm
│   ├── stop-loss-worker/     # Position monitoring
│   ├── pools/                # DEX pool data
│   ├── positions/            # User positions
│   ├── preferences/          # User settings
│   └── users/                # User management
├── health.controller.ts
├── app.module.ts
└── main.ts
```

## 🔧 Environment Variables

See [`.env.example`](.env.example) for all configuration options. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `MOONBEAM_RPC_URL` | Moonbeam RPC endpoint |
| `ASSET_HUB_RPC_URL` | Asset Hub RPC endpoint |
| `PRIVATE_KEY` | Wallet private key (never commit!) |
| `STOP_LOSS_CHECK_INTERVAL_MS` | Position monitoring interval |

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/users` | Register user |
| `GET` | `/users/:id/balance` | Get user balance |
| `GET` | `/positions` | List positions |
| `GET` | `/positions/:id/pnl` | Get position P&L |
| `POST` | `/preferences/:userId` | Set preferences |
| `GET` | `/pools/top` | Get top pools by APR |

Full API documentation: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

## 🧠 How It Works

1. **Data Aggregation** - Pools synced from DEX subgraphs
2. **Opportunity Detection** - Algorithm ranks pools by risk-adjusted returns
3. **Portfolio Optimization** - Utility-maximizing allocation computed
4. **Automated Execution** - Rebalancing via XCM to Moonbeam
5. **Position Monitoring** - Stop-loss and take-profit checks every 30s

See [Investment Algorithm](./docs/INVESTMENT_ALGORITHM.md) for the math.

---

## Legacy Information

The information below is outdated and kept for reference only.

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
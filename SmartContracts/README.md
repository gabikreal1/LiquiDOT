# AI Liquidity Provider for Polkadot

This project provides smart contracts for an AI-powered liquidity provider that can interact across Polkadot parachains. It consists of two key components:

1. **AILiquidityProvider** - Deployed on Asset Hub (Westmint testnet)
2. **XCMProxy** - Deployed on Moonbase Alpha testnet

The system uses XCM (Cross-Consensus Messaging) to enable cross-chain operations, allowing the Asset Hub contract to control operations on Moonbeam.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create `.env` file from the example:
   ```
   cp .env.example .env
   ```
4. Add your private key to the `.env` file (without 0x prefix)

## Deployment Process

The deployment must be done in this specific order:

### 1. Deploy the Proxy Contract to Moonbase Alpha

```bash
npm run deploy:moonbase
```

This will:
- Deploy the XCMProxy contract to Moonbase Alpha testnet
- Set your account as the temporary owner
- Output the proxy contract address
- Add the proxy address to your .env file

### 2. Deploy the AILiquidityProvider to Asset Hub

```bash
npm run deploy:assethub
```

This will:
- Deploy the AILiquidityProvider contract to Asset Hub (Westmint) testnet
- Use the proxy address from the .env file
- Add the AILiquidityProvider address to your .env file

### 3. Update the Proxy Owner

```bash
npm run update:proxy
```

This will:
- Update the owner of the XCMProxy contract to be the AILiquidityProvider contract
- This enables the Asset Hub contract to control the proxy via XCM

### 4. Set the AI Agent Address

```bash
npm run set:agent
```

This will:
- Set the AI agent address that's authorized to call the addLiquidity function
- By default, it uses your deployer address

## Contract Interactions

### Adding Liquidity

Once deployed, you can call the `addLiquidity` function from the AI agent address on the Asset Hub contract. This will:

1. Send XCM messages to the proxy on Moonbase
2. The proxy will interact with Algebra pools
3. The proxy will mint tokens and create liquidity positions

### Removing Liquidity

Call the `removeLiquidity` function from the owner address on the Asset Hub contract to withdraw liquidity.

## Network Information

### Moonbase Alpha
- RPC URL: https://rpc.api.moonbase.moonbeam.network
- Chain ID: 1287
- Explorer: https://moonbase.moonscan.io/

### Asset Hub (Westmint) Testnet
- RPC URL: https://westmint-rpc.polkadot.io
- Chain ID: 1000

## Troubleshooting

- Ensure you have tokens on both networks for gas fees
- For Moonbase Alpha, you can get tokens from the [faucet](https://faucet.moonbeam.network)
- Make sure the XCM proxy address is correctly set before deploying to Asset Hub 
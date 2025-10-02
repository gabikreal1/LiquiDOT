/**
 * Test Contract Deployment
 * 
 * This module deploys additional contracts needed for comprehensive testing:
 * - TestERC20 tokens: Mintable ERC20 tokens for simulating trading pairs
 * - Mock XCM Precompiles: Simulated Substrate precompiles for local testing
 * - AssetHubVault: Core LiquiDOT contract for Asset Hub liquidity management
 * 
 * These contracts complement the production Algebra DEX and XCMProxy contracts
 * to create a complete testing environment that mirrors mainnet behavior.
 * 
 * @module test/setup/deploy-test-contracts
 */

const { ethers } = require("hardhat");

/**
 * Deploys mintable test ERC20 tokens
 * 
 * These tokens have a mint() function that allows unlimited token creation
 * for testing purposes. Each token is deployed with a unique name and symbol.
 * 
 * @param {object} options - Token deployment options
 * @param {number} [options.count=2] - Number of tokens to deploy
 * @param {string[]} [options.names] - Custom token names (defaults to Token0, Token1, ...)
 * @param {string[]} [options.symbols] - Custom token symbols (defaults to TKN0, TKN1, ...)
 * @param {string} [options.deployer] - Custom deployer signer
 * @returns {Promise<Array>} Array of deployed token contract instances
 */
async function deployTestTokens(options = {}) {
  const count = options.count || 2;
  const [defaultSigner] = await ethers.getSigners();
  const deployer = options.deployer || defaultSigner;
  
  console.log(`\n📦 Deploying ${count} test ERC20 token(s)...`);
  
  const TestERC20 = await ethers.getContractFactory("TestERC20", deployer);
  const tokens = [];
  
  for (let i = 0; i < count; i++) {
    // Use custom names/symbols if provided, otherwise use defaults
    const name = options.names?.[i] || `TestToken${i}`;
    const symbol = options.symbols?.[i] || `TKN${i}`;
    
    // Deploy token with name and symbol
    const token = await TestERC20.deploy(name, symbol);
    await token.waitForDeployment();
    const address = await token.getAddress();
    
    tokens.push(token);
    console.log(`  ✓ ${name} (${symbol}): ${address}`);
  }
  
  console.log(`✅ ${count} test token(s) deployed\n`);
  return tokens;
}

/**
 * Deploys mock Substrate XCM precompiles
 * 
 * Note: As of the current refactor, the mock precompile contracts
 * (MockXcmPrecompile.sol and MockXTokens.sol) have been removed.
 * 
 * For local testing, you should either:
 * 1. Use a test mode flag in the main contracts that bypasses XCM calls
 * 2. Deploy to a Moonbeam-compatible local chain with real precompiles
 * 3. Re-add simplified mocks if needed for unit testing
 * 
 * This function is kept as a placeholder for backward compatibility
 * and to document the expected interface.
 * 
 * @param {object} options - Mock precompile deployment options
 * @param {string} [options.deployer] - Custom deployer signer
 * @returns {Promise<object>} Object with mock precompile addresses (currently returns zero addresses)
 */
async function deployMockXcmPrecompiles(options = {}) {
  console.log("\n⚠️  Mock XCM precompiles not available (contracts removed in refactor)");
  console.log("   For testing XCM functionality:");
  console.log("   - Use contracts with test mode enabled (bypasses XCM)");
  console.log("   - Deploy to Moonbeam Alpha/Moonbase testnet");
  console.log("   - Or implement simplified mocks as needed\n");
  
  // Return structure for backward compatibility
  // In production tests, set XCMProxy and AssetHubVault to test mode
  return {
    mockXcmPrecompile: ethers.ZeroAddress,
    mockXTokens: ethers.ZeroAddress,
  };
}

/**
 * Connects to an existing AssetHubVault deployment and optionally configures it
 * 
 * AssetHubVault is deployed separately (e.g., via Remix) and this function
 * connects to the existing deployment for integration with the test environment.
 * 
 * The vault manages liquidity deposits and withdrawals on Asset Hub,
 * coordinating with XCMProxy on Moonbeam for cross-chain operations.
 * 
 * Key features:
 * - Multi-role access control (owner, operator, emergency)
 * - Cross-chain communication via XCM precompiles
 * - Emergency pause mechanism for security
 * - Integration with XCMProxy for DEX operations
 * 
 * @param {object} options - Configuration options
 * @param {string} options.vaultAddress - Address of deployed AssetHubVault (from ASSETHUB_CONTRACT env var)
 * @param {string} [options.deployer] - Custom deployer signer
 * @param {string} [options.operator] - Operator address for normal operations (optional config)
 * @param {string} [options.emergency] - Emergency address for pause/unpause (optional config)
 * @param {string} [options.xcmPrecompile] - XCM precompile address (optional config)
 * @param {boolean} [options.testMode=false] - Enable test mode (optional config)
 * @param {boolean} [options.configureVault=false] - Whether to configure vault settings
 * @returns {Promise<object>} Connected AssetHubVault contract and metadata
 */
async function connectToAssetHubVault(options = {}) {
  const [defaultSigner] = await ethers.getSigners();
  const deployer = options.deployer || defaultSigner;
  
  // Get vault address from options or environment variable
  const vaultAddress = options.vaultAddress || process.env.ASSETHUB_CONTRACT;
  
  if (!vaultAddress || vaultAddress === ethers.ZeroAddress) {
    throw new Error("AssetHubVault address not provided. Set ASSETHUB_CONTRACT environment variable or pass vaultAddress option.");
  }
  
  console.log("\n🔗 Connecting to existing AssetHubVault...");
  console.log(`   Address: ${vaultAddress}`);
  
  // Connect to the existing vault contract
  const AssetHubVault = await ethers.getContractFactory("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault", deployer);
  const vault = AssetHubVault.attach(vaultAddress);
  
  // Verify the contract exists by calling a view function
  try {
    const owner = await vault.owner();
    console.log(`   Owner: ${owner}`);
  } catch (error) {
    throw new Error(`Failed to connect to AssetHubVault at ${vaultAddress}. Is the contract deployed? Error: ${error.message}`);
  }
  
  console.log(`✅ Connected to AssetHubVault\n`);
  
  // Optionally configure vault if requested
  const configTxs = [];
  if (options.configureVault) {
    console.log("⚙️  Configuring AssetHubVault...");
    
    // Set operator (account that can execute normal operations)
    if (options.operator) {
      try {
        const currentOperator = await vault.operator();
        if (currentOperator !== options.operator) {
          console.log(`  Setting operator to ${options.operator}...`);
          const tx = await (await vault.setOperator(options.operator)).wait();
          console.log(`    ✓ tx: ${tx.hash}`);
          configTxs.push({ action: "setOperator", tx: tx.hash });
        } else {
          console.log(`  Operator already set to ${options.operator}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Could not set operator: ${error.message}`);
      }
    }
    
    // Set emergency address (account that can pause/unpause in emergencies)
    if (options.emergency) {
      try {
        const currentEmergency = await vault.emergencyAddress();
        if (currentEmergency !== options.emergency) {
          console.log(`  Setting emergency address to ${options.emergency}...`);
          const tx = await (await vault.setEmergencyAddress(options.emergency)).wait();
          console.log(`    ✓ tx: ${tx.hash}`);
          configTxs.push({ action: "setEmergencyAddress", tx: tx.hash });
        } else {
          console.log(`  Emergency address already set to ${options.emergency}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Could not set emergency address: ${error.message}`);
      }
    }
    
    // Set XCM precompile address (for cross-chain communication)
    if (options.xcmPrecompile && options.xcmPrecompile !== ethers.ZeroAddress) {
      try {
        console.log(`  Setting XCM precompile to ${options.xcmPrecompile}...`);
        const tx = await (await vault.setXcmPrecompile(options.xcmPrecompile)).wait();
        console.log(`    ✓ tx: ${tx.hash}`);
        configTxs.push({ action: "setXcmPrecompile", tx: tx.hash });
      } catch (error) {
        console.warn(`  ⚠️  Could not set XCM precompile: ${error.message}`);
      }
    }
    
    // Enable test mode if requested (bypasses XCM calls for local testing)
    if (options.testMode) {
      try {
        console.log(`  Enabling test mode...`);
        const tx = await (await vault.setTestMode(true)).wait();
        console.log(`    ✓ tx: ${tx.hash}`);
        configTxs.push({ action: "setTestMode", tx: tx.hash });
      } catch (error) {
        console.warn(`  ⚠️  Could not set test mode: ${error.message}`);
      }
    }
    
    console.log(`✅ AssetHubVault configuration complete\n`);
  }
  
  return {
    vault,
    address: vaultAddress,
    configTxs,
  };
}

/**
 * Creates and initializes an Algebra pool
 * 
 * Algebra pools must be created through the factory and initialized with
 * a starting price before they can be used for swaps or liquidity provision.
 * 
 * The initialization price is expressed as sqrtPriceX96, which is:
 *   sqrt(price) * 2^96
 * 
 * For a 1:1 price ratio:
 *   sqrt(1) * 2^96 = 79228162514264337593543950336
 * 
 * @param {object} options - Pool creation options
 * @param {Contract} options.factory - Algebra Factory contract instance
 * @param {string} options.token0 - Address of first token (must be < token1)
 * @param {string} options.token1 - Address of second token (must be > token0)
 * @param {BigNumber} [options.sqrtPriceX96] - Initial price (defaults to 1:1)
 * @returns {Promise<Contract>} Initialized Algebra pool contract instance
 */
async function createAndInitializePool(options) {
  const { factory, token0, token1 } = options;
  
  if (!factory || !token0 || !token1) {
    throw new Error("Missing required options: factory, token0, token1");
  }
  
  console.log(`\n📦 Creating Algebra pool for ${token0} / ${token1}...`);
  
  // Algebra requires token0 < token1 (sorted order)
  // Swap if necessary to ensure correct ordering
  let [t0, t1] = token0 < token1 ? [token0, token1] : [token1, token0];
  
  // Create the pool through the factory
  const tx = await factory.createPool(t0, t1);
  await tx.wait();
  console.log(`  ✓ Pool creation tx: ${tx.hash}`);
  
  // Get the deployed pool address from the factory
  const poolAddress = await factory.poolByPair(t0, t1);
  const pool = await ethers.getContractAt("IAlgebraPool", poolAddress);
  console.log(`  ✓ Pool deployed: ${poolAddress}`);
  
  // Initialize pool with starting price
  // Default to 1:1 price ratio (sqrt(1) * 2^96)
  const sqrtPriceX96 = options.sqrtPriceX96 || BigInt("79228162514264337593543950336");
  const initTx = await pool.initialize(sqrtPriceX96);
  await initTx.wait();
  console.log(`  ✓ Pool initialized at 1:1 price`);
  
  console.log(`✅ Pool ready for use\n`);
  
  return pool;
}

/**
 * Adds liquidity to an Algebra pool through NFPM
 * 
 * This helper function:
 * 1. Mints tokens to the liquidity provider
 * 2. Approves NFPM to spend those tokens
 * 3. Calls NFPM.mint() to create a liquidity position (as an NFT)
 * 
 * The tick range (-887220 to 887220) represents the full price range,
 * meaning this liquidity will be active at all prices.
 * 
 * @param {object} options - Liquidity provision options
 * @param {Contract} options.pool - Algebra pool contract instance
 * @param {Contract} options.nfpm - NonfungiblePositionManager contract instance
 * @param {Contract} options.token0 - First token contract instance
 * @param {Contract} options.token1 - Second token contract instance
 * @param {Signer} options.provider - Signer providing liquidity
 * @param {string|number} options.amount - Amount of each token to provide (in ether units)
 * @returns {Promise<object>} Transaction receipt and position NFT ID
 */
async function addLiquidityToPool(options) {
  const { pool, nfpm, token0, token1, provider, amount } = options;
  
  if (!pool || !nfpm || !token0 || !token1 || !provider || !amount) {
    throw new Error("Missing required options: pool, nfpm, token0, token1, provider, amount");
  }
  
  console.log(`\n💰 Adding liquidity: ${amount} of each token...`);
  
  // Convert amount to wei (18 decimals)
  const amount0 = ethers.parseEther(amount.toString());
  const amount1 = ethers.parseEther(amount.toString());
  
  // Step 1: Mint tokens to the provider
  console.log(`  Minting tokens to ${provider.address}...`);
  await (await token0.mint(provider.address, amount0)).wait();
  await (await token1.mint(provider.address, amount1)).wait();
  console.log(`    ✓ Tokens minted`);
  
  // Step 2: Approve NFPM to spend provider's tokens
  const nfpmAddress = await nfpm.getAddress();
  console.log(`  Approving NFPM to spend tokens...`);
  await (await token0.connect(provider).approve(nfpmAddress, amount0)).wait();
  await (await token1.connect(provider).approve(nfpmAddress, amount1)).wait();
  console.log(`    ✓ Approvals granted`);
  
  // Step 3: Mint liquidity position through NFPM
  // This creates an NFT representing the liquidity position
  console.log(`  Minting liquidity position...`);
  const token0Address = await token0.getAddress();
  const token1Address = await token1.getAddress();
  
  const mintParams = {
    token0: token0Address,
    token1: token1Address,
    tickLower: -887220,  // Full range liquidity (min tick)
    tickUpper: 887220,   // Full range liquidity (max tick)
    amount0Desired: amount0,
    amount1Desired: amount1,
    amount0Min: 0,       // Accept any amount (no slippage protection for testing)
    amount1Min: 0,
    recipient: provider.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,  // 1 hour from now
  };
  
  const tx = await nfpm.connect(provider).mint(mintParams);
  const receipt = await tx.wait();
  console.log(`    ✓ Liquidity added (tx: ${receipt.hash})`);
  
  console.log(`✅ Liquidity provision complete\n`);
  
  return { receipt, tx };
}

/**
 * Helper: Mint tokens to an address
 * 
 * Simple wrapper for minting test tokens. Useful for setting up
 * test scenarios with specific token balances.
 * 
 * @param {Contract} token - TestERC20 contract instance
 * @param {string} to - Recipient address
 * @param {BigNumber|string} amount - Amount to mint (in wei)
 * @returns {Promise<object>} Transaction receipt
 */
async function mintTokens(token, to, amount) {
  const tx = await token.mint(to, amount);
  const receipt = await tx.wait();
  return receipt;
}

/**
 * Helper: Approve token spending
 * 
 * Simple wrapper for approving token spending. Useful for setting up
 * test scenarios where contracts need to transfer user tokens.
 * 
 * @param {Contract} token - ERC20 token contract instance
 * @param {Signer} owner - Token owner who is granting approval
 * @param {string} spender - Address receiving approval to spend tokens
 * @param {BigNumber|string} amount - Amount to approve (in wei)
 * @returns {Promise<object>} Transaction receipt
 */
async function approveTokens(token, owner, spender, amount) {
  const tx = await token.connect(owner).approve(spender, amount);
  const receipt = await tx.wait();
  return receipt;
}

/**
 * Standalone script execution
 * Demonstrates deploying all test contracts
 */
async function main() {
  try {
    console.log("\n=== Deploying Test Contracts ===\n");
    
    // Deploy test tokens
    const tokens = await deployTestTokens({ count: 2 });
    
    // Note: Mock precompiles removed - use test mode instead
    const precompiles = await deployMockXcmPrecompiles();
    
    // Connect to existing AssetHubVault (deployed separately via Remix)
    // Set ASSETHUB_CONTRACT environment variable with the deployed address
    const { vault } = await connectToAssetHubVault({ 
      configureVault: false  // Don't configure in this example
    });
    
    console.log("✅ All test contracts ready!");
    
    return {
      tokens,
      precompiles,
      vault,
    };
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

// Execute main() if this script is run directly
if (require.main === module) {
  main();
}

module.exports = {
  deployTestTokens,
  deployMockXcmPrecompiles,
  connectToAssetHubVault,  // Renamed from deployAssetHubVault
  createAndInitializePool,
  addLiquidityToPool,
  mintTokens,
  approveTokens,
};


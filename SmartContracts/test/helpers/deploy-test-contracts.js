const { ethers } = require("hardhat");

async function deployTestTokens(options = {}) {
  const count = options.count || 2;
  const [defaultSigner] = await ethers.getSigners();
  const deployer = options.deployer || defaultSigner;
  const existing = Array.isArray(options.addresses) ? options.addresses.filter(Boolean) : [];
  const useExisting = existing.length > 0;

  console.log(`\n📦 ${useExisting ? "Attaching" : "Deploying"} ${count} test ERC20 token(s)...`);

  const TestERC20 = await ethers.getContractFactory("TestERC20", deployer);
  const tokens = [];

  for (let i = 0; i < count; i++) {
    const name = options.names?.[i] || `TestToken${i}`;
    const symbol = options.symbols?.[i] || `TKN${i}`;

    if (useExisting && existing[i]) {
      const token = TestERC20.attach(existing[i]);
      tokens.push(token);
      console.log(`  ↺ Reusing ${name} (${symbol}): ${existing[i]}`);
      continue;
    }

    const token = await TestERC20.deploy(name, symbol);
    await token.waitForDeployment();
    const address = await token.getAddress();

    tokens.push(token);
    console.log(`  ✓ ${name} (${symbol}): ${address}`);
  }

  console.log(`✅ ${count} test token(s) ${useExisting ? "ready" : "deployed"}\n`);
  return tokens;
}

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

async function createAndInitializePool(options) {
  const { factory, token0, token1 } = options;
  
  if (!factory || !token0 || !token1) {
    throw new Error("Missing required options: factory, token0, token1");
  }
  
  console.log(`\n📦 Creating Algebra pool for ${token0} / ${token1}...`);
  
  // Algebra requires token0 < token1 (sorted order)
  // Swap if necessary to ensure correct ordering
  let [t0, t1] = token0 < token1 ? [token0, token1] : [token1, token0];

  let poolAddress = await factory.poolByPair(t0, t1);
  let pool;
  let created = false;

  if (!poolAddress || poolAddress === ethers.ZeroAddress) {
    // Algebra Integral v1.2 requires empty bytes data parameter
    const tx = await factory.createPool(t0, t1, "0x");
    await tx.wait();
    console.log(`  ✓ Pool creation tx: ${tx.hash}`);

    poolAddress = await factory.poolByPair(t0, t1);
    created = true;
  } else {
    console.log(`  ↺ Pool already exists at ${poolAddress}`);
  }

  pool = await ethers.getContractAt("IAlgebraPool", poolAddress);

  const shouldInitialize = options.initialize !== false;
  if (created && shouldInitialize) {
    const sqrtPriceX96 = options.sqrtPriceX96 || BigInt("79228162514264337593543950336");
    const initTx = await pool.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log(`  ✓ Pool initialized at 1:1 price`);
  } else if (!created) {
    console.log("  ↺ Skipping initialization (pool reused)");
  }

  console.log(`✅ Pool ready for use\n`);

  return pool;
}

async function addLiquidityToPool(options) {
  const { pool, nfpm, token0, token1, provider, amount } = options;
  
  if (!pool || !nfpm || !token0 || !token1 || !provider || !amount) {
    throw new Error("Missing required options: pool, nfpm, token0, token1, provider, amount");
  }
  
  const providerAddress = provider.address || (await provider.getAddress());
  console.log(`\n💰 Adding liquidity: ${amount} of each token...`);

  const decimals0 = await token0.decimals();
  const decimals1 = await token1.decimals();
  const desired0 = ethers.parseUnits(amount.toString(), decimals0);
  const desired1 = ethers.parseUnits(amount.toString(), decimals1);

  // Step 1: Mint or top up tokens for the provider
  console.log(`  Ensuring ${providerAddress} holds required tokens...`);
  const current0 = await token0.balanceOf(providerAddress);
  if (current0 < desired0) {
    const delta0 = desired0 - current0;
    const mintTx0 = await token0.mint(providerAddress, delta0);
    console.log(`    ↳ token0.mint tx: ${mintTx0.hash} (+${ethers.formatUnits(delta0, decimals0)} tokens)`);
    await mintTx0.wait();
  } else {
    console.log(`    ↺ token0 balance sufficient (${ethers.formatUnits(current0, decimals0)})`);
  }

  const current1 = await token1.balanceOf(providerAddress);
  if (current1 < desired1) {
    const delta1 = desired1 - current1;
    const mintTx1 = await token1.mint(providerAddress, delta1);
    console.log(`    ↳ token1.mint tx: ${mintTx1.hash} (+${ethers.formatUnits(delta1, decimals1)} tokens)`);
    await mintTx1.wait();
  } else {
    console.log(`    ↺ token1 balance sufficient (${ethers.formatUnits(current1, decimals1)})`);
  }
  console.log("    ✓ Token balances ready");
  
  // Step 2: Approve NFPM to spend provider's tokens
  const nfpmAddress = await nfpm.getAddress();
  console.log(`  Approving NFPM to spend tokens...`);
  const allowance0 = await token0.allowance(providerAddress, nfpmAddress);
  if (allowance0 < desired0) {
    const approveTx0 = await token0.connect(provider).approve(nfpmAddress, desired0);
    console.log(`    ↳ token0.approve tx: ${approveTx0.hash}`);
    await approveTx0.wait();
  } else {
    console.log("    ↺ token0 allowance already sufficient");
  }

  const allowance1 = await token1.allowance(providerAddress, nfpmAddress);
  if (allowance1 < desired1) {
    const approveTx1 = await token1.connect(provider).approve(nfpmAddress, desired1);
    console.log(`    ↳ token1.approve tx: ${approveTx1.hash}`);
    await approveTx1.wait();
  } else {
    console.log("    ↺ token1 allowance already sufficient");
  }
  console.log(`    ✓ Approvals confirmed`);
  
  // Step 3: Mint liquidity position through NFPM
  // This creates an NFT representing the liquidity position
  console.log(`  Minting liquidity position...`);
  const token0Address = await token0.getAddress();
  const token1Address = await token1.getAddress();
  if (token1Address.toLowerCase() < token0Address.toLowerCase()) {
    throw new Error(`Token order mismatch: token0 must be < token1 (got ${token0Address} > ${token1Address})`);
  }
  
  const mintParams = {
    token0: token0Address,
    token1: token1Address,
    deployer: ethers.ZeroAddress,
    tickLower: -887220,  // Full range liquidity (min tick)
    tickUpper: 887220,   // Full range liquidity (max tick)
    amount0Desired: desired0,
    amount1Desired: desired1,
    amount0Min: 0,
    amount1Min: 0,
    recipient: providerAddress,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
  
  const tx = await nfpm.connect(provider).mint(mintParams);
  const receipt = await tx.wait();
  console.log(`    ✓ Liquidity added (tx: ${receipt.hash})`);
  
  console.log(`✅ Liquidity provision complete\n`);
  
  return { receipt, tx };
}

async function mintTokens(token, to, amount) {
  const tx = await token.mint(to, amount);
  const receipt = await tx.wait();
  return receipt;
}

async function approveTokens(token, owner, spender, amount) {
  const tx = await token.connect(owner).approve(spender, amount);
  const receipt = await tx.wait();
  return receipt;
}

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


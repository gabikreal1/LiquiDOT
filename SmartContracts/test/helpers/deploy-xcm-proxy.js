const { ethers } = require("hardhat");
const { loadState, saveState, ensureNetwork, ensureContract } = require("../../scripts/utils/state-manager");

async function deployXCMProxy(options = {}) {
  // ===== STEP 1: Setup deployment context =====
  
  // Get deployer signer (either provided or default first signer)
  const [defaultSigner] = await ethers.getSigners();
  const deployer = options.deployer || defaultSigner;
  
  // Get network information for deployment tracking
  const network = await ethers.provider.getNetwork();
  console.log(`\n=== Deploying XCMProxy on ${network.name} (chainId: ${network.chainId}) ===`);
  console.log(`Deployer address: ${deployer.address}\n`);

  // ===== STEP 2: Prepare configuration with defaults =====
  
  // Build configuration object, prioritizing: options > env vars > defaults
  const config = {
    owner: options.owner || process.env.XCMP_OWNER || deployer.address,
    operator: options.operator || process.env.XCMP_OPERATOR || deployer.address,
    quoter: options.quoter || process.env.XCMP_QUOTER || ethers.ZeroAddress,
    router: options.router || process.env.XCMP_ROUTER || ethers.ZeroAddress,
    nfpm: options.nfpm || process.env.XCMP_NFPM || ethers.ZeroAddress,
    xtokensPrecompile: options.xtokensPrecompile || process.env.XCMP_XTOKENS || ethers.ZeroAddress,
    destWeight: options.destWeight || (process.env.XCMP_DEST_WEIGHT ? BigInt(process.env.XCMP_DEST_WEIGHT) : 6_000_000_000n),
    assetHubParaId: options.assetHubParaId || (process.env.XCMP_ASSET_HUB_PARAID ? Number(process.env.XCMP_ASSET_HUB_PARAID) : 0),
    trustedCaller: options.trustedCaller || process.env.XCMP_TRUSTED_CALLER || ethers.ZeroAddress,
    xcmTransactor: options.xcmTransactor || process.env.XCMP_TRANSACTOR || ethers.ZeroAddress,
    defaultSlippageBps: options.defaultSlippageBps || (process.env.XCMP_DEFAULT_SLIPPAGE ? Number(process.env.XCMP_DEFAULT_SLIPPAGE) : 100),
    supportedTokens: options.supportedTokens || (process.env.XCMP_SUPPORTED_TOKENS || "").split(",").map((x) => x.trim()).filter(Boolean),
    freezeConfig: options.freezeConfig || process.env.XCMP_FREEZE_CONFIG === "true",
  };

  console.log("Configuration:");
  console.log(`  Owner: ${config.owner}`);
  console.log(`  Operator: ${config.operator}`);
  console.log(`  Algebra Quoter: ${config.quoter}`);
  console.log(`  Algebra Router: ${config.router}`);
  console.log(`  Algebra NFPM: ${config.nfpm}`);
  console.log(`  xTokens Precompile: ${config.xtokensPrecompile}`);
  console.log(`  Default XCM Weight: ${config.destWeight}`);
  console.log(`  Asset Hub ParaID: ${config.assetHubParaId}`);
  console.log(`  Trusted XCM Caller: ${config.trustedCaller}`);
  console.log(`  XCM Transactor: ${config.xcmTransactor}`);
  console.log(`  Default Slippage: ${config.defaultSlippageBps} bps`);
  console.log(`  Supported Tokens: ${config.supportedTokens.length ? config.supportedTokens.join(", ") : "none"}`);
  console.log(`  Freeze Config: ${config.freezeConfig}\n`);

  // ===== STEP 3: Deploy XCMProxy contract =====
  
  console.log("📦 Deploying XCMProxy contract...");
  const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy", deployer);
  
  // Deploy with initial owner (owner can later transfer ownership)
  const proxy = await XCMProxy.deploy(config.owner, { gasLimit: 15000000 });
  const deploymentTx = proxy.deploymentTransaction();
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  
  console.log(`✅ XCMProxy deployed: ${proxyAddress}`);
  if (deploymentTx) {
    console.log(`   Deployment tx: ${deploymentTx.hash}`);
  }

  // ===== STEP 4: Configure XCMProxy with provided settings =====
  
  console.log("\n⚙️  Configuring XCMProxy...");
  const configTxs = await configureXCMProxy(proxy, config);
  console.log(`✅ Configuration complete (${configTxs.length} transactions)\n`);

  // ===== STEP 5: Save deployment state (optional) =====
  
  if (options.saveState !== false) {
    try {
      // Load existing state (or create new if doesn't exist)
      const state = loadState();
      
      // Ensure network entry exists in state
      const networkEntry = ensureNetwork(state, network.name || String(network.chainId), {
        chainId: Number(network.chainId),
        name: network.name,
      });
      networkEntry.lastRun = new Date().toISOString();
      
      // Ensure contract entry exists
      const contractEntry = ensureContract(networkEntry, "XCMProxy");
      
      // Update contract entry with deployment data
      contractEntry.address = proxyAddress;
      contractEntry.deployer = deployer.address;
      contractEntry.deploymentTx = deploymentTx ? deploymentTx.hash : null;
      contractEntry.timestamp = new Date().toISOString();
      
      // Store configuration state
      contractEntry.config = {
        owner: await proxy.owner(),
        operator: await proxy.operator(),
        quoter: await proxy.quoterContract(),
        router: await proxy.swapRouterContract(),
        nfpm: await proxy.nfpmContract(),
        xtokensPrecompile: await proxy.xTokensPrecompile(),
        defaultDestWeight: (await proxy.defaultDestWeight()).toString(),
        assetHubParaId: Number(await proxy.assetHubParaId()),
        trustedXcmCaller: await proxy.trustedXcmCaller(),
        xcmTransactorPrecompile: await proxy.xcmTransactorPrecompile(),
        defaultSlippageBps: Number(await proxy.defaultSlippageBps()),
        supportedTokens: {},
        xcmConfigFrozen: await proxy.xcmConfigFrozen(),
      };
      
      // Store supported token states
      for (const token of config.supportedTokens) {
        contractEntry.config.supportedTokens[token] = await proxy.supportedTokens(token);
      }
      
      // Store configuration transaction hashes
      contractEntry.configurationTxs = configTxs;
      
      // Save updated state to disk
      saveState(state);
      console.log("💾 Deployment state saved\n");
    } catch (error) {
      console.warn("⚠️  Failed to save deployment state:", error.message);
    }
  }

  console.log("✅ XCMProxy deployment and configuration complete!\n");

  // Return contract instance and relevant data
  return {
    proxy,
    address: proxyAddress,
    config,
    configTxs,
  };
}

async function configureXCMProxy(proxy, config) {
  const configTxs = [];

  // Set operator (account that can execute operations but not change config)
  if (config.operator && config.operator !== await proxy.operator()) {
    console.log(`  Setting operator to ${config.operator}...`);
    const tx = await (await proxy.setOperator(config.operator)).wait();
    console.log(`    ✓ tx: ${tx.hash}`);
    configTxs.push({ action: "setOperator", tx: tx.hash });
  }

  // Set Algebra integrations (quoter for price quotes, router for swaps)
  // These are set together as they're tightly coupled in the DEX integration
  if (config.quoter !== ethers.ZeroAddress) {
    console.log(`  Setting Algebra integrations (quoter + router)...`);
    const tx = await (await proxy.setIntegrations(config.quoter, config.router)).wait();
    console.log(`    ✓ quoter: ${config.quoter}`);
    console.log(`    ✓ router: ${config.router}`);
    console.log(`    ✓ tx: ${tx.hash}`);
    configTxs.push({ 
      action: "setIntegrations", 
      tx: tx.hash, 
      params: { quoter: config.quoter, router: config.router } 
    });
  }

  // Set NFPM (Nonfungible Position Manager) for liquidity management
  if (config.nfpm !== ethers.ZeroAddress) {
    console.log(`  Setting NFPM to ${config.nfpm}...`);
    const tx = await (await proxy.setNFPM(config.nfpm)).wait();
    console.log(`    ✓ tx: ${tx.hash}`);
    configTxs.push({ action: "setNFPM", tx: tx.hash, params: { nfpm: config.nfpm } });
  }

  // Set xTokens precompile (Substrate precompile for cross-chain token transfers)
  if (config.xtokensPrecompile !== ethers.ZeroAddress) {
    const existing = await proxy.xTokensPrecompile();
    if (existing !== config.xtokensPrecompile) {
      console.log(`  Setting xTokens precompile to ${config.xtokensPrecompile}...`);
      const tx = await (await proxy.setXTokensPrecompile(config.xtokensPrecompile)).wait();
      console.log(`    ✓ tx: ${tx.hash}`);
      configTxs.push({ 
        action: "setXTokensPrecompile", 
        tx: tx.hash, 
        params: { precompile: config.xtokensPrecompile } 
      });
    }
  }

  // Set default XCM destination weight (gas limit for XCM execution on destination chain)
  if (config.destWeight) {
    const existing = await proxy.defaultDestWeight();
    if (existing !== config.destWeight) {
      console.log(`  Setting default XCM destination weight to ${config.destWeight}...`);
      const tx = await (await proxy.setDefaultDestWeight(config.destWeight)).wait();
      console.log(`    ✓ tx: ${tx.hash}`);
      configTxs.push({ 
        action: "setDefaultDestWeight", 
        tx: tx.hash, 
        params: { weight: config.destWeight.toString() } 
      });
    }
  }

  // Set Asset Hub parachain ID (for XCM message routing)
  if (config.assetHubParaId) {
    const existing = await proxy.assetHubParaId();
    if (Number(existing) !== config.assetHubParaId) {
      console.log(`  Setting Asset Hub ParaID to ${config.assetHubParaId}...`);
      const tx = await (await proxy.setAssetHubParaId(config.assetHubParaId)).wait();
      console.log(`    ✓ tx: ${tx.hash}`);
      configTxs.push({ 
        action: "setAssetHubParaId", 
        tx: tx.hash, 
        params: { paraId: config.assetHubParaId } 
      });
    }
  }

  // Set trusted XCM caller (address allowed to trigger XCM callbacks)
  if (config.trustedCaller !== ethers.ZeroAddress) {
    const existing = await proxy.trustedXcmCaller();
    if (existing !== config.trustedCaller) {
      console.log(`  Setting trusted XCM caller to ${config.trustedCaller}...`);
      const tx = await (await proxy.setTrustedXcmCaller(config.trustedCaller)).wait();
      console.log(`    ✓ tx: ${tx.hash}`);
      configTxs.push({ 
        action: "setTrustedXcmCaller", 
        tx: tx.hash, 
        params: { caller: config.trustedCaller } 
      });
    }
  }

  // Set XCM Transactor precompile (for advanced XCM operations)
  if (config.xcmTransactor !== ethers.ZeroAddress) {
    const existing = await proxy.xcmTransactorPrecompile();
    if (existing !== config.xcmTransactor) {
      console.log(`  Setting XCM Transactor precompile to ${config.xcmTransactor}...`);
      const tx = await (await proxy.setXcmTransactorPrecompile(config.xcmTransactor)).wait();
      console.log(`    ✓ tx: ${tx.hash}`);
      configTxs.push({ 
        action: "setXcmTransactorPrecompile", 
        tx: tx.hash, 
        params: { precompile: config.xcmTransactor } 
      });
    }
  }

  // Set default slippage tolerance in basis points (100 bps = 1%)
  if (typeof config.defaultSlippageBps === "number") {
    const existing = await proxy.defaultSlippageBps();
    if (Number(existing) !== config.defaultSlippageBps) {
      console.log(`  Setting default slippage to ${config.defaultSlippageBps} bps...`);
      const tx = await (await proxy.setDefaultSlippageBps(config.defaultSlippageBps)).wait();
      console.log(`    ✓ tx: ${tx.hash}`);
      configTxs.push({ 
        action: "setDefaultSlippageBps", 
        tx: tx.hash, 
        params: { bps: config.defaultSlippageBps } 
      });
    }
  }

  // Add supported tokens (whitelist for cross-chain operations)
  // Only tokens in this list can be used in XCM operations
  if (config.supportedTokens.length > 0) {
    console.log(`  Adding ${config.supportedTokens.length} supported token(s)...`);
    for (const token of config.supportedTokens) {
      const isSupported = await proxy.supportedTokens(token);
      if (!isSupported) {
        const tx = await (await proxy.addSupportedToken(token)).wait();
        console.log(`    ✓ ${token} (tx: ${tx.hash})`);
        configTxs.push({ action: "addSupportedToken", tx: tx.hash, params: { token } });
      } else {
        console.log(`    - ${token} (already supported)`);
      }
    }
  }

  // Freeze XCM configuration (prevents further config changes for security)
  // This is a one-way operation - once frozen, config cannot be unfrozen
  if (config.freezeConfig) {
    const frozen = await proxy.xcmConfigFrozen();
    if (!frozen) {
      console.log(`  Freezing XCM configuration...`);
      const tx = await (await proxy.freezeXcmConfig()).wait();
      console.log(`    ✓ tx: ${tx.hash}`);
      configTxs.push({ action: "freezeXcmConfig", tx: tx.hash });
    }
  }

  return configTxs;
}

async function main() {
  try {
    const result = await deployXCMProxy({
      saveState: true,
    });
    console.log("Deployment successful!");
    return result;
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Execute main() if this script is run directly
if (require.main === module) {
  main();
}

module.exports = {
  deployXCMProxy,
  configureXCMProxy,
};


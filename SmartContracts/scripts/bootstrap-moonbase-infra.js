const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const {
  deployAlgebraSuite,
  getContractFactoryFromArtifact,
  ALGEBRA_ARTIFACT_PATHS,
} = require("../test/setup/deploy-algebra-suite");
const {
  deployTestTokens,
  createAndInitializePool,
  addLiquidityToPool,
} = require("../test/setup/deploy-test-contracts");
const { deployXCMProxy } = require("../test/setup/deploy-xcm-proxy");

const BOOTSTRAP_OUTPUT = process.env.MOONBASE_BOOTSTRAP_FILE || path.join(__dirname, "../deployments/moonbase_bootstrap.json");

const DEFAULT_DEST_WEIGHT = BigInt(process.env.DEFAULT_DEST_WEIGHT || 6_000_000_000);
const DEFAULT_SLIPPAGE_BPS = Number(process.env.DEFAULT_SLIPPAGE_BPS || 100);
const MOONBASE_PRECOMPILES = {
  xTokens: process.env.MOONBASE_XTOKENS || "0x0000000000000000000000000000000000000804",
  xcmTransactor: process.env.MOONBASE_XCM_TRANSACTOR || "0x0000000000000000000000000000000000000806",
};
const ASSET_HUB_PARA_ID = Number(process.env.ASSET_HUB_PARAID || 420420422);
const TRUSTED_XCM_CALLER = process.env.TRUSTED_XCM_CALLER || process.env.ASSETHUB_SOVEREIGN || process.env.ASSETHUB_ADDRESS || ethers.ZeroAddress;
const SUPPORTED_TOKEN_FUND = process.env.PROXY_FUND_AMOUNT || "1000";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n============================================");
  console.log(" LiquiDOT Moonbase Bootstrap");
  console.log("============================================\n");
  console.log(`Network: ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} DEV`);

  const algebra = await ensureAlgebraSuite(deployer);
  const tokens = await ensureTestTokens(deployer);
  const pool = await ensurePoolWithLiquidity({
    factory: algebra.contracts.factory,
    nfpm: algebra.contracts.nfpm,
    poolDeployer: algebra.contracts.poolDeployer,
    tokens,
    deployer,
  });
  const proxy = await ensureXcmProxy({
    deployer,
    algebra,
    tokens,
  });
  await ensureProxyFunding(proxy, tokens, SUPPORTED_TOKEN_FUND);

  await outputSummary({ algebra, tokens, pool, proxy, network });
}

async function ensureAlgebraSuite(deployer) {
  const existing = getExistingAlgebraAddresses();
  if (existing) {
    console.log("\n[1/5] Using existing Algebra deployment");
    return attachAlgebraContracts(existing, deployer);
  }

  console.log("\n[1/5] Deploying Algebra suite (factory, router, quoter, NFPM)...");
  const wNative = process.env.WDEV_ADDRESS || ethers.ZeroAddress;
  const result = await deployAlgebraSuite({
    deployer,
    wNative,
    saveDeployment: true,
    outputDir: path.join(__dirname, "../deployments"),
  });
  return {
    addresses: result.addresses,
    contracts: result.contracts,
  };
}

function getExistingAlgebraAddresses() {
  if (process.env.ALGEBRA_FACTORY && process.env.ALGEBRA_ROUTER && process.env.ALGEBRA_QUOTER && process.env.ALGEBRA_NFPM) {
    return {
      factory: process.env.ALGEBRA_FACTORY,
      router: process.env.ALGEBRA_ROUTER,
      quoter: process.env.ALGEBRA_QUOTER,
      nfpm: process.env.ALGEBRA_NFPM,
      poolDeployer: process.env.ALGEBRA_POOL_DEPLOYER,
      wdev: process.env.WDEV_ADDRESS,
    };
  }

  const deploymentFile = path.join(__dirname, "../deployments/moonbase_algebra.json");
  if (fs.existsSync(deploymentFile)) {
    const parsed = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    return {
      poolDeployer: parsed.contracts.poolDeployer,
      factory: parsed.contracts.factory,
      router: parsed.contracts.router,
      quoter: parsed.contracts.quoter,
      nfpm: parsed.contracts.nfpm,
      wdev: parsed.contracts.wdev || parsed.config?.wNative,
    };
  }
  return null;
}

function attachAlgebraContracts(addresses, deployer) {
  const Factory = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Factory, deployer);
  const Router = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Router, deployer);
  const Quoter = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.Quoter, deployer);
  const NFPM = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.NFPM, deployer);
  const PoolDeployer = getContractFactoryFromArtifact(ALGEBRA_ARTIFACT_PATHS.PoolDeployer, deployer);

  return {
    addresses,
    contracts: {
      factory: Factory.attach(addresses.factory),
      router: Router.attach(addresses.router),
      quoter: Quoter.attach(addresses.quoter),
      nfpm: NFPM.attach(addresses.nfpm),
      poolDeployer: addresses.poolDeployer ? PoolDeployer.attach(addresses.poolDeployer) : undefined,
    },
  };
}

async function ensureTestTokens(deployer) {
  const tokenEnv0 = process.env.BOOTSTRAP_TOKEN0_ADDRESS;
  const tokenEnv1 = process.env.BOOTSTRAP_TOKEN1_ADDRESS;
  if (tokenEnv0 && tokenEnv1) {
    console.log("\n[2/5] Using existing test tokens");
    const Token = await ethers.getContractFactory("TestERC20", deployer);
    return [Token.attach(tokenEnv0), Token.attach(tokenEnv1)];
  }

  console.log("\n[2/5] Deploying test ERC20 tokens (for pool & proxy)");
  const tokens = await deployTestTokens({
    deployer,
    count: 2,
    names: ["BootstrapToken0", "BootstrapToken1"],
    symbols: ["BT0", "BT1"],
  });
  return tokens;
}

async function ensurePoolWithLiquidity({ factory, nfpm, poolDeployer, tokens, deployer }) {
  console.log("\n[3/5] Ensuring Algebra pool and base liquidity");
  const tokenAddrs = await Promise.all(tokens.map((t) => t.getAddress()));
  let [token0Addr, token1Addr] = tokenAddrs;
  let [token0, token1] = tokens;
  if (token1Addr.toLowerCase() < token0Addr.toLowerCase()) {
    [token0Addr, token1Addr] = [token1Addr, token0Addr];
    [token0, token1] = [token1, token0];
  }

  let poolAddress = await factory.poolByPair(token0Addr, token1Addr);
  let pool;
  if (poolAddress && poolAddress !== ethers.ZeroAddress) {
    pool = await ethers.getContractAt("IAlgebraPool", poolAddress);
    console.log(`  Pool already exists at ${poolAddress}`);
  } else {
    pool = await createAndInitializePool({ factory, token0: token0Addr, token1: token1Addr });
    poolAddress = await pool.getAddress();
  }

  process.env.MOONBASE_REAL_POOL = poolAddress;

  const currentLiquidity = await pool.liquidity();
  if (currentLiquidity === 0n) {
    await addLiquidityToPool({
      pool,
      nfpm,
      poolDeployer,
      token0,
      token1,
      provider: deployer,
      amount: process.env.BOOTSTRAP_LIQUIDITY_AMOUNT || "1000",
    });
  } else {
    console.log(`  Liquidity already present: ${currentLiquidity.toString()}`);
  }

  return { pool, poolAddress, token0, token1, token0Addr, token1Addr };
}

async function ensureXcmProxy({ deployer, algebra, tokens }) {
  console.log("\n[4/5] Ensuring XCMProxy deployment and configuration");
  const tokenAddresses = await Promise.all(tokens.map((t) => t.getAddress()));
  const existingAddress = process.env.XCMPROXY_ADDRESS;
  let proxy;

  if (existingAddress) {
    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy", deployer);
    proxy = XCMProxy.attach(existingAddress);
    console.log(`  Using existing XCMProxy at ${existingAddress}`);
    await syncXcmProxyConfig(proxy, {
      operator: deployer.address,
      quoter: algebra.addresses.quoter,
      router: algebra.addresses.router,
      nfpm: algebra.addresses.nfpm,
      xtokensPrecompile: MOONBASE_PRECOMPILES.xTokens,
      xcmTransactor: MOONBASE_PRECOMPILES.xcmTransactor,
      destWeight: DEFAULT_DEST_WEIGHT,
      assetHubParaId: ASSET_HUB_PARA_ID,
      trustedCaller: TRUSTED_XCM_CALLER,
      defaultSlippageBps: DEFAULT_SLIPPAGE_BPS,
      supportedTokens: tokenAddresses,
    });
  } else {
    const deployment = await deployXCMProxy({
      deployer,
      owner: deployer.address,
      operator: deployer.address,
      quoter: algebra.addresses.quoter,
      router: algebra.addresses.router,
      nfpm: algebra.addresses.nfpm,
      xtokensPrecompile: MOONBASE_PRECOMPILES.xTokens,
      xcmTransactor: MOONBASE_PRECOMPILES.xcmTransactor,
      destWeight: DEFAULT_DEST_WEIGHT,
      assetHubParaId: ASSET_HUB_PARA_ID,
      trustedCaller: TRUSTED_XCM_CALLER,
      defaultSlippageBps: DEFAULT_SLIPPAGE_BPS,
      supportedTokens: tokenAddresses,
      saveState: true,
    });
    proxy = deployment.proxy;
    process.env.XCMPROXY_ADDRESS = deployment.address; // assists subsequent steps
  }

  const testModeDesired = process.env.XCMP_TEST_MODE !== "false";
  const isTestMode = await proxy.testMode();
  if (testModeDesired && !isTestMode) {
    await (await proxy.setTestMode(true)).wait();
    console.log("  Test mode enabled");
  } else if (!testModeDesired && isTestMode) {
    await (await proxy.setTestMode(false)).wait();
    console.log("  Test mode disabled");
  }

  return proxy;
}

async function syncXcmProxyConfig(proxy, desired) {
  const lowercase = (value) => (value ? value.toLowerCase() : value);

  const currentOperator = await proxy.operator();
  if (lowercase(currentOperator) !== lowercase(desired.operator)) {
    await (await proxy.setOperator(desired.operator)).wait();
    console.log(`  Operator updated -> ${desired.operator}`);
  }

  const currentQuoter = await proxy.quoterContract();
  const currentRouter = await proxy.swapRouterContract();
  if (
    lowercase(currentQuoter) !== lowercase(desired.quoter) ||
    lowercase(currentRouter) !== lowercase(desired.router)
  ) {
    await (await proxy.setIntegrations(desired.quoter, desired.router)).wait();
    console.log("  Algebra integrations updated");
  }

  const currentNfpm = await proxy.nfpmContract();
  if (lowercase(currentNfpm) !== lowercase(desired.nfpm)) {
    await (await proxy.setNFPM(desired.nfpm)).wait();
    console.log("  NFPM updated");
  }

  const currentXt = await proxy.xTokensPrecompile();
  if (lowercase(currentXt) !== lowercase(desired.xtokensPrecompile)) {
    await (await proxy.setXTokensPrecompile(desired.xtokensPrecompile)).wait();
    console.log("  xTokens precompile updated");
  }

  const currentTransactor = await proxy.xcmTransactorPrecompile();
  if (lowercase(currentTransactor) !== lowercase(desired.xcmTransactor)) {
    await (await proxy.setXcmTransactorPrecompile(desired.xcmTransactor)).wait();
    console.log("  XCM transactor precompile updated");
  }

  const currentWeight = await proxy.defaultDestWeight();
  if (currentWeight !== desired.destWeight) {
    await (await proxy.setDefaultDestWeight(desired.destWeight)).wait();
    console.log("  Default destination weight updated");
  }

  const currentParaId = Number(await proxy.assetHubParaId());
  if (currentParaId !== desired.assetHubParaId) {
    await (await proxy.setAssetHubParaId(desired.assetHubParaId)).wait();
    console.log("  Asset Hub para ID updated");
  }

  if (desired.trustedCaller && desired.trustedCaller !== ethers.ZeroAddress) {
    const currentTrusted = await proxy.trustedXcmCaller();
    if (lowercase(currentTrusted) !== lowercase(desired.trustedCaller)) {
      await (await proxy.setTrustedXcmCaller(desired.trustedCaller)).wait();
      console.log("  Trusted XCM caller updated");
    }
  }

  const currentSlippage = Number(await proxy.defaultSlippageBps());
  if (currentSlippage !== desired.defaultSlippageBps) {
    await (await proxy.setDefaultSlippageBps(desired.defaultSlippageBps)).wait();
    console.log("  Default slippage updated");
  }

  for (const tokenAddr of desired.supportedTokens) {
    const supported = await proxy.supportedTokens(tokenAddr);
    if (!supported) {
      await (await proxy.addSupportedToken(tokenAddr)).wait();
      console.log(`  Added supported token ${tokenAddr}`);
    }
  }
}

async function ensureProxyFunding(proxy, tokens, amountPerToken) {
  if (!amountPerToken || Number(amountPerToken) === 0) {
    return;
  }
  console.log("\n[5/5] Funding XCMProxy with supported tokens for test flows");
  const proxyAddress = await proxy.getAddress();
  for (const token of tokens) {
    const decimals = await token.decimals();
    const symbol = await token.symbol();
    const desired = ethers.parseUnits(amountPerToken, decimals);
    const current = await token.balanceOf(proxyAddress);
    if (current < desired) {
      const delta = desired - current;
      await (await token.mint(proxyAddress, delta)).wait();
      console.log(`  Minted ${ethers.formatUnits(delta, decimals)} ${symbol} to XCMProxy`);
    } else {
      console.log(`  XCMProxy already funded with ${ethers.formatUnits(current, decimals)} ${symbol}`);
    }
  }
}

async function outputSummary({ algebra, tokens, pool, proxy, network }) {
  const proxyAddress = await proxy.getAddress();
  const tokenSummaries = await Promise.all(
    tokens.map(async (token) => ({
      symbol: await token.symbol(),
      address: await token.getAddress(),
      decimals: await token.decimals(),
    }))
  );
  const supportedTokens = tokenSummaries.map((t) => t.address);
  const baseToken = tokenSummaries[0];
  const quoteToken = tokenSummaries[1] || null;
  let poolLiquidity = "0";
  if (pool && pool.pool) {
    poolLiquidity = (await pool.pool.liquidity()).toString();
  }

  console.log("\n============================================");
  console.log(" Bootstrap Summary");
  console.log("============================================");
  console.log(`XCMProxy: ${proxyAddress}`);
  console.log(`Operator: ${await proxy.operator()}`);
  console.log(`Test mode: ${await proxy.testMode()}`);
  console.log(`Asset Hub Para ID: ${await proxy.assetHubParaId()}`);
  console.log(`Trusted XCM caller: ${await proxy.trustedXcmCaller()}`);
  console.log(`Quoter: ${algebra.addresses.quoter}`);
  console.log(`Router: ${algebra.addresses.router}`);
  console.log(`NFPM: ${algebra.addresses.nfpm}`);
  console.log(`Pool: ${pool.poolAddress}`);
  console.log("Tokens:");
  tokenSummaries.forEach((t) => console.log(`  ${t.symbol}: ${t.address}`));
  console.log("============================================\n");

  const data = {
    generatedAt: new Date().toISOString(),
    network: {
      name: network.name,
      chainId: Number(network.chainId),
    },
    algebra: {
      ...algebra.addresses,
    },
    xcmProxy: {
      address: proxyAddress,
      operator: await proxy.operator(),
      testMode: await proxy.testMode(),
      assetHubParaId: Number(await proxy.assetHubParaId()),
      trustedXcmCaller: await proxy.trustedXcmCaller(),
      defaultSlippageBps: Number(await proxy.defaultSlippageBps()),
      defaultDestWeight: (await proxy.defaultDestWeight()).toString(),
    },
    tokens: tokenSummaries,
    baseToken: baseToken,
    quoteToken: quoteToken,
    supportedTokens,
    pool: {
      address: pool.poolAddress,
      token0: pool.token0Addr,
      token1: pool.token1Addr,
  liquidity: poolLiquidity,
    },
  };

  const bigintReplacer = (_key, value) => (typeof value === "bigint" ? value.toString() : value);
  fs.writeFileSync(BOOTSTRAP_OUTPUT, JSON.stringify(data, bigintReplacer, 2));
  process.env.MOONBASE_BOOTSTRAP_FILE = BOOTSTRAP_OUTPUT;
  if (!process.env.MOONBASE_BASE_TOKEN && baseToken) {
    process.env.MOONBASE_BASE_TOKEN = baseToken.address;
  }
  if (!process.env.MOONBASE_SUPPORTED_TOKENS) {
    process.env.MOONBASE_SUPPORTED_TOKENS = supportedTokens.join(",");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Bootstrap failed:", error);
    process.exit(1);
  });

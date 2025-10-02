const { ethers } = require("hardhat");
const { loadState, saveState, ensureNetwork, ensureContract } = require("../utils/state-manager");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`Deploying XCMProxy on ${network.name} (${network.chainId}) as ${deployer.address}`);

  const config = {
    owner: process.env.XCMP_OWNER || deployer.address,
    operator: process.env.XCMP_OPERATOR || deployer.address,
    quoter: process.env.XCMP_QUOTER || ethers.ZeroAddress,
    router: process.env.XCMP_ROUTER || ethers.ZeroAddress,
    nfpm: process.env.XCMP_NFPM || ethers.ZeroAddress,
    xtokensPrecompile: process.env.XCMP_XTOKENS || ethers.ZeroAddress,
    destWeight: process.env.XCMP_DEST_WEIGHT ? BigInt(process.env.XCMP_DEST_WEIGHT) : 6_000_000_000n,
    assetHubParaId: process.env.XCMP_ASSET_HUB_PARAID ? Number(process.env.XCMP_ASSET_HUB_PARAID) : 0,
    trustedCaller: process.env.XCMP_TRUSTED_CALLER || ethers.ZeroAddress,
    xcmTransactor: process.env.XCMP_TRANSACTOR || ethers.ZeroAddress,
    defaultSlippageBps: process.env.XCMP_DEFAULT_SLIPPAGE ? Number(process.env.XCMP_DEFAULT_SLIPPAGE) : 100,
    supportedTokens: (process.env.XCMP_SUPPORTED_TOKENS || "").split(",").map((x) => x.trim()).filter(Boolean),
    freezeConfig: process.env.XCMP_FREEZE_CONFIG === "true",
  };

  const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
  const proxy = await XCMProxy.deploy(config.owner);
  const tx = proxy.deploymentTransaction();
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`XCMProxy deployed at ${proxyAddress}`);

  const state = loadState();
  const networkEntry = ensureNetwork(state, network.name || String(network.chainId), {
    chainId: Number(network.chainId),
    name: network.name,
  });
  networkEntry.lastRun = new Date().toISOString();
  const contractEntry = ensureContract(networkEntry, "XCMProxy");

  contractEntry.address = proxyAddress;
  contractEntry.deployer = deployer.address;
  contractEntry.deploymentTx = tx ? tx.hash : null;
  contractEntry.timestamp = new Date().toISOString();

  await configureProxy(proxy, config, contractEntry);

  saveState(state);
  console.log("Deployment state saved.");
}

async function configureProxy(proxy, config, contractEntry) {
  const configTxs = [];

  if (config.operator && config.operator !== await proxy.operator()) {
    const tx = await (await proxy.setOperator(config.operator)).wait();
    console.log(`setOperator -> ${config.operator} (tx: ${tx.hash})`);
    configTxs.push({ action: "setOperator", tx: tx.hash });
  }

  if (config.quoter !== ethers.ZeroAddress) {
    const tx = await (await proxy.setIntegrations(config.quoter, config.router)).wait();
    console.log(`setIntegrations(quoter=${config.quoter}, router=${config.router}) -> tx ${tx.hash}`);
    configTxs.push({ action: "setIntegrations", tx: tx.hash, params: { quoter: config.quoter, router: config.router } });
  }

  if (config.nfpm !== ethers.ZeroAddress) {
    const tx = await (await proxy.setNFPM(config.nfpm)).wait();
    console.log(`setNFPM(${config.nfpm}) -> tx ${tx.hash}`);
    configTxs.push({ action: "setNFPM", tx: tx.hash, params: { nfpm: config.nfpm } });
  }

  if (config.xtokensPrecompile !== ethers.ZeroAddress) {
    const existing = await proxy.xTokensPrecompile();
    if (existing !== config.xtokensPrecompile) {
      const tx = await (await proxy.setXTokensPrecompile(config.xtokensPrecompile)).wait();
      console.log(`setXTokensPrecompile(${config.xtokensPrecompile}) -> tx ${tx.hash}`);
      configTxs.push({ action: "setXTokensPrecompile", tx: tx.hash, params: { precompile: config.xtokensPrecompile } });
    }
  }

  if (config.destWeight) {
    const existing = await proxy.defaultDestWeight();
    if (existing !== config.destWeight) {
      const tx = await (await proxy.setDefaultDestWeight(config.destWeight)).wait();
      console.log(`setDefaultDestWeight(${config.destWeight}) -> tx ${tx.hash}`);
      configTxs.push({ action: "setDefaultDestWeight", tx: tx.hash, params: { weight: config.destWeight.toString() } });
    }
  }

  if (config.assetHubParaId) {
    const existing = await proxy.assetHubParaId();
    if (Number(existing) !== config.assetHubParaId) {
      const tx = await (await proxy.setAssetHubParaId(config.assetHubParaId)).wait();
      console.log(`setAssetHubParaId(${config.assetHubParaId}) -> tx ${tx.hash}`);
      configTxs.push({ action: "setAssetHubParaId", tx: tx.hash, params: { paraId: config.assetHubParaId } });
    }
  }

  if (config.trustedCaller !== ethers.ZeroAddress) {
    const existing = await proxy.trustedXcmCaller();
    if (existing !== config.trustedCaller) {
      const tx = await (await proxy.setTrustedXcmCaller(config.trustedCaller)).wait();
      console.log(`setTrustedXcmCaller(${config.trustedCaller}) -> tx ${tx.hash}`);
      configTxs.push({ action: "setTrustedXcmCaller", tx: tx.hash, params: { caller: config.trustedCaller } });
    }
  }

  if (config.xcmTransactor !== ethers.ZeroAddress) {
    const existing = await proxy.xcmTransactorPrecompile();
    if (existing !== config.xcmTransactor) {
      const tx = await (await proxy.setXcmTransactorPrecompile(config.xcmTransactor)).wait();
      console.log(`setXcmTransactorPrecompile(${config.xcmTransactor}) -> tx ${tx.hash}`);
      configTxs.push({ action: "setXcmTransactorPrecompile", tx: tx.hash, params: { precompile: config.xcmTransactor } });
    }
  }

  if (typeof config.defaultSlippageBps === "number") {
    const existing = await proxy.defaultSlippageBps();
    if (Number(existing) !== config.defaultSlippageBps) {
      const tx = await (await proxy.setDefaultSlippageBps(config.defaultSlippageBps)).wait();
      console.log(`setDefaultSlippageBps(${config.defaultSlippageBps}) -> tx ${tx.hash}`);
      configTxs.push({ action: "setDefaultSlippageBps", tx: tx.hash, params: { bps: config.defaultSlippageBps } });
    }
  }

  for (const token of config.supportedTokens) {
    const isSupported = await proxy.supportedTokens(token);
    if (!isSupported) {
      const tx = await (await proxy.addSupportedToken(token)).wait();
      console.log(`addSupportedToken(${token}) -> tx ${tx.hash}`);
      configTxs.push({ action: "addSupportedToken", tx: tx.hash, params: { token } });
    }
  }

  if (config.freezeConfig) {
    const frozen = await proxy.xcmConfigFrozen();
    if (!frozen) {
      const tx = await (await proxy.freezeXcmConfig()).wait();
      console.log(`freezeXcmConfig() -> tx ${tx.hash}`);
      configTxs.push({ action: "freezeXcmConfig", tx: tx.hash });
    }
  }

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

  for (const token of config.supportedTokens) {
    contractEntry.config.supportedTokens[token] = await proxy.supportedTokens(token);
  }

  contractEntry.configurationTxs = configTxs;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



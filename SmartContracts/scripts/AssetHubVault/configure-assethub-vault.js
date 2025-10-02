const { ethers } = require("hardhat");
const { loadState, saveState, ensureNetwork, ensureContract } = require("../utils/state-manager");

async function main() {
  const [caller] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const target = process.env.ASSETHUB_VAULT_ADDRESS;
  if (!target) {
    throw new Error("ASSETHUB_VAULT_ADDRESS env var is required");
  }

  console.log(`Configuring AssetHubVault at ${target} on ${network.name} (${network.chainId}) as ${caller.address}`);

  const vault = await ethers.getContractAt("contracts/V1(Current)/AssetHubVault.sol:AssetHubVault", target);

  const config = {
    admin: process.env.ASSETHUB_ADMIN || caller.address,
    operator: process.env.ASSETHUB_OPERATOR || caller.address,
    emergency: process.env.ASSETHUB_EMERGENCY || caller.address,
    xcmPrecompile: process.env.ASSETHUB_XCM_PRECOMPILE,
    freezePrecompile: process.env.ASSETHUB_FREEZE === "true",
    pause: process.env.ASSETHUB_PAUSE === "true",
  };

  const state = loadState();
  const networkEntry = ensureNetwork(state, network.name || String(network.chainId), {
    chainId: Number(network.chainId),
    name: network.name,
  });
  networkEntry.lastRun = new Date().toISOString();
  const contractEntry = ensureContract(networkEntry, "AssetHubVault");
  contractEntry.address = target;
  contractEntry.lastConfigurator = caller.address;
  contractEntry.timestamp = new Date().toISOString();

  const actions = [];

  if ((await vault.admin()) !== config.admin) {
    const tx = await (await vault.transferAdmin(config.admin)).wait();
    console.log(`transferAdmin(${config.admin}) -> ${tx.hash}`);
    actions.push({ action: "transferAdmin", tx: tx.hash, params: { admin: config.admin } });
  }

  if ((await vault.operator()) !== config.operator) {
    const tx = await (await vault.setOperator(config.operator)).wait();
    console.log(`setOperator(${config.operator}) -> ${tx.hash}`);
    actions.push({ action: "setOperator", tx: tx.hash, params: { operator: config.operator } });
  }

  if ((await vault.emergency()) !== config.emergency) {
    const tx = await (await vault.setEmergency(config.emergency)).wait();
    console.log(`setEmergency(${config.emergency}) -> ${tx.hash}`);
    actions.push({ action: "setEmergency", tx: tx.hash, params: { emergency: config.emergency } });
  }

  if (config.xcmPrecompile) {
    const existing = await vault.XCM_PRECOMPILE();
    if (existing !== config.xcmPrecompile) {
      const tx = await (await vault.setXcmPrecompile(config.xcmPrecompile)).wait();
      console.log(`setXcmPrecompile(${config.xcmPrecompile}) -> ${tx.hash}`);
      actions.push({ action: "setXcmPrecompile", tx: tx.hash, params: { precompile: config.xcmPrecompile } });
    }
  }

  if (config.freezePrecompile) {
    const frozen = await vault.xcmPrecompileFrozen();
    if (!frozen) {
      const tx = await (await vault.freezeXcmPrecompile()).wait();
      console.log(`freezeXcmPrecompile() -> ${tx.hash}`);
      actions.push({ action: "freezeXcmPrecompile", tx: tx.hash });
    }
  }

  if (config.pause !== undefined) {
    const paused = await vault.paused();
    if (config.pause && !paused) {
      const tx = await (await vault.pause()).wait();
      console.log(`pause() -> ${tx.hash}`);
      actions.push({ action: "pause", tx: tx.hash });
    } else if (!config.pause && paused) {
      const tx = await (await vault.unpause()).wait();
      console.log(`unpause() -> ${tx.hash}`);
      actions.push({ action: "unpause", tx: tx.hash });
    }
  }

  contractEntry.config = {
    admin: await vault.admin(),
    operator: await vault.operator(),
    emergency: await vault.emergency(),
    xcmPrecompile: await vault.XCM_PRECOMPILE(),
    xcmPrecompileFrozen: await vault.xcmPrecompileFrozen(),
    paused: await vault.paused(),
  };
  contractEntry.configurationTxs = actions;

  saveState(state);
  console.log("AssetHubVault configuration recorded.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



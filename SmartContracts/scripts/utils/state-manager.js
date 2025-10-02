const fs = require("fs");
const path = require("path");

const DEFAULT_STATE_PATH = path.join(__dirname, "../../deployments/deployment-state.json");

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadState(statePath = DEFAULT_STATE_PATH) {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("deployment state is not an object");
    }
    if (!parsed.networks || typeof parsed.networks !== "object") {
      parsed.networks = {};
    }
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") {
      return { networks: {} };
    }
    throw err;
  }
}

function saveState(state, statePath = DEFAULT_STATE_PATH) {
  ensureDirExists(statePath);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function ensureNetwork(state, networkKey, metadata = {}) {
  if (!state.networks[networkKey]) {
    state.networks[networkKey] = {
      chainId: metadata.chainId,
      name: metadata.name,
      lastRun: null,
      contracts: {},
    };
  } else {
    const target = state.networks[networkKey];
    if (metadata.chainId && !target.chainId) target.chainId = metadata.chainId;
    if (metadata.name && !target.name) target.name = metadata.name;
    if (!target.contracts) target.contracts = {};
  }
  return state.networks[networkKey];
}

function ensureContract(networkState, contractKey) {
  if (!networkState.contracts[contractKey]) {
    networkState.contracts[contractKey] = {};
  }
  return networkState.contracts[contractKey];
}

module.exports = {
  DEFAULT_STATE_PATH,
  loadState,
  saveState,
  ensureNetwork,
  ensureContract,
};



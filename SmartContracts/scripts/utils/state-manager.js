/**
 * State Manager Utility
 * 
 * Manages deployment state persistence across multiple deployments.
 * Saves contract addresses, configurations, and deployment metadata to JSON files.
 * 
 * @module scripts/utils/state-manager
 */

const fs = require("fs");
const path = require("path");

// Default state file location
const STATE_FILE = path.join(__dirname, "../../deployments/deployment-state.json");

/**
 * Load deployment state from file
 * 
 * @param {string} [filePath] - Custom state file path
 * @returns {object} State object (or empty object if file doesn't exist)
 */
function loadState(filePath = STATE_FILE) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`⚠️  Could not load state from ${filePath}:`, error.message);
  }
  return { networks: {} };
}

/**
 * Save deployment state to file
 * 
 * @param {object} state - State object to save
 * @param {string} [filePath] - Custom state file path
 */
function saveState(state, filePath = STATE_FILE) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.warn(`⚠️  Could not save state to ${filePath}:`, error.message);
  }
}

/**
 * Ensure network entry exists in state
 * 
 * @param {object} state - State object
 * @param {string} networkName - Network name (e.g., "moonbase")
 * @param {object} [networkData] - Additional network metadata
 * @returns {object} Network entry
 */
function ensureNetwork(state, networkName, networkData = {}) {
  if (!state.networks) {
    state.networks = {};
  }
  if (!state.networks[networkName]) {
    state.networks[networkName] = {
      ...networkData,
      contracts: {},
    };
  }
  return state.networks[networkName];
}

/**
 * Ensure contract entry exists in network
 * 
 * @param {object} networkEntry - Network entry from state
 * @param {string} contractName - Contract name (e.g., "XCMProxy")
 * @returns {object} Contract entry
 */
function ensureContract(networkEntry, contractName) {
  if (!networkEntry.contracts) {
    networkEntry.contracts = {};
  }
  if (!networkEntry.contracts[contractName]) {
    networkEntry.contracts[contractName] = {};
  }
  return networkEntry.contracts[contractName];
}

module.exports = {
  loadState,
  saveState,
  ensureNetwork,
  ensureContract,
  STATE_FILE,
};

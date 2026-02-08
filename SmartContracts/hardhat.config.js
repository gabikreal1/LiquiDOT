require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Helper to ensure private key has 0x prefix
function normalizePrivateKey(key) {
  if (!key) return "0x0000000000000000000000000000000000000000000000000000000000000000";
  return key.startsWith("0x") ? key : `0x${key}`;
}

// Load private keys from environment variables
const MOON_PRIVATE_KEY = normalizePrivateKey(process.env.MOON_PK);
const ASSET_PRIVATE_KEY = normalizePrivateKey(process.env.ASSET_PK);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 1
      }
    }
  },
  networks: {
    // Local development
    hardhat: {
      chainId: 31337
    },
    // Live Networks (EVM)
    moonbase: {
      url: "https://moonbeam-alpha.api.onfinality.io/public",
      chainId: 1287,
      accounts: [MOON_PRIVATE_KEY],
      gasPrice: 1000000000
    },
    moonbeam: {
      url: "https://rpc.api.moonbeam.network",
      chainId: 1284,
      accounts: [MOON_PRIVATE_KEY],
    },
    passethub: {
      url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
      chainId: 420420422,
      accounts: [ASSET_PRIVATE_KEY],
      // Let the chain determine gas price - Paseo uses higher gas prices
      // gasPrice: "auto" is implicit when not specified
    },
    assethub: {
      url: "https://eth-rpc.polkadot.io",
      chainId: 1000,
      accounts: [ASSET_PRIVATE_KEY],
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-evm",
    artifacts: "./artifacts-evm"
  },
  mocha: {
    timeout: 120000 // 2 minutes for slow testnet transactions
  }
};



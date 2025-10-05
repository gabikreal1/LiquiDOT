require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Load private keys from environment variables
const MOON_PRIVATE_KEY = process.env.MOON_PK || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ASSET_PRIVATE_KEY = process.env.ASSET_PK || "0x0000000000000000000000000000000000000000000000000000000000000000";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
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
      url: "https://rpc.api.moonbase.moonbeam.network",
      chainId: 1287,
      accounts: [MOON_PRIVATE_KEY],
      gasPrice: 1000000000
    },
    passethub: {
      url: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
      chainId: 420420422,
      accounts: [ASSET_PRIVATE_KEY],
      gasPrice: 1000000000,
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-evm",
    artifacts: "./artifacts-evm"
  },
  mocha: {
    timeout: 40000
  }
};



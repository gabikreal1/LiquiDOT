require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Load private keys from environment variables
const MOON_PRIVATE_KEY = process.env.MOON || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ASSET_PRIVATE_KEY = process.env.ASSET || "0x0000000000000000000000000000000000000000000000000000000000000000";


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  solidity: {
    version: "0.8.17",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Moonbase Alpha Testnet
    moonbase: {
      url: "https://moonbase-alpha.public.blastapi.io",
      chainId: 1287,
      accounts: [MOON_PRIVATE_KEY],
      gasPrice: 1000000000
    },
    moonbeam: {
      url: "https://rpc.api.moonbeam.network",
      chainId: 1284,
      accounts: [process.env.BEAM_PRIVATE_KEY],
      gasPrice: 35000000000
    },
    // Asset Hub (Westmint) Testnet
    westmint: {
      url: "https://westend-asset-hub-eth-rpc.polkadot.io",
      chainId: 420420421,
      accounts: [ASSET_PRIVATE_KEY],
      gasPrice: 1000000000,
      
    },

    assethub:{
      url: "https://asset-hub-eth-rpc.polkadot.io",
      chainId: 420420419,
      accounts: [ASSET_PRIVATE_KEY1],
      gasPrice: 1000000000,

    },
    // Local development
    hardhat: {
      chainId: 31337
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
}; 
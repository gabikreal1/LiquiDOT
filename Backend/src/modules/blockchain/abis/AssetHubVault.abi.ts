// Auto-generated from SmartContracts/contracts/V1(Current)/AssetHubVault.sol
// Generated: 2025-11-11T21:39:59.084Z

export const AssetHubVaultABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AmountMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AmountZero",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AssetMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ChainIdMismatch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ChainNotSupported",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExecutorNotAuthorized",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidRange",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAdmin",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotEmergency",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotOperator",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Paused",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PositionNotActive",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnauthorizedXcmCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "XcmPrecompileNotSet",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroAddress",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "xcmDestination",
        "type": "bytes"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "executor",
        "type": "address"
      }
    ],
    "name": "ChainAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      }
    ],
    "name": "ChainRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "Deposit",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "executor",
        "type": "address"
      }
    ],
    "name": "ExecutorUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "poolId",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "InvestmentInitiated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "receivedAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "expectedAmount",
        "type": "uint256"
      }
    ],
    "name": "LiquidationSettled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "remotePositionId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint128",
        "name": "liquidity",
        "type": "uint128"
      }
    ],
    "name": "PositionExecutionConfirmed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "finalAmount",
        "type": "uint256"
      }
    ],
    "name": "PositionLiquidated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "Withdrawal",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "messageHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "destination",
        "type": "bytes"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "message",
        "type": "bytes"
      }
    ],
    "name": "XCMMessageSent",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "precompile",
        "type": "address"
      }
    ],
    "name": "XcmPrecompileSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "messageHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "destination",
        "type": "bytes"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "errorData",
        "type": "bytes"
      }
    ],
    "name": "XcmSendAttempt",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "XCM_PRECOMPILE",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "internalType": "bytes",
        "name": "xcmDestination",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "chainName",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "executor",
        "type": "address"
      }
    ],
    "name": "addChain",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "admin",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "",
        "type": "uint32"
      }
    ],
    "name": "chainExecutors",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "remotePositionId",
        "type": "bytes32"
      },
      {
        "internalType": "uint128",
        "name": "liquidity",
        "type": "uint128"
      }
    ],
    "name": "confirmExecution",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "internalType": "address",
        "name": "poolId",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "baseAsset",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "int24",
        "name": "lowerRangePercent",
        "type": "int24"
      },
      {
        "internalType": "int24",
        "name": "upperRangePercent",
        "type": "int24"
      },
      {
        "internalType": "bytes",
        "name": "destination",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "preBuiltXcmMessage",
        "type": "bytes"
      }
    ],
    "name": "dispatchInvestment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "emergency",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      }
    ],
    "name": "emergencyLiquidatePosition",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "freezeXcmPrecompile",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      }
    ],
    "name": "getChainConfig",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bool",
            "name": "supported",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "xcmDestination",
            "type": "bytes"
          },
          {
            "internalType": "string",
            "name": "chainName",
            "type": "string"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          }
        ],
        "internalType": "struct AssetHubVault.ChainConfig",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      }
    ],
    "name": "getPosition",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "poolId",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "baseAsset",
            "type": "address"
          },
          {
            "internalType": "uint32",
            "name": "chainId",
            "type": "uint32"
          },
          {
            "internalType": "int24",
            "name": "lowerRangePercent",
            "type": "int24"
          },
          {
            "internalType": "int24",
            "name": "upperRangePercent",
            "type": "int24"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "enum AssetHubVault.PositionStatus",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "remotePositionId",
            "type": "bytes32"
          }
        ],
        "internalType": "struct AssetHubVault.Position",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserPositionCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "start",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "name": "getUserPositionIds",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "positionIds",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserPositionStats",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "total",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "pending",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "active",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "liquidated",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserPositions",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "poolId",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "baseAsset",
            "type": "address"
          },
          {
            "internalType": "uint32",
            "name": "chainId",
            "type": "uint32"
          },
          {
            "internalType": "int24",
            "name": "lowerRangePercent",
            "type": "int24"
          },
          {
            "internalType": "int24",
            "name": "upperRangePercent",
            "type": "int24"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "enum AssetHubVault.PositionStatus",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "remotePositionId",
            "type": "bytes32"
          }
        ],
        "internalType": "struct AssetHubVault.Position[]",
        "name": "list",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "enum AssetHubVault.PositionStatus",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "maxResults",
        "type": "uint256"
      }
    ],
    "name": "getUserPositionsByStatus",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "poolId",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "baseAsset",
            "type": "address"
          },
          {
            "internalType": "uint32",
            "name": "chainId",
            "type": "uint32"
          },
          {
            "internalType": "int24",
            "name": "lowerRangePercent",
            "type": "int24"
          },
          {
            "internalType": "int24",
            "name": "upperRangePercent",
            "type": "int24"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "enum AssetHubVault.PositionStatus",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "remotePositionId",
            "type": "bytes32"
          }
        ],
        "internalType": "struct AssetHubVault.Position[]",
        "name": "list",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "start",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "name": "getUserPositionsPage",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "poolId",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "baseAsset",
            "type": "address"
          },
          {
            "internalType": "uint32",
            "name": "chainId",
            "type": "uint32"
          },
          {
            "internalType": "int24",
            "name": "lowerRangePercent",
            "type": "int24"
          },
          {
            "internalType": "int24",
            "name": "upperRangePercent",
            "type": "int24"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "enum AssetHubVault.PositionStatus",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "remotePositionId",
            "type": "bytes32"
          }
        ],
        "internalType": "struct AssetHubVault.Position[]",
        "name": "list",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      }
    ],
    "name": "isChainSupported",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      }
    ],
    "name": "isPositionActive",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "operator",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "positions",
    "outputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "poolId",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "baseAsset",
        "type": "address"
      },
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "internalType": "int24",
        "name": "lowerRangePercent",
        "type": "int24"
      },
      {
        "internalType": "int24",
        "name": "upperRangePercent",
        "type": "int24"
      },
      {
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      },
      {
        "internalType": "enum AssetHubVault.PositionStatus",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "remotePositionId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      }
    ],
    "name": "removeChain",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "setEmergency",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "setOperator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bool",
        "name": "_testMode",
        "type": "bool"
      }
    ],
    "name": "setTestMode",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "precompile",
        "type": "address"
      }
    ],
    "name": "setXcmPrecompile",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "positionId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "receivedAmount",
        "type": "uint256"
      }
    ],
    "name": "settleLiquidation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "",
        "type": "uint32"
      }
    ],
    "name": "supportedChains",
    "outputs": [
      {
        "internalType": "bool",
        "name": "supported",
        "type": "bool"
      },
      {
        "internalType": "bytes",
        "name": "xcmDestination",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "chainName",
        "type": "string"
      },
      {
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "testMode",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newAdmin",
        "type": "address"
      }
    ],
    "name": "transferAdmin",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint32",
        "name": "chainId",
        "type": "uint32"
      },
      {
        "internalType": "address",
        "name": "executor",
        "type": "address"
      }
    ],
    "name": "updateChainExecutor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "userBalances",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "userPositions",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "xcmPrecompileFrozen",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
] as const;

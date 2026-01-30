export const ALGEBRA_FACTORY_ABI = [
  {
    "type": "function",
    "name": "poolByPair",
    "inputs": [
      { "name": "tokenA", "type": "address" },
      { "name": "tokenB", "type": "address" }
    ],
    "outputs": [{ "name": "pool", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Pool",
    "inputs": [
      { "indexed": true, "name": "token0", "type": "address" },
      { "indexed": true, "name": "token1", "type": "address" },
      { "name": "pool", "type": "address" }
    ]
  }
];

export const ALGEBRA_POOL_ABI = [
  {
    "type": "function",
    "name": "safelyGetStateOfAMM",
    "inputs": [],
    "outputs": [
      { "name": "sqrtPrice", "type": "uint160" },
      { "name": "tick", "type": "int24" },
      { "name": "lastFee", "type": "uint16" },
      { "name": "pluginConfig", "type": "uint8" },
      { "name": "activeLiquidity", "type": "uint128" },
      { "name": "nextTick", "type": "int24" },
      { "name": "previousTick", "type": "int24" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "token0",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "token1",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  }
];

export const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

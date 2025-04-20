// xcmProxyAbi.js
export const xcmProxyAbi = [
    // Deposit
    {
      "inputs": [
        { "name": "token", "type": "address" },
        { "name": "amount", "type": "uint256" }
      ],
      "name": "deposit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    // Withdraw
    {
      "inputs": [
        { "name": "token", "type": "address" },
        { "name": "amount", "type": "uint256" }
      ],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    // Get balance
    {
      "inputs": [
        { "name": "user", "type": "address" },
        { "name": "token", "type": "address" }
      ],
      "name": "getUserTokenBalance",
      "outputs": [{ "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    // Token deposit event
    {
      "anonymous": false,
      "inputs": [
        { "indexed": true, "name": "token", "type": "address" },
        { "indexed": true, "name": "user", "type": "address" },
        { "indexed": false, "name": "amount", "type": "uint256" }
      ],
      "name": "TokenDeposited",
      "type": "event"
    },
    // Token withdraw event
    {
      "anonymous": false,
      "inputs": [
        { "indexed": true, "name": "token", "type": "address" },
        { "indexed": true, "name": "user", "type": "address" },
        { "indexed": false, "name": "amount", "type": "uint256" }
      ],
      "name": "TokenWithdrawn",
      "type": "event"
    }
  ];
  
  // Regular ERC20 ABI for token approvals
  export const erc20Abi = [
    // Approve function
    {
      "inputs": [
        { "name": "spender", "type": "address" },
        { "name": "amount", "type": "uint256" }
      ],
      "name": "approve",
      "outputs": [{ "name": "", "type": "bool" }],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    // Allowance function
    {
      "inputs": [
        { "name": "owner", "type": "address" },
        { "name": "spender", "type": "address" }
      ],
      "name": "allowance",
      "outputs": [{ "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    // Balance function
    {
      "inputs": [{ "name": "account", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    }
  ];
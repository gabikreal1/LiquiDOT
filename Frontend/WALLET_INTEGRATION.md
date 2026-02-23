# Wallet Integration Guide

Technical reference for integrating both EVM and Substrate wallets into the LiquiDOT frontend.

---

## Architecture Overview

LiquiDOT needs to support two types of users:

1. **EVM users** (MetaMask, Coinbase Wallet, WalletConnect) — interact via standard Ethereum JSON-RPC
2. **Substrate users** (Talisman, SubWallet, Polkadot.js) — interact via Substrate extensions or their EVM provider injection

The smart contract (`AssetHubVault`) lives on **Polkadot Asset Hub**, which runs an EVM-compatible layer via **pallet-revive**. It exposes a standard Ethereum JSON-RPC endpoint, so MetaMask and all EVM tooling work natively.

```
┌──────────────────────────────────────────────────────┐
│                    LiquiDOT Frontend                  │
│                                                       │
│  ┌─────────────┐   ┌──────────────────────────────┐  │
│  │  EVM Path    │   │  Substrate Path (enhancement) │  │
│  │  (wagmi)     │   │  (@polkadot/extension-dapp)   │  │
│  └──────┬───────┘   └──────────────┬────────────────┘  │
│         │                          │                    │
│         ▼                          ▼                    │
│  window.ethereum            window.injectedWeb3         │
│  window.talismanEth         (Talisman, SubWallet,       │
│  (Talisman EVM)              Polkadot.js extension)     │
│         │                          │                    │
│         ▼                          ▼                    │
│  ┌──────────────┐   ┌─────────────────────────────┐   │
│  │ ETH JSON-RPC  │   │  Substrate RPC               │   │
│  │ (Asset Hub)   │   │  (pallet-revive extrinsic)   │   │
│  └──────┬────────┘   └──────────────┬───────────────┘   │
│         │                           │                    │
│         └─────────┬─────────────────┘                    │
│                   ▼                                      │
│          AssetHubVault.sol                               │
│          (pallet-revive / PolkaVM)                       │
└──────────────────────────────────────────────────────────┘
```

---

## Chain Configuration

### Networks

| Network | Chain ID | ETH RPC Endpoint | Native Token | Use |
|---------|----------|------------------|--------------|-----|
| **Asset Hub** (Polkadot) | 420420419 | `https://asset-hub-eth-rpc.polkadot.io` | DOT (18 decimals) | Mainnet — deposits, custody |
| **Paseo Asset Hub** | 420420422 | `https://testnet-passet-hub-eth-rpc.polkadot.io` | PAS (18 decimals) | Testnet — current dev target |
| **Moonbeam** | 1284 | `https://rpc.api.moonbeam.network` | GLMR (18 decimals) | Mainnet — LP execution |
| **Moonbase Alpha** | 1287 | `https://rpc.api.moonbase.moonbeam.network` | DEV (18 decimals) | Testnet — LP execution |

### Wagmi Chain Definitions

```typescript
// lib/chains.ts
import { defineChain } from 'viem';

export const assetHub = defineChain({
  id: 420420419,
  name: 'Polkadot Asset Hub',
  nativeCurrency: { name: 'DOT', symbol: 'DOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://asset-hub-eth-rpc.polkadot.io'] },
  },
  blockExplorers: {
    default: { name: 'Subscan', url: 'https://assethub-polkadot.subscan.io' },
  },
});

export const paseoAssetHub = defineChain({
  id: 420420422,
  name: 'Paseo Asset Hub',
  nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'] },
  },
});

export const moonbeam = defineChain({
  id: 1284,
  name: 'Moonbeam',
  nativeCurrency: { name: 'GLMR', symbol: 'GLMR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.api.moonbeam.network'] },
  },
  blockExplorers: {
    default: { name: 'Moonscan', url: 'https://moonbeam.moonscan.io' },
  },
});

export const moonbaseAlpha = defineChain({
  id: 1287,
  name: 'Moonbase Alpha',
  nativeCurrency: { name: 'DEV', symbol: 'DEV', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.api.moonbase.moonbeam.network'] },
  },
  blockExplorers: {
    default: { name: 'Moonscan', url: 'https://moonbase.moonscan.io' },
  },
});
```

### Wagmi Config

```typescript
// lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';
import { paseoAssetHub, moonbaseAlpha } from './chains';

export const config = createConfig({
  chains: [paseoAssetHub, moonbaseAlpha], // testnet
  // chains: [assetHub, moonbeam],        // mainnet
  connectors: [
    injected(),           // MetaMask + any injected EVM provider
    coinbaseWallet({ appName: 'LiquiDOT' }),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: {
    [paseoAssetHub.id]: http(),
    [moonbaseAlpha.id]: http(),
  },
});
```

**Important**: Remove `mainnet` and `sepolia` from the current config. LiquiDOT operates on Asset Hub + Moonbeam only.

---

## Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| AssetHubVault | Paseo Asset Hub (testnet) | `0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6` |
| XCMProxy | Moonbase Alpha (testnet) | `0x7f4b3620d6Ffcc15b11ca8679c57c076DCE109d1` |
| XCMProxy | Moonbeam (mainnet) | `0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230` |

---

## AssetHubVault Contract Interface

The vault is the only contract users interact with directly. It lives on Asset Hub.

### ABI (Relevant Functions)

```solidity
// Deposit native DOT into the vault
function deposit() external payable;

// Withdraw native DOT from the vault
function withdraw(uint256 amount) external;

// Read user's vault balance
function userBalances(address user) external view returns (uint256);

// Read user's position IDs (paginated)
function getUserPositionsPage(address user, uint256 offset, uint256 limit)
    external view returns (bytes32[] memory);

// Read position details
function positions(bytes32 positionId) external view returns (
    address user,
    address poolId,
    address baseAsset,
    uint32 chainId,
    int24 lowerRangePercent,
    int24 upperRangePercent,
    uint64 timestamp,
    uint8 status,       // PositionStatus enum
    uint256 amount,
    bytes32 remotePositionId
);

// Read total positions count for a user
function getUserPositionCount(address user) external view returns (uint256);
```

### Deposit Flow (wagmi)

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

// ABI for deposit (payable, no args)
const VAULT_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'userBalances', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
] as const;

const VAULT_ADDRESS = '0x68e86F267C5C37dd4947ef8e5823eBAeAf93Fde6'; // Paseo testnet

function DepositButton({ amount }: { amount: string }) {
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleDeposit = () => {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'deposit',
      value: parseEther(amount), // DOT amount in wei (18 decimals)
    });
  };

  return (
    <button onClick={handleDeposit} disabled={isLoading}>
      {isLoading ? 'Confirming...' : `Deposit ${amount} DOT`}
    </button>
  );
}
```

### Read Vault Balance (wagmi)

```typescript
import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';

function VaultBalance({ userAddress }: { userAddress: `0x${string}` }) {
  const { data: balance } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'userBalances',
    args: [userAddress],
    chainId: 420420422, // Paseo Asset Hub
  });

  return <span>{balance ? formatEther(balance) : '0'} DOT</span>;
}
```

### Withdraw Flow (wagmi)

```typescript
function WithdrawButton({ amount }: { amount: string }) {
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading } = useWaitForTransactionReceipt({ hash });

  const handleWithdraw = () => {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'withdraw',
      args: [parseEther(amount)],
    });
  };

  return (
    <button onClick={handleWithdraw} disabled={isLoading}>
      {isLoading ? 'Confirming...' : `Withdraw ${amount} DOT`}
    </button>
  );
}
```

---

## EVM Wallet Integration (P0)

This is the primary path. Supports MetaMask, Coinbase Wallet, WalletConnect, and Talisman/SubWallet in EVM mode.

### Wallet Detection

Talisman injects `window.talismanEth` as a separate EVM provider (doesn't override `window.ethereum`). wagmi's `injected()` connector detects `window.ethereum` by default, which covers MetaMask. To also detect Talisman EVM:

```typescript
import { injected } from 'wagmi/connectors';

// In wagmi config connectors array:
connectors: [
  injected(),                                           // MetaMask
  injected({ target: 'talismanEth' }),                  // Talisman EVM
  coinbaseWallet({ appName: 'LiquiDOT' }),
  walletConnect({ projectId: '...' }),
],
```

Or detect at runtime:

```typescript
function getAvailableWallets() {
  const wallets = [];
  if (typeof window !== 'undefined') {
    if (window.ethereum) wallets.push({ name: 'MetaMask', provider: window.ethereum });
    if ((window as any).talismanEth) wallets.push({ name: 'Talisman', provider: (window as any).talismanEth });
  }
  return wallets;
}
```

### Auth Flow (SIWE)

After wallet connection, authenticate with the backend:

```typescript
async function signInWithEthereum(address: string, signMessage: (args: { message: string }) => Promise<string>) {
  // 1. Create SIWE message
  const message = `Sign in to LiquiDOT\n\nAddress: ${address}\nTimestamp: ${new Date().toISOString()}`;

  // 2. Sign with wallet
  const signature = await signMessage({ message });

  // 3. Send to backend
  const response = await fetch('/api/auth/login/evm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, message, signature }),
  });

  const { access_token, user } = await response.json();
  // Store access_token for subsequent API calls
  return { accessToken: access_token, user };
}
```

### Gas Estimation Note

Asset Hub's gas model differs from standard EVM. The dynamic pricing covers `ref_time`, `proof_size`, and `storage_deposit`. Let wagmi/viem handle gas estimation automatically — **do not hardcode gas limits**.

---

## Substrate Wallet Integration (P2 — Enhancement)

For users who only have Polkadot.js extension (no EVM provider). Adds complexity but covers more of the Polkadot ecosystem.

### Required Packages

```bash
pnpm add @polkadot/extension-dapp @polkadot/util-crypto @talismn/siws
```

### Wallet Detection & Connection

```typescript
'use client';

import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';

async function connectSubstrateWallet() {
  // Must be called in browser only (no SSR)
  const extensions = await web3Enable('LiquiDOT');

  if (extensions.length === 0) {
    throw new Error('No Substrate wallet found. Install Talisman or Polkadot.js extension.');
  }

  const accounts = await web3Accounts();
  // accounts: Array<{ address: string, meta: { name: string, source: string } }>

  return accounts;
}
```

**Next.js requirement**: Must use dynamic import with `ssr: false`:

```typescript
import dynamic from 'next/dynamic';
const SubstrateConnect = dynamic(() => import('@/components/SubstrateConnect'), { ssr: false });
```

### Auth Flow (SIWS)

```typescript
import { web3FromAddress } from '@polkadot/extension-dapp';

async function signInWithSubstrate(address: string) {
  const injected = await web3FromAddress(address);

  // 1. Create message
  const message = `Sign in to LiquiDOT\n\nAddress: ${address}\nTimestamp: ${new Date().toISOString()}`;

  // 2. Sign with Substrate wallet
  const { signature } = await injected.signer.signRaw!({
    address,
    data: message,    // or stringToHex(message)
    type: 'bytes',
  });

  // 3. Send to backend
  const response = await fetch('/api/auth/login/substrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, message, signature }),
  });

  const { access_token, user } = await response.json();
  return { accessToken: access_token, user };
}
```

### Depositing from a Substrate Wallet

A Substrate-native user can interact with the AssetHubVault EVM contract, but:

1. **Must call `revive.mapAccount()` first** (one-time, maps their AccountId32 → H160)
2. Their `msg.sender` will be `Keccak-256(AccountId32)[last 20 bytes]` — deterministic but different from any EVM address
3. They interact via the ETH RPC proxy (same endpoint), signing with their Substrate key

This adds complexity. For MVP, recommend directing Substrate users to use Talisman/SubWallet in EVM mode.

---

## Address Mapping

### EE-Padding (H160 → AccountId32)

When displaying a user's Substrate-format address from their EVM address:

```typescript
// Used for display purposes / cross-chain reference
function evmToSubstrateAddress(h160: string): string {
  const addr = h160.startsWith('0x') ? h160.slice(2) : h160;
  return '0x' + addr + 'EE'.repeat(12);
}
```

### Display Formatting

```typescript
function formatAddress(address: string, type: 'evm' | 'substrate'): string {
  if (type === 'evm') {
    // 0x1234...5678
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  // For SS58: 5Grw...X3Pb
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
```

---

## Provider Architecture

### Recommended Provider Hierarchy

```typescript
// app/layout.tsx
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <WalletProvider>               {/* EVM wallet state */}
      <SubstrateProvider>          {/* Substrate wallet state (P2) */}
        <AuthProvider>             {/* JWT token + user state */}
          <BackendUserProvider>    {/* Backend user sync */}
            {children}
          </BackendUserProvider>
        </AuthProvider>
      </SubstrateProvider>
    </WalletProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### Unified Wallet Context

```typescript
interface UnifiedWalletState {
  // Connection
  isConnected: boolean;
  walletType: 'evm' | 'substrate' | null;
  address: string | null;         // H160 for EVM, SS58 for Substrate
  displayAddress: string | null;  // Shortened for UI

  // Balance
  vaultBalance: bigint | null;    // From AssetHubVault.userBalances()
  walletBalance: bigint | null;   // Native balance in wallet

  // Auth
  isAuthenticated: boolean;
  userId: string | null;          // UUID from backend
  accessToken: string | null;

  // Actions
  connect: (type: 'evm' | 'substrate') => Promise<void>;
  disconnect: () => void;
  signIn: () => Promise<void>;
}
```

---

## Transaction Monitoring

After a deposit or withdrawal, monitor the transaction:

```typescript
import { useWaitForTransactionReceipt } from 'wagmi';

function TransactionStatus({ hash }: { hash: `0x${string}` }) {
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
    chainId: 420420422, // Paseo Asset Hub
  });

  if (isLoading) return <span>Confirming on Asset Hub...</span>;
  if (isSuccess) return <span>Deposit confirmed!</span>;
  if (isError) return <span>Transaction failed</span>;
  return null;
}
```

Asset Hub block time is ~6 seconds, so confirmation is fast.

---

## Backend API Integration

All API calls after auth use JWT Bearer token:

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiCall(path: string, options: RequestInit = {}) {
  const token = getStoredAccessToken(); // from auth context
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Endpoints
export const api = {
  // Auth
  loginEvm: (data: { address: string; message: string; signature: string }) =>
    apiCall('/auth/login/evm', { method: 'POST', body: JSON.stringify(data) }),
  loginSubstrate: (data: { address: string; message: string; signature: string }) =>
    apiCall('/auth/login/substrate', { method: 'POST', body: JSON.stringify(data) }),

  // User
  register: (walletAddress: string) =>
    apiCall('/users', { method: 'POST', body: JSON.stringify({ walletAddress }) }),

  // Dashboard
  getDashboard: (userId: string) => apiCall(`/dashboard/${userId}`),

  // Preferences
  getPreferences: (userId: string) => apiCall(`/preferences/${userId}`),
  updatePreferences: (userId: string, prefs: Partial<UserPreference>) =>
    apiCall(`/preferences/${userId}`, { method: 'PATCH', body: JSON.stringify(prefs) }),

  // Positions (SSE for real-time)
  getPositionEventsUrl: (userId: string) => `${API_BASE}/api/positions/user/${userId}/events`,
};
```

---

## Implementation Checklist

### P0 — Core (EVM wallets on Asset Hub)
- [ ] Define Asset Hub + Moonbeam chain objects in wagmi config
- [ ] Remove Ethereum mainnet/sepolia from chain config
- [ ] Add AssetHubVault ABI to `lib/abis.ts`
- [ ] Implement deposit flow (send native DOT to vault)
- [ ] Implement withdraw flow
- [ ] Read vault balance via `useReadContract`
- [ ] Add SIWE auth flow (sign message → POST /auth/login/evm → store JWT)
- [ ] Switch network prompt (ensure user is on Asset Hub for deposits)
- [ ] Transaction confirmation UI

### P1 — Enhanced EVM Support
- [ ] Detect Talisman EVM provider (`window.talismanEth`)
- [ ] Add wallet selection UI showing available providers
- [ ] Add WalletConnect project ID (get from cloud.walletconnect.com)
- [ ] Handle chain switching between Asset Hub and Moonbeam
- [ ] Gas estimation handling (don't hardcode)

### P2 — Substrate Wallet Support
- [ ] Install `@polkadot/extension-dapp`, `@polkadot/util-crypto`, `@talismn/siws`
- [ ] Add `SubstrateProvider` context
- [ ] Detect Substrate wallets via `web3Enable()`
- [ ] Implement SIWS auth flow
- [ ] Handle `revive.mapAccount()` for first-time Substrate users
- [ ] Address display formatting (SS58 vs H160)
- [ ] Unified wallet context combining EVM + Substrate state

### P3 — Polish
- [ ] Unified wallet modal (show both EVM and Substrate options)
- [ ] Auto-detect best wallet type for user
- [ ] Address book / recent addresses
- [ ] Transaction history from on-chain events
- [ ] Network health indicator

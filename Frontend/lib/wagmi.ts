import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "";

/**
 * Polkadot Hub (Asset Hub EVM) — Mainnet
 * Chain ID: 420420419
 * RPC: https://eth-rpc.polkadot.io
 */
export const polkadotHub = defineChain({
  id: 420420419,
  name: "Polkadot Hub",
  nativeCurrency: {
    decimals: 18,
    name: "DOT",
    symbol: "DOT",
  },
  rpcUrls: {
    default: {
      http: ["https://eth-rpc.polkadot.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout.polkadot.io",
    },
  },
});

/**
 * Paseo PassetHub — Testnet
 * Chain ID: 420420422
 * RPC: https://testnet-passet-hub-eth-rpc.polkadot.io
 */
export const paseoPassetHub = defineChain({
  id: 420420422,
  name: "Paseo PassetHub",
  nativeCurrency: {
    decimals: 18,
    name: "PAS",
    symbol: "PAS",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-passet-hub-eth-rpc.polkadot.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io",
    },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [polkadotHub, paseoPassetHub],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "LiquiDOT" }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [polkadotHub.id]: http("https://eth-rpc.polkadot.io"),
    [paseoPassetHub.id]: http(
      "https://testnet-passet-hub-eth-rpc.polkadot.io"
    ),
  },
});

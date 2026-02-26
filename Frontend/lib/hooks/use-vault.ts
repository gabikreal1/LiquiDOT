"use client";

import { useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  useSwitchChain,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { assetHubVaultAbi } from "@/lib/contracts/abis";
import {
  ASSET_HUB_VAULT_ADDRESS,
  VAULT_CHAIN_ID,
} from "@/lib/contracts/addresses";

// ── Vault balance (on-chain read) ──────────────────────────────────

export function useVaultBalance() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContract({
    address: ASSET_HUB_VAULT_ADDRESS,
    abi: assetHubVaultAbi,
    functionName: "getUserBalance",
    args: address ? [address] : undefined,
    chainId: VAULT_CHAIN_ID,
    query: { enabled: !!address },
  });

  const balance = (data as bigint) ?? BigInt(0);

  return {
    balance,
    formatted: formatEther(balance),
    isLoading,
    refetch,
  };
}

// ── Wallet balance (native DOT on Asset Hub) ───────────────────────

export function useWalletBalance() {
  const { address } = useAccount();

  const { data, isLoading } = useBalance({
    address,
    chainId: VAULT_CHAIN_ID,
  });

  return {
    balance: data?.value ?? BigInt(0),
    formatted: data?.formatted ?? "0",
    symbol: data?.symbol ?? "PAS",
    isLoading,
  };
}

// ── Chain check ────────────────────────────────────────────────────

export function useVaultChain() {
  const { chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  return {
    isCorrectChain: chainId === VAULT_CHAIN_ID,
    switchToVaultChain: () => switchChain({ chainId: VAULT_CHAIN_ID }),
    isSwitching: isPending,
  };
}

// ── Deposit ────────────────────────────────────────────────────────

export function useDeposit() {
  const queryClient = useQueryClient();

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Invalidate dashboard queries on success
  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  }, [isSuccess, queryClient]);

  function deposit(amount: string) {
    writeContract({
      address: ASSET_HUB_VAULT_ADDRESS,
      abi: assetHubVaultAbi,
      functionName: "deposit",
      value: parseEther(amount),
      chainId: VAULT_CHAIN_ID,
    });
  }

  return { deposit, isPending, isConfirming, isSuccess, txHash, error, reset };
}

// ── Withdraw ───────────────────────────────────────────────────────

export function useWithdraw() {
  const queryClient = useQueryClient();

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  }, [isSuccess, queryClient]);

  function withdraw(amount: string) {
    writeContract({
      address: ASSET_HUB_VAULT_ADDRESS,
      abi: assetHubVaultAbi,
      functionName: "withdraw",
      args: [parseEther(amount)],
      chainId: VAULT_CHAIN_ID,
    });
  }

  return {
    withdraw,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
    error,
    reset,
  };
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useVaultBalance,
  useWalletBalance,
  useVaultChain,
  useDeposit,
  useWithdraw,
} from "@/lib/hooks/use-vault";
import { getExplorerUrl } from "@/lib/utils/explorer";
import { truncateHash } from "@/lib/utils/format";
import { VAULT_CHAIN_ID } from "@/lib/contracts/addresses";

type Tab = "deposit" | "withdraw";

export function VaultPanel() {
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");

  const { formatted: vaultBalance, isLoading: vaultLoading, refetch: refetchVault } = useVaultBalance();
  const { formatted: walletBalance, symbol, isLoading: walletLoading } = useWalletBalance();
  const { isCorrectChain, switchToVaultChain, isSwitching } = useVaultChain();

  const deposit = useDeposit();
  const withdraw = useWithdraw();

  const active = tab === "deposit" ? deposit : withdraw;
  const maxBalance = tab === "deposit" ? walletBalance : vaultBalance;

  // Reset form when switching tabs
  useEffect(() => {
    setAmount("");
    deposit.reset();
    withdraw.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Refetch vault balance on success
  useEffect(() => {
    if (active.isSuccess) {
      refetchVault();
    }
  }, [active.isSuccess, refetchVault]);

  const parsedAmount = parseFloat(amount);
  const isValidAmount =
    !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= parseFloat(maxBalance);

  function handleSubmit() {
    if (!isValidAmount) return;
    if (tab === "deposit") {
      deposit.deposit(amount);
    } else {
      withdraw.withdraw(amount);
    }
  }

  function handleMax() {
    setAmount(maxBalance);
  }

  // ── Wrong chain state ────────────────────────────────────────────
  if (!isCorrectChain) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <p className="font-display text-base font-semibold text-ld-ink">
            Wrong Network
          </p>
          <p className="mt-1 text-sm text-ld-slate">
            Switch to Polkadot Asset Hub to continue.
          </p>
        </div>
        <Button
          onClick={switchToVaultChain}
          disabled={isSwitching}
          className="bg-ld-primary text-white hover:bg-ld-primary/90"
        >
          {isSwitching ? "Switching..." : "Switch Network"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tab row */}
      <div className="flex gap-1 rounded-lg bg-ld-light-2 p-1">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white text-ld-ink shadow-sm"
                : "text-ld-slate hover:text-ld-ink"
            }`}
          >
            {t === "deposit" ? (
              <ArrowDownToLine className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpFromLine className="h-3.5 w-3.5" />
            )}
            {t === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        ))}
      </div>

      {/* Balance info */}
      <div className="flex justify-between rounded-lg border border-black/5 bg-ld-light-1 px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Vault Balance
          </div>
          <div className="font-mono text-sm font-medium text-ld-ink">
            {vaultLoading ? "..." : `${parseFloat(vaultBalance).toFixed(4)} ${symbol}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Wallet Balance
          </div>
          <div className="font-mono text-sm font-medium text-ld-ink">
            {walletLoading ? "..." : `${parseFloat(walletBalance).toFixed(4)} ${symbol}`}
          </div>
        </div>
      </div>

      {/* Amount input */}
      <div>
        <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
          Amount ({symbol})
        </label>
        <div className="relative">
          <input
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={active.isPending || active.isConfirming}
            className="h-[42px] w-full rounded-lg border border-black/10 bg-white px-3 pr-16 font-mono text-sm text-ld-ink outline-none transition-colors focus:border-ld-primary focus:ring-1 focus:ring-ld-primary/20 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleMax}
            disabled={active.isPending || active.isConfirming}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-ld-primary/10 px-2 py-0.5 text-[11px] font-semibold text-ld-primary transition-colors hover:bg-ld-primary/20 disabled:opacity-50"
          >
            MAX
          </button>
        </div>
        {amount && !isValidAmount && parsedAmount > parseFloat(maxBalance) && (
          <p className="mt-1 text-[11px] text-red-500">
            Exceeds {tab === "deposit" ? "wallet" : "vault"} balance
          </p>
        )}
      </div>

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!isValidAmount || active.isPending || active.isConfirming}
        className="h-11 w-full bg-ld-primary text-white hover:bg-ld-primary/90 disabled:opacity-50"
      >
        {active.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirm in wallet...
          </span>
        ) : active.isConfirming ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirming...
          </span>
        ) : (
          tab === "deposit" ? "Deposit" : "Withdraw"
        )}
      </Button>

      {/* Tx status */}
      <AnimatePresence mode="wait">
        {active.isSuccess && active.txHash && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-green-800">
                {tab === "deposit" ? "Deposit" : "Withdrawal"} confirmed
              </p>
              <a
                href={getExplorerUrl(VAULT_CHAIN_ID, active.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-center gap-1 text-xs text-green-600 hover:underline"
              >
                {truncateHash(active.txHash, 6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </motion.div>
        )}

        {active.error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">
              {(active.error as Error).message?.includes("User rejected")
                ? "Transaction rejected"
                : "Transaction failed. Please try again."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

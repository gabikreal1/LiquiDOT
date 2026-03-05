"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";

export function WalletHero() {
  const { walletAddress } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl bg-ld-dark p-6"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 animate-pulse rounded-full bg-ld-accent/5 blur-3xl" />

      <div className="flex items-center gap-4">
        {/* Avatar gradient circle */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ld-accent to-ld-primary">
          <span className="text-lg font-bold text-white">
            {walletAddress ? walletAddress.slice(2, 4).toUpperCase() : "??"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-ld-frost/60">Connected Wallet</p>
          <p className="truncate font-mono text-sm text-white">
            {walletAddress ?? "Not connected"}
          </p>
          <p className="mt-1 text-xs text-ld-frost/40">Moonbeam Network</p>
        </div>

        {walletAddress && (
          <button
            onClick={handleCopy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-ld-frost/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            {copied ? (
              <Check className="h-4 w-4 text-ld-accent" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {copied && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-2 text-center text-xs text-ld-accent"
        >
          Copied to clipboard
        </motion.p>
      )}
    </motion.div>
  );
}

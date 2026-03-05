"use client";

import { motion } from "motion/react";
import { Copy, Check, Wallet, User, Calendar, Shield } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { truncateHash } from "@/lib/utils/format";
import { useAuthStore } from "@/lib/store/auth-store";

function DataRow({
  icon: Icon,
  label,
  value,
  mono,
  copiable,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  mono?: boolean;
  copiable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ld-accent/10">
          <Icon className="h-4 w-4 text-ld-primary" />
        </div>
        <span className="text-sm text-ld-slate">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium text-ld-ink ${mono ? "font-mono" : ""}`}
        >
          {mono && value.length > 20 ? truncateHash(value, 8) : value}
        </span>
        {copiable && (
          <button
            onClick={handleCopy}
            className="rounded p-1 text-ld-slate transition-colors hover:bg-ld-gray/10 hover:text-ld-ink"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function AccountCard() {
  const { walletAddress, userId } = useAuthStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
    >
      <Card className="border-ld-gray/20 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-ld-ink">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <DataRow
            icon={Wallet}
            label="Wallet Address"
            value={walletAddress ?? "—"}
            mono
            copiable={!!walletAddress}
          />
          <Separator className="bg-ld-gray/10" />
          <DataRow
            icon={User}
            label="User ID"
            value={userId ?? "—"}
            mono
            copiable={!!userId}
          />
          <Separator className="bg-ld-gray/10" />
          <DataRow
            icon={Calendar}
            label="Member Since"
            value="February 1, 2026"
          />
          <Separator className="bg-ld-gray/10" />
          <DataRow
            icon={Shield}
            label="Status"
            value="Active"
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

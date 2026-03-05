"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings } from "lucide-react";
import {
  SettingsSidebar,
  type SettingsSection,
} from "@/components/settings/settings-sidebar";
import { AccountCard } from "@/components/settings/account-card";
import { WalletHero } from "@/components/settings/wallet-hero";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { ConnectedChains } from "@/components/settings/connected-chains";
import { DangerZone } from "@/components/settings/danger-zone";
import Link from "next/link";

function AccountSection() {
  return (
    <div className="space-y-6">
      <AccountCard />
      <ConnectedChains />
    </div>
  );
}

function WalletSection() {
  return (
    <div className="space-y-6">
      <WalletHero />
      <DangerZone />
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="space-y-6">
      <NotificationsCard />
    </div>
  );
}

function AdvancedSection() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-xl border border-ld-gray/20 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ld-ink">
              Strategy Configuration
            </p>
            <p className="mt-0.5 text-xs text-ld-slate">
              Adjust your automated LP management preferences.
            </p>
          </div>
          <Link
            href="/dashboard/strategy"
            className="rounded-lg bg-ld-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ld-primary/90"
          >
            Open Strategy
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.06, ease: "easeOut" }}
        className="rounded-xl border border-ld-gray/20 bg-white p-5 shadow-sm"
      >
        <p className="text-sm font-semibold text-ld-ink">API & Environment</p>
        <p className="mt-0.5 text-xs text-ld-slate">
          Backend API and mock data configuration.
        </p>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-ld-light-2 px-3 py-2">
            <span className="text-xs text-ld-slate">Mock Mode</span>
            <span className="font-mono text-xs text-ld-ink">
              {process.env.NEXT_PUBLIC_USE_MOCK === "true" ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-ld-light-2 px-3 py-2">
            <span className="text-xs text-ld-slate">API URL</span>
            <span className="font-mono text-xs text-ld-ink">
              {process.env.NEXT_PUBLIC_API_URL || "Not set"}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const sectionComponents: Record<SettingsSection, React.ComponentType> = {
  account: AccountSection,
  wallet: WalletSection,
  notifications: NotificationsSection,
  advanced: AdvancedSection,
};

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("account");

  // Sync with URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1) as SettingsSection;
    if (hash && sectionComponents[hash]) {
      setActive(hash);
    }
  }, []);

  const handleChange = (section: SettingsSection) => {
    setActive(section);
    window.location.hash = section;
  };

  const ActiveComponent = sectionComponents[active];

  return (
    <div className="mx-auto max-w-[960px] px-6 py-12 sm:px-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mb-8"
      >
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ld-accent/10">
            <Settings className="h-5 w-5 text-ld-primary" />
          </div>
          <h1 className="text-h2 text-ld-ink">Settings</h1>
        </div>
        <p className="mt-1 text-body text-ld-slate">
          Manage your wallet, notifications, and account details.
        </p>
      </motion.div>

      {/* Sidebar + Content layout */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <SettingsSidebar active={active} onChange={handleChange} />

        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

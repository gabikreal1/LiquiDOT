"use client";

import { motion } from "motion/react";
import { User, Wallet, Bell, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SettingsSection = "account" | "wallet" | "notifications" | "advanced";

const items: { id: SettingsSection; label: string; Icon: LucideIcon }[] = [
  { id: "account", label: "Account", Icon: User },
  { id: "wallet", label: "Wallet", Icon: Wallet },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "advanced", label: "Advanced", Icon: SlidersHorizontal },
];

interface SettingsSidebarProps {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
}

export function SettingsSidebar({ active, onChange }: SettingsSidebarProps) {
  return (
    <motion.nav
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
      }}
      className="w-full lg:w-[260px]"
    >
      {/* Desktop: vertical sidebar */}
      <div className="hidden lg:block">
        <div className="relative space-y-1">
          {items.map((item) => {
            const Icon = item.Icon;
            const isActive = active === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-ld-ink shadow-sm"
                    : "text-ld-slate hover:bg-ld-light-2 hover:text-ld-ink"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="settingsSidebarIndicator"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-ld-primary"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: horizontal tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-ld-light-2 p-1 lg:hidden">
        {items.map((item) => {
          const Icon = item.Icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-ld-ink"
                  : "text-ld-slate hover:text-ld-ink"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="settingsMobileIndicator"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}

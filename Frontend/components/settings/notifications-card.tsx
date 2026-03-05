"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/*
 * ┌─────────────────────────────────────────────────────────────┐
 * │  BACKEND MATE: Add notification preferences endpoint        │
 * │  PUT /api/users/{userId}/notifications                      │
 * │  Body: { positionAlerts, liquidationAlerts,                 │
 * │          rebalanceAlerts, dailyDigest }                     │
 * └─────────────────────────────────────────────────────────────┘
 */

interface NotifToggle {
  id: string;
  label: string;
  description: string;
}

const toggles: NotifToggle[] = [
  {
    id: "positionAlerts",
    label: "Position Alerts",
    description: "Get notified when positions change status.",
  },
  {
    id: "liquidationAlerts",
    label: "Liquidation Alerts",
    description: "Immediate alerts when a position is at risk.",
  },
  {
    id: "rebalanceAlerts",
    label: "Rebalance Alerts",
    description: "Notifications when auto-rebalance triggers.",
  },
  {
    id: "dailyDigest",
    label: "Daily Digest",
    description: "Daily summary of portfolio performance.",
  },
];

export function NotificationsCard() {
  const [values, setValues] = useState<Record<string, boolean>>({
    positionAlerts: true,
    liquidationAlerts: true,
    rebalanceAlerts: false,
    dailyDigest: true,
  });

  const handleToggle = (id: string) => {
    setValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.06, ease: "easeOut" }}
    >
      <Card className="border-ld-gray/20 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-ld-ink">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {toggles.map((t, i) => (
            <div key={t.id}>
              {i > 0 && <Separator className="bg-ld-gray/10" />}
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <Label
                    htmlFor={t.id}
                    className="text-sm font-medium text-ld-ink cursor-pointer"
                  >
                    {t.label}
                  </Label>
                  <p className="mt-0.5 text-xs text-ld-slate">{t.description}</p>
                </div>
                <Switch
                  id={t.id}
                  checked={values[t.id]}
                  onCheckedChange={() => handleToggle(t.id)}
                  className="data-[state=checked]:bg-ld-primary"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

import type { Meta, StoryObj } from "@storybook/react";
import { SummaryStrip } from "./summary-strip";
import type { Activity } from "@/lib/types/activity";

const meta: Meta<typeof SummaryStrip> = {
  title: "Activity/SummaryStrip",
  component: SummaryStrip,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof SummaryStrip>;

const mockActivities: Activity[] = [
  { id: "1", type: "INVESTMENT", status: "CONFIRMED", txHash: "0xabc", details: {}, createdAt: "2026-02-23T12:00:00Z" },
  { id: "2", type: "INVESTMENT", status: "CONFIRMED", txHash: "0xdef", details: {}, createdAt: "2026-02-22T12:00:00Z" },
  { id: "3", type: "WITHDRAWAL", status: "PENDING", txHash: null, details: {}, createdAt: "2026-02-23T12:00:00Z" },
  { id: "4", type: "AUTO_REBALANCE", status: "CONFIRMED", txHash: "0x123", details: {}, createdAt: "2026-02-21T12:00:00Z" },
  { id: "5", type: "LIQUIDATION", status: "FAILED", txHash: null, details: {}, createdAt: "2026-02-20T12:00:00Z" },
  { id: "6", type: "ERROR", status: "FAILED", txHash: null, details: {}, createdAt: "2026-02-19T12:00:00Z" },
];

export const Default: Story = {
  args: { activities: mockActivities },
};

export const Empty: Story = {
  args: { activities: [] },
};

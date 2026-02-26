import type { Meta, StoryObj } from "@storybook/react";
import { PortfolioCard } from "./portfolio-card";

const meta: Meta<typeof PortfolioCard> = {
  title: "Dashboard/PortfolioCard",
  component: PortfolioCard,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof PortfolioCard>;

export const Default: Story = {
  args: {
    data: {
      user: {
        id: "a1b2c3d4",
        walletAddress: "0x1234...cdef",
        balanceDot: 150.5,
        balanceUsd: 1053.5,
      },
      summary: {
        totalInvestedUsd: 500,
        totalCurrentValueUsd: 550,
        totalPnlUsd: 50,
        totalPnlPercent: 10,
        activePositionCount: 2,
        pendingPositionCount: 1,
      },
      positions: [],
      recentActivity: [],
      pools: [],
    },
  },
};

export const NegativePnl: Story = {
  args: {
    data: {
      user: {
        id: "a1b2c3d4",
        walletAddress: "0x1234...cdef",
        balanceDot: 80.2,
        balanceUsd: 561.4,
      },
      summary: {
        totalInvestedUsd: 600,
        totalCurrentValueUsd: 540,
        totalPnlUsd: -60,
        totalPnlPercent: -10,
        activePositionCount: 1,
        pendingPositionCount: 0,
      },
      positions: [],
      recentActivity: [],
      pools: [],
    },
  },
};

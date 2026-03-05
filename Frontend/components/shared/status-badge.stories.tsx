import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./status-badge";

const meta: Meta<typeof StatusBadge> = {
  title: "Shared/StatusBadge",
  component: StatusBadge,
  argTypes: {
    variant: { control: "radio", options: ["position", "activity"] },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

// Position statuses
export const Active: Story = { args: { status: "ACTIVE", variant: "position" } };
export const PendingExecution: Story = { args: { status: "PENDING_EXECUTION", variant: "position" } };
export const OutOfRange: Story = { args: { status: "OUT_OF_RANGE", variant: "position" } };
export const LiquidationPending: Story = { args: { status: "LIQUIDATION_PENDING", variant: "position" } };
export const Liquidated: Story = { args: { status: "LIQUIDATED", variant: "position" } };
export const PositionFailed: Story = { args: { status: "FAILED", variant: "position" } };

// Activity statuses
export const ActivityPending: Story = { args: { status: "PENDING", variant: "activity" } };
export const Submitted: Story = { args: { status: "SUBMITTED", variant: "activity" } };
export const Confirmed: Story = { args: { status: "CONFIRMED", variant: "activity" } };
export const ActivityFailed: Story = { args: { status: "FAILED", variant: "activity" } };

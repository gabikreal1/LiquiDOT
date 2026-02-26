import type { Meta, StoryObj } from "@storybook/react";
import { PnlValue } from "./pnl-value";

const meta: Meta<typeof PnlValue> = {
  title: "Shared/PnlValue",
  component: PnlValue,
};

export default meta;
type Story = StoryObj<typeof PnlValue>;

export const Positive: Story = {
  args: { usd: 25.5, percent: 10.2 },
};

export const Negative: Story = {
  args: { usd: -12.3, percent: -5.1 },
};

export const Zero: Story = {
  args: { usd: 0, percent: 0 },
};

export const LargePositive: Story = {
  args: { usd: 1250.75, percent: 42.5 },
};

export const SmallNegative: Story = {
  args: { usd: -0.5, percent: -0.2 },
};

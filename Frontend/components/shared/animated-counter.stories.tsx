import type { Meta, StoryObj } from "@storybook/react";
import { AnimatedCounter } from "./animated-counter";

const meta: Meta<typeof AnimatedCounter> = {
  title: "Shared/AnimatedCounter",
  component: AnimatedCounter,
};

export default meta;
type Story = StoryObj<typeof AnimatedCounter>;

export const Currency: Story = {
  args: { value: 1053.5, prefix: "$", decimals: 2, duration: 1.2 },
};

export const Percentage: Story = {
  args: { value: 18.42, suffix: "%", decimals: 2, duration: 1 },
};

export const Integer: Story = {
  args: { value: 24, decimals: 0, duration: 0.8 },
};

export const DOTAmount: Story = {
  args: { value: 150.5, suffix: " DOT", decimals: 2, duration: 1.2 },
};

export const LargeNumber: Story = {
  args: { value: 2340000, prefix: "$", decimals: 0, duration: 1.5 },
};

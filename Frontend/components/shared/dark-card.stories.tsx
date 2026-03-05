import type { Meta, StoryObj } from "@storybook/react";
import { DarkCard } from "./dark-card";

const meta: Meta<typeof DarkCard> = {
  title: "Shared/DarkCard",
  component: DarkCard,
  parameters: {
    backgrounds: { default: "light" },
  },
};

export default meta;
type Story = StoryObj<typeof DarkCard>;

export const WithContent: Story = {
  args: {
    children: (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-white">Portfolio Value</h3>
        <p className="mt-2 font-mono text-3xl text-white">$1,053.50</p>
        <p className="mt-1 text-sm text-white/50">150.5 DOT</p>
      </div>
    ),
  },
};

export const Empty: Story = {
  args: {
    children: (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-white/40">No data available</p>
      </div>
    ),
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { StatsRow } from "./stats-row";

const meta: Meta<typeof StatsRow> = {
  title: "Pools/StatsRow",
  component: StatsRow,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof StatsRow>;

export const Default: Story = {};

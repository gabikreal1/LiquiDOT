import type { Meta, StoryObj } from "@storybook/react";
import { ExplorerLink } from "./explorer-link";

const meta: Meta<typeof ExplorerLink> = {
  title: "Shared/ExplorerLink",
  component: ExplorerLink,
};

export default meta;
type Story = StoryObj<typeof ExplorerLink>;

export const Moonbeam: Story = {
  args: {
    hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    chainId: "moonbeam",
    chars: 6,
  },
};

export const AssetHub: Story = {
  args: {
    hash: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
    chainId: "asset-hub",
    chars: 4,
  },
};

export const ShortHash: Story = {
  args: {
    hash: "0xabcd1234",
    chainId: "moonbeam",
    chars: 4,
  },
};

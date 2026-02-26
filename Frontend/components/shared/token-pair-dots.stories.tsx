import type { Meta, StoryObj } from "@storybook/react";
import { TokenPairDots } from "./token-pair-dots";

const meta: Meta<typeof TokenPairDots> = {
  title: "Shared/TokenPairDots",
  component: TokenPairDots,
};

export default meta;
type Story = StoryObj<typeof TokenPairDots>;

export const DotGlmr: Story = {
  args: { token0: "xcDOT", token1: "WGLMR" },
};

export const DotUsdc: Story = {
  args: { token0: "xcDOT", token1: "USDC" },
};

export const GlmrUsdc: Story = {
  args: { token0: "WGLMR", token1: "USDC" },
};

export const EthUsdc: Story = {
  args: { token0: "WETH", token1: "USDC" },
};

export const BtcUsdc: Story = {
  args: { token0: "WBTC", token1: "USDC" },
};

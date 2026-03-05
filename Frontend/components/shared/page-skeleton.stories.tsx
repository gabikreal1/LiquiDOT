import type { Meta, StoryObj } from "@storybook/react";
import { PageSkeleton } from "./page-skeleton";

const meta: Meta<typeof PageSkeleton> = {
  title: "Shared/PageSkeleton",
  component: PageSkeleton,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof PageSkeleton>;

export const Dashboard: Story = { args: { variant: "dashboard" } };
export const Table: Story = { args: { variant: "table" } };
export const Detail: Story = { args: { variant: "detail" } };
export const Form: Story = { args: { variant: "form" } };

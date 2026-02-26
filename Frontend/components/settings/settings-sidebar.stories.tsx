import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SettingsSidebar, type SettingsSection } from "./settings-sidebar";

const meta: Meta<typeof SettingsSidebar> = {
  title: "Settings/SettingsSidebar",
  component: SettingsSidebar,
};

export default meta;
type Story = StoryObj<typeof SettingsSidebar>;

function SidebarDemo() {
  const [active, setActive] = useState<SettingsSection>("account");
  return <SettingsSidebar active={active} onChange={setActive} />;
}

export const Default: Story = {
  render: () => <SidebarDemo />,
};

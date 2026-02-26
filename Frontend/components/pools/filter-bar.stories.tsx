import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FilterBar } from "./filter-bar";

const meta: Meta<typeof FilterBar> = {
  title: "Pools/FilterBar",
  component: FilterBar,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof FilterBar>;

function FilterBarDemo() {
  const [search, setSearch] = useState("");
  const [minTvl, setMinTvl] = useState("");
  const [minApr, setMinApr] = useState("");
  const [chain, setChain] = useState("");
  const [dex, setDex] = useState("");

  return (
    <div className="p-6">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        minTvl={minTvl}
        onMinTvlChange={setMinTvl}
        minApr={minApr}
        onMinAprChange={setMinApr}
        chain={chain}
        onChainChange={setChain}
        dex={dex}
        onDexChange={setDex}
        onReset={() => {
          setSearch("");
          setMinTvl("");
          setMinApr("");
          setChain("");
          setDex("");
        }}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <FilterBarDemo />,
};

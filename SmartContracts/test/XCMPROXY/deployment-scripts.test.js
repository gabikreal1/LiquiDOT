const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

describe("deployment scripts state manager", function () {
  const statePath = path.join(__dirname, "../../deployments/deployment-state.json");

  beforeEach(function () {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  });

  it("writes deployment state after mock configuration", async function () {
    const stateManager = require("../../scripts/utils/state-manager");
    const state = stateManager.loadState(statePath);
    const networkEntry = stateManager.ensureNetwork(state, "hardhat", { chainId: 31337, name: "hardhat" });
    const contractEntry = stateManager.ensureContract(networkEntry, "Example");
    contractEntry.address = ethers.ZeroAddress;
    contractEntry.timestamp = "2024-01-01T00:00:00.000Z";
    stateManager.saveState(state, statePath);

    expect(fs.existsSync(statePath)).to.eq(true);
    const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
    expect(raw.networks.hardhat.contracts.Example.address).to.eq(ethers.ZeroAddress);
  });
});



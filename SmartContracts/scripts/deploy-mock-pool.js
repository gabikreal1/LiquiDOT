const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying MockAlgebraPool to Moonbase...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Load addresses from moonbase-sim deployment or deploy new mocks if not present
  const fs = require("fs");
  const path = `deployments/moonbase-sim-${network.name}.json`;
  if (!fs.existsSync(path)) {
    throw new Error(`Run deploy-moonbase-sim.js first to deploy mock tokens and XCMProxy (missing ${path})`);
  }
  const sim = JSON.parse(fs.readFileSync(path, "utf8"));
  const token0 = sim.DOT;
  const token1 = sim.USDC;

  const MockAlgebraPool = await ethers.getContractFactory("MockAlgebraPool");
  const pool = await MockAlgebraPool.deploy(token0, token1, 60);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("MockAlgebraPool:", poolAddress);

  // Save it
  sim.MockPool = poolAddress;
  fs.writeFileSync(path, JSON.stringify(sim, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});









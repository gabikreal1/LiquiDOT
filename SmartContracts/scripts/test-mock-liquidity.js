const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Testing XCMProxy with MockAlgebraPool mint/burn...");

  const sim = JSON.parse(fs.readFileSync(`deployments/moonbase-sim-${network.name}.json`, "utf8"));
  const proxyAddr = sim.XCMProxy;
  const token0 = sim.DOT;
  const token1 = sim.USDC;
  const pool = sim.MockPool;

  const xcmAbi = [
    "function addLiquidityAdapter(address,address,address,uint8,uint128,address) external returns (uint256,uint256)",
    "function executeBurn(address,int24,int24,uint128) external returns (uint256,uint256)",
    "function getUserPositions(address) external view returns (uint256[] memory)",
    "function positions(uint256) external view returns (address,address,address,int24,int24,uint128,address,int24,int24,uint256,uint256,bool)"
  ];

  const [deployer] = await ethers.getSigners();
  const proxy = new ethers.Contract(proxyAddr, xcmAbi, deployer);

  const liquidityDesired = 1000n;
  console.log("Adding liquidity...");
  await (await proxy.addLiquidityAdapter(pool, token0, token1, 1, liquidityDesired, deployer.address)).wait();

  const userPos = await proxy.getUserPositions(deployer.address);
  console.log("User positions count:", userPos.length);

  const last = userPos[userPos.length - 1];
  console.log("Burning liquidity from last position id:", last.toString());

  // We don't know ticks from event here; use the same calculation as adapter
  const bottomTick = -500;
  const topTick = 1000;
  await (await proxy.executeBurn(pool, bottomTick, topTick, liquidityDesired)).wait();

  console.log("Mock liquidity test complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});









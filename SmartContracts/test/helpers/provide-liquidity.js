const hre = require("hardhat");
const path = require("path");
const { getMoonbaseTestConfig } = require("../XCMProxy/testnet/config");

const NFPM_ARTIFACT = require(path.join(
  __dirname,
  "../../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"
));

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function globalState() view returns (uint160,int24,uint16,uint16,uint16,bool)",
  "function tickSpacing() view returns (int24)"
];

const MIN_TICK = -887272;
const MAX_TICK = 887272;

function floorToSpacing(value, spacing) {
  return Math.floor(value / spacing) * spacing;
}

function ceilToSpacing(value, spacing) {
  return Math.ceil(value / spacing) * spacing;
}

async function ensureAllowance(token, owner, spender, amount) {
  const current = await token.allowance(owner, spender);
  if (current >= amount) return;
  if (current > 0n) {
    const resetTx = await token.approve(spender, 0);
    await resetTx.wait();
  }
  const tx = await token.approve(spender, amount);
  await tx.wait();
}

async function main() {
  const config = getMoonbaseTestConfig();
  const poolAddress = config.poolAddress;
  if (!poolAddress) {
    throw new Error("Pool address missing. Update moonbase bootstrap config or set MOONBASE_POOL_ADDRESS.");
  }

  const nfpmAddress = process.env.MOONBASE_NFPM || config.raw?.algebra?.nfpm;
  if (!nfpmAddress) {
    throw new Error("NFPM address missing. Update bootstrap file or set MOONBASE_NFPM.");
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Pool:", poolAddress);
  console.log("NFPM:", nfpmAddress);

  const pool = new hre.ethers.Contract(poolAddress, POOL_ABI, signer);
  const token0Address = await pool.token0();
  const token1Address = await pool.token1();
  console.log("token0:", token0Address);
  console.log("token1:", token1Address);

  const token0 = new hre.ethers.Contract(token0Address, ERC20_ABI, signer);
  const token1 = new hre.ethers.Contract(token1Address, ERC20_ABI, signer);

  const [symbol0, symbol1] = await Promise.all([
    token0.symbol().catch(() => "TOKEN0"),
    token1.symbol().catch(() => "TOKEN1")
  ]);
  const [decimals0, decimals1] = await Promise.all([
    token0.decimals(),
    token1.decimals()
  ]);

  const amount0Input = process.env.LP_AMOUNT0 || "500";
  const amount1Input = process.env.LP_AMOUNT1 || "500";
  const amount0Desired = hre.ethers.parseUnits(amount0Input, decimals0);
  const amount1Desired = hre.ethers.parseUnits(amount1Input, decimals1);

  const [balance0, balance1] = await Promise.all([
    token0.balanceOf(signer.address),
    token1.balanceOf(signer.address)
  ]);

  if (balance0 < amount0Desired) {
    throw new Error(`Insufficient ${symbol0}. Have ${hre.ethers.formatUnits(balance0, decimals0)}, need ${amount0Input}.`);
  }
  if (balance1 < amount1Desired) {
    throw new Error(`Insufficient ${symbol1}. Have ${hre.ethers.formatUnits(balance1, decimals1)}, need ${amount1Input}.`);
  }

  const state = await pool.globalState();
  const currentTick = Number(state[1]);
  const tickSpacing = Number(await pool.tickSpacing());
  console.log("Current tick:", currentTick);
  console.log("Tick spacing:", tickSpacing);

  const spread = Number(process.env.LP_TICK_SPREAD || 200);
  const halfRange = tickSpacing * spread;
  let lowerTick = floorToSpacing(currentTick - halfRange, tickSpacing);
  let upperTick = ceilToSpacing(currentTick + halfRange, tickSpacing);

  const minAllowed = floorToSpacing(MIN_TICK, tickSpacing);
  const maxAllowed = ceilToSpacing(MAX_TICK, tickSpacing);
  lowerTick = Math.max(lowerTick, minAllowed);
  upperTick = Math.min(upperTick, maxAllowed);
  if (lowerTick >= upperTick) {
    lowerTick = floorToSpacing(currentTick - tickSpacing, tickSpacing);
    upperTick = ceilToSpacing(currentTick + tickSpacing, tickSpacing);
  }

  console.log("Mint range:", lowerTick, "to", upperTick);

  await ensureAllowance(token0, signer.address, nfpmAddress, amount0Desired);
  await ensureAllowance(token1, signer.address, nfpmAddress, amount1Desired);

  const nfpm = new hre.ethers.Contract(nfpmAddress, NFPM_ARTIFACT.abi, signer);
  const mintFn = nfpm.getFunction("mint");

  const mintParams = {
    token0: token0Address,
    token1: token1Address,
    deployer: hre.ethers.ZeroAddress,
    tickLower: lowerTick,
    tickUpper: upperTick,
    amount0Desired,
    amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
  };

  const preview = await mintFn.staticCall(mintParams);
  console.log("Preview tokenId:", preview[0].toString());
  console.log("Preview liquidity:", preview[1].toString());
  console.log("Preview amount0:", hre.ethers.formatUnits(preview[2], decimals0), symbol0);
  console.log("Preview amount1:", hre.ethers.formatUnits(preview[3], decimals1), symbol1);

  const tx = await mintFn.send(mintParams);
  console.log("Mint tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Mint confirmed in block", receipt.blockNumber);

  const finalBalance0 = await token0.balanceOf(signer.address);
  const finalBalance1 = await token1.balanceOf(signer.address);
  console.log(`${symbol0} balance now:`, hre.ethers.formatUnits(finalBalance0, decimals0));
  console.log(`${symbol1} balance now:`, hre.ethers.formatUnits(finalBalance1, decimals1));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

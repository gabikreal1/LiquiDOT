const hre = require("hardhat");
const { getMoonbaseTestConfig } = require("../test/XCMProxy/testnet/config");

async function main() {
  const config = getMoonbaseTestConfig();
  const poolAddress = config.poolAddress;
  const nfpmAddress = config.raw?.algebra?.nfpm;
  const [signer] = await hre.ethers.getSigners();

  const poolAbi = [
    "function globalState() view returns (uint160,int24,uint16,uint16,uint16,bool)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
  ];
  const erc20Abi = ["function decimals() view returns (uint8)"];

  const pool = new hre.ethers.Contract(poolAddress, poolAbi, signer);
  const token0 = await pool.token0();
  const token1 = await pool.token1();

  const token0Contract = new hre.ethers.Contract(token0, erc20Abi, signer);
  const token1Contract = new hre.ethers.Contract(token1, erc20Abi, signer);
  const dec0 = await token0Contract.decimals();
  const dec1 = await token1Contract.decimals();

  const nfpmArtifact = require("../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
  const nfpm = new hre.ethers.Contract(nfpmAddress, nfpmArtifact.abi, signer);
  const mintFn = nfpm.getFunction("mint");

  const amount0Desired = hre.ethers.parseUnits("0.5", dec0);
  const amount1Desired = hre.ethers.parseUnits("0.5", dec1);

  const lower = -6960;
  const upper = 4080;

  const params = {
    token0,
    token1,
    deployer: hre.ethers.ZeroAddress,
    tickLower: lower,
    tickUpper: upper,
    amount0Desired,
    amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
  };

  const preview = await mintFn.staticCall(params);
  console.log("liquidity", preview[1].toString());
  console.log("amount0Used", hre.ethers.formatUnits(preview[2], dec0));
  console.log("amount1Used", hre.ethers.formatUnits(preview[3], dec1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

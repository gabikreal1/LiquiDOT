const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const NFPM_ADDRESS = process.env.DEBUG_NFPM;
  const TOKEN0_ADDRESS = process.env.DEBUG_TOKEN0;
  const TOKEN1_ADDRESS = process.env.DEBUG_TOKEN1;
  const POOL_DEPLOYER = process.env.DEBUG_POOL_DEPLOYER || ethers.ZeroAddress;
  const POOL_ADDRESS = process.env.DEBUG_POOL_ADDRESS || ethers.ZeroAddress;

  if (!NFPM_ADDRESS || !TOKEN0_ADDRESS || !TOKEN1_ADDRESS) {
    throw new Error("Set DEBUG_NFPM, DEBUG_TOKEN0, DEBUG_TOKEN1 in env");
  }

  const nfpmAbi = require("@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json").abi;
  const nfpm = new ethers.Contract(NFPM_ADDRESS, nfpmAbi, signer);
  const token0 = await ethers.getContractAt("TestERC20", TOKEN0_ADDRESS, signer);
  const token1 = await ethers.getContractAt("TestERC20", TOKEN1_ADDRESS, signer);

  const amount0Desired = ethers.parseEther("1000");
  const amount1Desired = ethers.parseEther("1000");

  const candidates = [
    { label: "poolDeployer", value: POOL_DEPLOYER },
    { label: "zero", value: ethers.ZeroAddress },
    { label: "signer", value: signer.address },
    { label: "poolAddress", value: POOL_ADDRESS },
  ];

  for (const candidate of candidates) {
    console.log(`\nTrying deployer=${candidate.label} (${candidate.value})`);
    const params = {
      token0: await token0.getAddress(),
      token1: await token1.getAddress(),
      deployer: candidate.value,
      tickLower: -887220,
      tickUpper: 887220,
      amount0Desired,
      amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };

    try {
      const result = await nfpm.connect(signer).mint.staticCall(params);
      console.log("  ✅ staticCall result:", result);
    } catch (error) {
      console.error("  ❌ error:", error?.error?.message || error.message || error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

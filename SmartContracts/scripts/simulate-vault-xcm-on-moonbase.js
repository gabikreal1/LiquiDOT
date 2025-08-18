const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Simulating Vault -> XCM -> LP lifecycle on Moonbase using mocks...");

  const signers = await ethers.getSigners();
  const operator = signers[0];
  const user = signers[1] ?? operator;

  // Load deployment info from previous step
  const sim = JSON.parse(fs.readFileSync(`deployments/moonbase-sim-${network.name}.json`, "utf8"));
  const DOT = sim.DOT;
  const USDC = sim.USDC;
  const XCMProxy = sim.XCMProxy;

  // 1) Deploy AssetHubVault to moonbase (simulating AssetHub for our purposes)
  const AssetHubVault = await ethers.getContractFactory("AssetHubVault");
  const vault = await AssetHubVault.deploy();
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Vault:", vaultAddress);

  // Grant OPERATOR_ROLE to our operator signer so it can call investInPool/receiveProceeds
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  await (await vault.grantRole(OPERATOR_ROLE, operator.address)).wait();

  // ERC20 minimal ABI
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  // Connect tokens
  const dot = new ethers.Contract(DOT, ERC20_ABI, operator);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, operator);

  // 2) Fund operator wallet with mock tokens (acts as vault user for this sim)
  const dotAmount = ethers.parseUnits("1000", await dot.decimals());
  const usdcAmount = ethers.parseUnits("5000", await usdc.decimals());
  console.log("Operator balances are pre-minted from deployment");

  // 3) Operator deposits DOT to Vault (since positions are tied to msg.sender in current vault design)
  await (await dot.approve(vaultAddress, dotAmount)).wait();
  await (await vault.connect(operator).deposit(DOT, dotAmount)).wait();
  console.log("Operator deposited DOT to Vault");

  // 4) Operator initiates investment (simulating XCM send to Moonbase XCMProxy)
  const chainIdMoonbase = 1287;
  const poolId = ethers.zeroPadValue("0x01", 32);
  const amounts = [ethers.parseUnits("500", await dot.decimals()), ethers.parseUnits("500", await usdc.decimals())];
  const lower = -5;
  const upper = 10;
  const investTx = await vault.connect(operator).investInPool(chainIdMoonbase, poolId, DOT, amounts, lower, upper);
  const investRcpt = await investTx.wait();
  console.log("Investment initiated on Vault");

  // Decode InvestmentInitiated event to get exact positionId
  let positionId = null;
  for (const log of investRcpt.logs) {
    try {
      const parsed = vault.interface.parseLog(log);
      if (parsed && parsed.name === "InvestmentInitiated") {
        positionId = parsed.args[0];
        break;
      }
    } catch (e) {}
  }
  if (!positionId) {
    const activePositions = await vault.getUserActivePositions(operator.address);
    positionId = activePositions[activePositions.length - 1];
  }

  console.log("Vault positionId:", positionId);
  const vpos = await vault.getPosition(positionId);
  console.log("Vault position active:", vpos.active, "chainId:", vpos.chainId.toString());

  // 5) Simulate Moonbase side by calling XCMProxy.executeInvestment and then liquidation
  const xcmProxyAbi = [
    "function executeInvestment(address baseAsset,uint256[] amounts,address poolId,int24 lowerRangePercent,int24 upperRangePercent,address positionOwner) external",
    "function executeFullLiquidation(uint256 positionId) external returns (uint256,uint256)",
    "function getUserPositions(address user) external view returns (uint256[] memory)"
  ];
  const proxy = new ethers.Contract(XCMProxy, xcmProxyAbi, operator);

  await (await proxy.executeInvestment(DOT, amounts, operator.address, lower, upper, user.address)).wait();
  const positions = await proxy.getUserPositions(user.address);
  const last = positions[positions.length - 1];
  const tx = await proxy.executeFullLiquidation(last);
  await tx.wait();
  console.log("Executed investment and liquidation on XCMProxy");

  // 6) Simulate proceeds back to Vault
  // Position on XCMProxy has been liquidated, simulate proceeds equal to first amount
  const proceeds = [amounts[0] + amounts[1]];
  await (await vault.connect(operator).receiveProceeds(chainIdMoonbase, positionId, proceeds)).wait();
  const finalBalance = await vault.getUserBalance(operator.address, DOT);
  console.log("Final operator DOT in Vault:", finalBalance.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



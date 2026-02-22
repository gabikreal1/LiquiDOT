const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const bootstrap = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployments/moonbase_bootstrap.json"), "utf8"));

  const ERC20_ABI = ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"];
  const amount = ethers.parseEther("10000");

  for (const tokenAddr of bootstrap.supportedTokens) {
    const token = new ethers.Contract(tokenAddr, ERC20_ABI, deployer);
    const sym = await token.symbol();
    const tx = await token.mint(deployer.address, amount);
    await tx.wait();
    const bal = await token.balanceOf(deployer.address);
    console.log(`${sym}: minted ${ethers.formatEther(amount)} to deployer, balance = ${ethers.formatEther(bal)}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

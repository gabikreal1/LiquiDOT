const hre = require("hardhat");
const { getMoonbaseTestConfig } = require("../XCMProxy/testnet/config");

async function main() {
  const config = getMoonbaseTestConfig();
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);

  const proxyAddress = config.proxyAddress;
  const baseToken = config.baseToken;
  const quoteToken = config.quoteToken || config.supportedTokens?.find((addr) => addr?.toLowerCase() !== baseToken?.toLowerCase());
  const poolAddress = config.poolAddress;

  console.log({ proxyAddress, baseToken, quoteToken, poolAddress });

  const XCMProxy = await hre.ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
  const proxy = XCMProxy.attach(proxyAddress);

  const erc20Abi = [
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ];

  const base = new hre.ethers.Contract(baseToken, erc20Abi, signer);
  const quote = quoteToken ? new hre.ethers.Contract(quoteToken, erc20Abi, signer) : undefined;

  const decodeProxyError = (raw) => {
    if (!raw) return undefined;
    try {
      const parsed = proxy.interface.parseError(raw);
      return `${parsed.name}(${parsed.args ? parsed.args.join(", ") : ""})`;
    } catch (_) {
      return undefined;
    }
  };

  const logError = (label, error) => {
    console.error(label, error?.message || error);
    if (!error) return;
    if (error.reason) console.error("   reason:", error.reason);
    if (error.code) console.error("   code:", error.code);
    if (error.errorName) console.error("   errorName:", error.errorName);
    if (error.errorSignature) console.error("   signature:", error.errorSignature);
    if (error.data) {
      console.error("   data:", error.data);
      const decoded = decodeProxyError(error.data);
      if (decoded) console.error("   decoded:", decoded);
    }
    if (error?.error?.data) {
      console.error("   inner data:", error.error.data);
      const decodedInner = decodeProxyError(error.error.data);
      if (decodedInner) console.error("   decodedInner:", decodedInner);
    }
  };

  // Use token decimals-aware amounts instead of assuming 18 decimals
  const baseDecimals = await base.decimals().catch(() => 18);
  const quoteDecimals = quote ? await quote.decimals().catch(() => 18) : 18;
  const amount = hre.ethers.parseUnits("1", baseDecimals);
  const id = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`debug-${Date.now()}`));
  const investmentParams = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
    [
      poolAddress,
      baseToken,
      [
        hre.ethers.parseUnits("0.5", baseDecimals),
        hre.ethers.parseUnits("0.5", quoteDecimals)
      ],
      -50,
      50,
      signer.address,
      100,
    ]
  );

  console.log("Transferring tokens to proxy before receiveAssets...");
  const transferTx = await base.transfer(proxyAddress, amount);
  console.log("   tx hash:", transferTx.hash);
  await transferTx.wait();
  console.log("Base token transferred");

  if (quote) {
    const quoteBal = await quote.balanceOf(proxyAddress);
    console.log(`Quote balance before: ${hre.ethers.formatEther(quoteBal)}`);
  }

  console.log("Simulating receiveAssets via callStatic...");
  try {
    await proxy.receiveAssets.staticCall(id, baseToken, signer.address, amount, investmentParams);
    console.log("   ✅ staticCall succeeded");
  } catch (error) {
    logError("   ❌ receiveAssets.staticCall revert", error);
  }

  console.log("Calling receiveAssets (state-changing)...");
  try {
    await (await proxy.receiveAssets(id, baseToken, signer.address, amount, investmentParams)).wait();
    console.log("Pending position created");
  } catch (error) {
    logError("   ❌ receiveAssets tx reverted", error);
    throw error;
  }

  try {
    console.log("Performing static call for executePendingInvestment...");
    const response = await proxy.executePendingInvestment.staticCall(id);
    console.log("Static call result:", response);
  } catch (error) {
    logError("Static call revert", error);
  }

  console.log("Sending executePendingInvestment transaction...");
  try {
    const tx = await proxy.executePendingInvestment(id);
    const receipt = await tx.wait();
    console.log("Execute tx complete", receipt.hash);
  } catch (error) {
    logError("Execute tx failed", error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

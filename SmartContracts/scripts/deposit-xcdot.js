const { ethers } = require('hardhat');

async function main() {
  // Moonbeam mainnet addresses
  const XCDOT_TOKEN_ADDRESS = '0xffffffff1fcacbd218edc0eba20fc2308c778080';
  
  // You need to replace this with your actual deployed XCMProxy address on Moonbeam
  // The current address is from Moonbase Alpha and won't work on Moonbeam mainnet
  const XCM_PROXY_ADDRESS = process.env.MOONBEAM_PROXY_ADDRESS;
  
  if (!XCM_PROXY_ADDRESS) {
    console.error("Please set MOONBEAM_PROXY_ADDRESS environment variable with your Moonbeam XCMProxy address");
    process.exit(1);
  }
  
  console.log('Depositing xcDOT to XCMProxy on Moonbeam...');
  console.log(`Using XCMProxy at: ${XCM_PROXY_ADDRESS}`);

  // Connect to the ERC20 contract ABI
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];
  
  // Connect to the XCMProxy contract
  const XCMProxy = await ethers.getContractFactory('XCMProxy');
  const xcmProxy = await XCMProxy.attach(XCM_PROXY_ADDRESS);
  
  // Connect to the xcDOT token contract
  const xcDotToken = new ethers.Contract(XCDOT_TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);
  
  // Connect as signer
  const xcDotTokenWithSigner = xcDotToken.connect(signer);
  
  // Get token info
  const tokenSymbol = await xcDotToken.symbol();
  const tokenDecimals = await xcDotToken.decimals();
  
  console.log(`Using ${tokenSymbol} token (${XCDOT_TOKEN_ADDRESS})`);
  console.log(`Token decimals: ${tokenDecimals}`);
  
  // Check initial balances
  const initialTokenBalance = await xcDotToken.balanceOf(signer.address);
  console.log(`Initial ${tokenSymbol} token balance: ${ethers.formatUnits(initialTokenBalance, tokenDecimals)}`);
  
  if (initialTokenBalance == 0) {
    console.log(`You don't have any ${tokenSymbol} tokens. Please acquire some before running this script.`);
    return;
  }
  
  const initialProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, XCDOT_TOKEN_ADDRESS);
  console.log(`Initial balance in XCMProxy: ${ethers.formatUnits(initialProxyBalance, tokenDecimals)}`);
  
  // Ask for deposit amount
  const depositAmountStr = process.env.DEPOSIT_AMOUNT || "0.1"; // Default to 0.01 xcDOT if not specified
  const depositAmount = ethers.parseUnits(depositAmountStr, tokenDecimals);
  
  console.log(`Depositing ${depositAmountStr} ${tokenSymbol} tokens to XCMProxy...`);
  
  // Check if we have enough balance
  if (initialTokenBalance < depositAmount) {
    console.log(`Error: Insufficient balance. You only have ${ethers.formatUnits(initialTokenBalance, tokenDecimals)} ${tokenSymbol}`);
    return;
  }
  
  // Approve tokens to XCMProxy
  console.log(`Approving ${depositAmountStr} ${tokenSymbol} tokens to XCMProxy...`);
  const approveTx = await xcDotTokenWithSigner.approve(XCM_PROXY_ADDRESS, depositAmount);
  console.log('Waiting for approval transaction to be confirmed...');
  console.log(`Transaction hash: ${approveTx.hash}`);
  await approveTx.wait(2); // Wait for 2 confirmations
  
  // Verify allowance before proceeding
  const allowance = await xcDotToken.allowance(signer.address, XCM_PROXY_ADDRESS);
  console.log(`Current allowance: ${ethers.formatUnits(allowance, tokenDecimals)}`);
  
  if (allowance < depositAmount) {
    console.log(`Allowance (${ethers.formatUnits(allowance, tokenDecimals)}) is less than deposit amount (${depositAmountStr}). Cannot proceed.`);
    return;
  }
  
  console.log('Approval successful');
  
  // Deposit tokens
  console.log(`Depositing ${depositAmountStr} ${tokenSymbol} tokens to XCMProxy...`);
  const depositTx = await xcmProxy.deposit(XCDOT_TOKEN_ADDRESS, depositAmount);
  console.log('Waiting for deposit transaction to be confirmed...');
  console.log(`Transaction hash: ${depositTx.hash}`);
  await depositTx.wait(1);
  console.log('Deposit successful');
  
  // Check updated balances
  const updatedTokenBalance = await xcDotToken.balanceOf(signer.address);
  console.log(`Updated ${tokenSymbol} token balance: ${ethers.formatUnits(updatedTokenBalance, tokenDecimals)}`);
  
  const updatedProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, XCDOT_TOKEN_ADDRESS);
  console.log(`Updated balance in XCMProxy: ${ethers.formatUnits(updatedProxyBalance, tokenDecimals)}`);
  
  console.log('Deposit completed successfully');
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
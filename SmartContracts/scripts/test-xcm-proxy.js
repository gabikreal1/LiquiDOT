const { ethers } = require('hardhat');

async function main() {
  // Use tokens from Moonbase Alpha faucet
  const MERC_TOKEN_ADDRESS = '0x37822de108AFFdd5cDCFDaAa2E32756Da284DB85';
  const VEN_TOKEN_ADDRESS = '0xCdF746C5C86Df2c2772d2D36E227B4c0203CbA25';
  const XCM_PROXY_ADDRESS = '0xA888E9FDC8826e9A9Dd20Cfaf73DAc40ccdDE46e';
  
  console.log('Testing XCMProxy deposit and withdraw functions using faucet tokens...');

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
  
  // Connect to the token contracts
  const mercToken = new ethers.Contract(MERC_TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  const venToken = new ethers.Contract(VEN_TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);
  
  // We'll use MERC for testing
  const testToken = mercToken.connect(signer);
  const tokenSymbol = await testToken.symbol();
  const tokenDecimals = await testToken.decimals();
  
  console.log(`Testing with ${tokenSymbol} token (${MERC_TOKEN_ADDRESS})`);
  console.log(`Token decimals: ${tokenDecimals}`);
  
  // Check initial balances
  const initialTokenBalance = await testToken.balanceOf(signer.address);
  console.log(`Initial ${tokenSymbol} token balance: ${initialTokenBalance.toString()}`);
  
  if (initialTokenBalance == 0) {
    console.log(`You don't have any ${tokenSymbol} tokens. Get some from https://moonbase-minterc20.netlify.app/`);
    return;
  }
  
  const initialProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, MERC_TOKEN_ADDRESS);
  console.log(`Initial balance in XCMProxy: ${initialProxyBalance.toString()}`);
  
  // Use a fixed deposit amount of 10 tokens
  const depositAmount = "100000000000000000"; // .10 tokens with 18 decimals
  
  // Approve tokens to XCMProxy
  console.log(`Approving ${depositAmount} ${tokenSymbol} tokens to XCMProxy...`);
  const approveTx = await testToken.approve(XCM_PROXY_ADDRESS, depositAmount);
  console.log('Waiting for approval transaction to be confirmed...');
  await approveTx.wait(2); // Wait for 2 confirmations
  
  // Verify allowance before proceeding
  const allowance = await testToken.allowance(signer.address, XCM_PROXY_ADDRESS);
  console.log(`Current allowance: ${allowance.toString()}`);
  
  if (allowance < depositAmount) {
    console.log(`Allowance (${allowance.toString()}) is less than deposit amount (${depositAmount}). Cannot proceed.`);
    return;
  }
  
  console.log('Approval successful');
  
  // Deposit tokens
  console.log(`Depositing ${depositAmount} ${tokenSymbol} tokens to XCMProxy...`);
  const depositTx = await xcmProxy.deposit(MERC_TOKEN_ADDRESS, depositAmount);
  console.log('Waiting for deposit transaction to be confirmed...');
  await depositTx.wait(1);
  console.log('Deposit successful');
  
  // Check updated balances
  const updatedTokenBalance = await testToken.balanceOf(signer.address);
  console.log(`Updated ${tokenSymbol} token balance: ${updatedTokenBalance.toString()}`);
  
  const updatedProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, MERC_TOKEN_ADDRESS);
  console.log(`Updated balance in XCMProxy: ${updatedProxyBalance.toString()}`);
  
  // Withdraw half of the tokens
  const withdrawAmount = "50000000000000000"; // .05 tokens with 18 decimals
  console.log(`Withdrawing ${withdrawAmount} ${tokenSymbol} tokens from XCMProxy...`);
  const withdrawTx = await xcmProxy.withdraw(MERC_TOKEN_ADDRESS, withdrawAmount);
  console.log('Waiting for withdrawal transaction to be confirmed...');
  await withdrawTx.wait(1);
  console.log('Withdrawal successful');
  
  // Check final balances
  const finalTokenBalance = await testToken.balanceOf(signer.address);
  console.log(`Final ${tokenSymbol} token balance: ${finalTokenBalance.toString()}`);
  
  const finalProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, MERC_TOKEN_ADDRESS);
  console.log(`Final balance in XCMProxy: ${finalProxyBalance.toString()}`);
  
  console.log('Test completed successfully');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
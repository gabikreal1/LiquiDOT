const { ethers } = require('hardhat');

async function main() {
  // Moonbase Alpha contract addresses
  const MERC_TOKEN_ADDRESS = '0xffffffff1fcacbd218edc0eba20fc2308c778080';
  const VEN_TOKEN_ADDRESS = '0xffffffffea09fb06d082fd1275cd48b191cbcd1d';
  const XCM_PROXY_ADDRESS = process.env.MOONBEAM_PROXY_ADDRESS;
  const SWAP_ROUTER_ADDRESS = '0xe6d0ED3759709b743707DcfeCAe39BC180C981fe';
  
  console.log('Testing XCMProxy quoting and swapping functions...');

  // Connect to the ERC20 contract ABI
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];
  
  // XCMProxy ABI (only needed functions)
  const XCM_PROXY_ABI = [
    "function deposit(address token, uint256 amount) external",
    "function getUserTokenBalance(address user, address token) external view returns (uint256)",
    "function swapExactInputSingle(address tokenIn, address tokenOut, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice) external returns (uint256 amountOut)",
    "function swapExactOutputSingle(address tokenIn, address tokenOut, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 limitSqrtPrice) external returns (uint256 amountIn)"
  ];
  
  // Connect to contracts
  const mercToken = new ethers.Contract(MERC_TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  const venToken = new ethers.Contract(VEN_TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  const xcmProxy = new ethers.Contract(XCM_PROXY_ADDRESS, XCM_PROXY_ABI, ethers.provider);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);
  
  // Connect with signer
  const xcmProxyWithSigner = xcmProxy.connect(signer);
  const mercTokenWithSigner = mercToken.connect(signer);
  const venTokenWithSigner = venToken.connect(signer);
  
  // Check token symbols and decimals
  const mercSymbol = await mercToken.symbol();
  const venSymbol = await venToken.symbol();
  const mercDecimals = await mercToken.decimals();
  const venDecimals = await venToken.decimals();
  
  console.log(`TokenIn: ${mercSymbol} (${MERC_TOKEN_ADDRESS}) with ${mercDecimals} decimals`);
  console.log(`TokenOut: ${venSymbol} (${VEN_TOKEN_ADDRESS}) with ${venDecimals} decimals`);
  
  // Check wallet balances
  const mercWalletBalance = await mercToken.balanceOf(signer.address);
  const venWalletBalance = await venToken.balanceOf(signer.address);
  
  console.log(`Wallet balance: ${ethers.formatUnits(mercWalletBalance, mercDecimals)} ${mercSymbol}`);
  console.log(`Wallet balance: ${ethers.formatUnits(venWalletBalance, venDecimals)} ${venSymbol}`);
  
  // Check XCMProxy balances
  const mercProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, MERC_TOKEN_ADDRESS);
  const venProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, VEN_TOKEN_ADDRESS);
  
  console.log(`XCMProxy balance: ${ethers.formatUnits(mercProxyBalance, mercDecimals)} ${mercSymbol}`);
  console.log(`XCMProxy balance: ${ethers.formatUnits(venProxyBalance, venDecimals)} ${venSymbol}`);
  
  // Deposit tokens if necessary
  const depositAmount = ethers.parseUnits("0.1", mercDecimals);
  
  if (mercProxyBalance < depositAmount) {
    if (mercWalletBalance < depositAmount) {
      console.log(`Not enough ${mercSymbol} in wallet. Please get tokens from the faucet.`);
      return;
    }
    
    console.log(`Depositing ${ethers.formatUnits(depositAmount, mercDecimals)} ${mercSymbol} to XCMProxy...`);
    
    // Approve XCMProxy to spend tokens
    console.log('Approving tokens...');
    const approveTx = await mercTokenWithSigner.approve(XCM_PROXY_ADDRESS, depositAmount);
    await approveTx.wait(1);
    
    // Deposit tokens
    console.log('Depositing tokens...');
    const depositTx = await xcmProxyWithSigner.deposit(MERC_TOKEN_ADDRESS, depositAmount);
    await depositTx.wait(1);
    
    // Check updated balance
    const updatedMercProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, MERC_TOKEN_ADDRESS);
    console.log(`Updated XCMProxy balance: ${ethers.formatUnits(updatedMercProxyBalance, mercDecimals)} ${mercSymbol}`);
  }
  
  try {
    // Swap MERC to VEN
    console.log('\nExecuting swap from MERC to VEN...');
    
    // Amount to swap
    const swapAmount = ethers.parseUnits("0.1", mercDecimals); // Start with a small amount
    console.log(`Swap amount: ${ethers.formatUnits(swapAmount, mercDecimals)} ${mercSymbol}`);
    
    // Set a very low minimum out to ensure swap success (high slippage tolerance)
    // In production, you would want a proper price oracle or quote
    const amountOutMinimum = 1; // Just require at least 1 wei output
    
    const swapTx = await xcmProxyWithSigner.swapExactInputSingle(
      MERC_TOKEN_ADDRESS,   // tokenIn
      VEN_TOKEN_ADDRESS,    // tokenOut
      XCM_PROXY_ADDRESS,    // recipient (keep tokens in proxy)
      swapAmount,           // amountIn
      amountOutMinimum,     // amountOutMinimum (accepting any output for testing)
      0                     // limitSqrtPrice
    );
    
    console.log('Waiting for swap transaction to be confirmed...');
    const receipt = await swapTx.wait(1);
    
    // Check if transaction was successful
    if (receipt.status === 1) {
      console.log('Swap transaction successful!');
    } else {
      console.log('Swap transaction failed!');
    }
    
    // Check updated balances
    const finalMercProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, MERC_TOKEN_ADDRESS);
    const finalVenProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, VEN_TOKEN_ADDRESS);
    
    console.log(`\nFinal XCMProxy balance: ${ethers.formatUnits(finalMercProxyBalance, mercDecimals)} ${mercSymbol}`);
    console.log(`Final XCMProxy balance: ${ethers.formatUnits(finalVenProxyBalance, venDecimals)} ${venSymbol}`);
    
  } catch (error) {
    console.error("Error during swapping:", error);
    
    // Check if there's more detailed error info
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
  
  console.log('\nSwapping test completed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
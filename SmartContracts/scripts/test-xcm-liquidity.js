const { ethers } = require('hardhat');

async function main() {
  // Contract addresses
  const DOT_TOKEN_ADDRESS = '0xffffffff1fcacbd218edc0eba20fc2308c778080';
  const USDT_TOKEN_ADDRESS = '0xffffffffea09fb06d082fd1275cd48b191cbcd1d';
  const POOL_ADDRESS = '0x921b35e54b45b60ee8142fa234baeb2ff5e307e0';
  const XCM_PROXY_ADDRESS = process.env.MOONBEAM_PROXY_ADDRESS;
  
  console.log('Testing XCMProxy liquidity operations...');

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
    "function addLiquidityAdapter(address pool, address token0, address token1, uint8 rangeSize, uint128 liquidityDesired, address positionOwner) external returns (uint256 amount0, uint256 amount1)",
    "function executeBurn(address pool, int24 bottomTick, int24 topTick, uint128 liquidity) external returns (uint256 amount0, uint256 amount1)",
    "function positions(bytes32 positionId) external view returns (address pool, address token0, address token1, int24 bottomTick, int24 topTick, uint128 liquidity, bool active, address owner)",
    "function getUserPositions(address user) external view returns (bytes32[] memory)",
    "function findPosition(address pool, int24 bottomTick, int24 topTick) external view returns (bytes32)"
  ];

  // Algebra Pool ABI (minimal)
  const POOL_ABI = [
    "function tickSpacing() external view returns (int24)",
    "function globalState() external view returns (uint160 sqrtPriceX96, int24 tick, uint128 liquidity)"
  ];
  
  // Connect to contracts
  const dotToken = new ethers.Contract(DOT_TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  const usdtToken = new ethers.Contract(USDT_TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  const xcmProxy = new ethers.Contract(XCM_PROXY_ADDRESS, XCM_PROXY_ABI, ethers.provider);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, ethers.provider);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);
  
  // Connect with signer
  const xcmProxyWithSigner = xcmProxy.connect(signer);
  const dotTokenWithSigner = dotToken.connect(signer);
  const usdtTokenWithSigner = usdtToken.connect(signer);
  const poolWithSigner = pool.connect(signer);
  
  // Get token info
  const dotSymbol = await dotToken.symbol();
  const usdtSymbol = await usdtToken.symbol();
  const dotDecimals = await dotToken.decimals();
  const usdtDecimals = await usdtToken.decimals();
  
  console.log(`Token0: ${dotSymbol} (${DOT_TOKEN_ADDRESS}) with ${dotDecimals} decimals`);
  console.log(`Token1: ${usdtSymbol} (${USDT_TOKEN_ADDRESS}) with ${usdtDecimals} decimals`);
  
  // Check wallet balances
  const dotWalletBalance = await dotToken.balanceOf(signer.address);
  const usdtWalletBalance = await usdtToken.balanceOf(signer.address);
  
  console.log(`\nWallet balance: ${ethers.formatUnits(dotWalletBalance, dotDecimals)} ${dotSymbol}`);
  console.log(`Wallet balance: ${ethers.formatUnits(usdtWalletBalance, usdtDecimals)} ${usdtSymbol}`);
  
  // Check XCMProxy balances
  const dotProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, DOT_TOKEN_ADDRESS);
  const usdtProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, USDT_TOKEN_ADDRESS);
  
  console.log(`\nXCMProxy balance: ${ethers.formatUnits(dotProxyBalance, dotDecimals)} ${dotSymbol}`);
  console.log(`XCMProxy balance: ${ethers.formatUnits(usdtProxyBalance, usdtDecimals)} ${usdtSymbol}`);
  
  try {
    // 1. Deposit tokens if necessary
    const dotDepositAmount = ethers.parseUnits("0.09", dotDecimals);
    const usdtDepositAmount = ethers.parseUnits("0.35", usdtDecimals);
    
    if (dotProxyBalance < dotDepositAmount) {
      if (dotWalletBalance < dotDepositAmount) {
        console.log(`Not enough ${dotSymbol} in wallet. Please get tokens from the faucet.`);
        return;
      }
      
      console.log(`\nDepositing ${ethers.formatUnits(dotDepositAmount, dotDecimals)} ${dotSymbol} to XCMProxy...`);
      
      // Approve XCMProxy to spend tokens
      console.log('Approving DOT tokens...');
      const approveDotTx = await dotTokenWithSigner.approve(XCM_PROXY_ADDRESS, dotDepositAmount);
      await approveDotTx.wait(1);
      
      // Deposit tokens
      console.log('Depositing DOT tokens...');
      const depositDotTx = await xcmProxyWithSigner.deposit(DOT_TOKEN_ADDRESS, dotDepositAmount);
      await depositDotTx.wait(1);
    }
    
    if (usdtProxyBalance < usdtDepositAmount) {
      if (usdtWalletBalance < usdtDepositAmount) {
        console.log(`Not enough ${usdtSymbol} in wallet. Please get tokens from the faucet.`);
        return;
      }
      
      console.log(`\nDepositing ${ethers.formatUnits(usdtDepositAmount, usdtDecimals)} ${usdtSymbol} to XCMProxy...`);
      
      // Approve XCMProxy to spend tokens
      console.log('Approving USDT tokens...');
      const approveUsdtTx = await usdtTokenWithSigner.approve(XCM_PROXY_ADDRESS, usdtDepositAmount);
      await approveUsdtTx.wait(1);
      
      // Deposit tokens
      console.log('Depositing USDT tokens...');
      const depositUsdtTx = await xcmProxyWithSigner.deposit(USDT_TOKEN_ADDRESS, usdtDepositAmount);
      await depositUsdtTx.wait(1);
    }
    
    // Check updated balances
    const updatedDotProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, DOT_TOKEN_ADDRESS);
    const updatedUsdtProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, USDT_TOKEN_ADDRESS);
    
    console.log(`\nUpdated XCMProxy balance: ${ethers.formatUnits(updatedDotProxyBalance, dotDecimals)} ${dotSymbol}`);
    console.log(`Updated XCMProxy balance: ${ethers.formatUnits(updatedUsdtProxyBalance, usdtDecimals)} ${usdtSymbol}`);
    
    // 2. Add liquidity to the pool
    console.log('\nAdding liquidity to the pool...');
    
    // Get pool information
    const [, currentTick] = await pool.globalState();
    console.log(`Current pool tick: ${currentTick}`);
    
    const tickSpacing = await pool.tickSpacing();
    console.log(`Tick spacing: ${tickSpacing}`);
    
    // Define liquidity parameters
    const liquidityDesired = ethers.parseUnits("0.001", 18); // 0.001 in liquidity units (reduced further)
    const rangeSize = 1; // MEDIUM range
    
    console.log(`Adding ${ethers.formatUnits(liquidityDesired, 18)} liquidity with MEDIUM range`);
    
    const addLiquidityTx = await xcmProxyWithSigner.addLiquidityAdapter(
      POOL_ADDRESS,       // pool
      DOT_TOKEN_ADDRESS,  // token0
      USDT_TOKEN_ADDRESS, // token1
      rangeSize,          // rangeSize (MEDIUM = 1)
      liquidityDesired,   // liquidityDesired
      signer.address      // positionOwner
    );
    
    console.log('Waiting for add liquidity transaction to be confirmed...');
    const addLiquidityReceipt = await addLiquidityTx.wait(1);
    
    // Check if transaction was successful
    if (addLiquidityReceipt.status === 1) {
      console.log('Add liquidity transaction successful!');
      
      // Parse events to find the liquidity position details
      const liquidityAddedEvents = addLiquidityReceipt.events.filter(
        e => e.topics[0] === ethers.utils.id('LiquidityAdded(address,address,int24,int24,uint128,uint256,uint256,bytes32)')
      );
      
      if (liquidityAddedEvents.length > 0) {
        const event = liquidityAddedEvents[0];
        console.log('Liquidity position created:');
        
        // Get user positions
        const positions = await xcmProxy.getUserPositions(signer.address);
        console.log(`User has ${positions.length} positions`);
        
        if (positions.length > 0) {
          const positionId = positions[positions.length - 1];
          const position = await xcmProxy.positions(positionId);
          
          console.log(`Position ID: ${positionId}`);
          console.log(`Pool: ${position.pool}`);
          console.log(`Tick range: ${position.bottomTick} to ${position.topTick}`);
          console.log(`Liquidity: ${position.liquidity.toString()}`);
          
          // Wait a bit before removing liquidity
          console.log('\nWaiting 5 seconds before removing liquidity...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 3. Remove liquidity
          console.log('\nRemoving liquidity from the pool...');
          
          const burnTx = await xcmProxyWithSigner.executeBurn(
            position.pool,
            position.bottomTick,
            position.topTick,
            position.liquidity
          );
          
          console.log('Waiting for burn transaction to be confirmed...');
          const burnReceipt = await burnTx.wait(1);
          
          if (burnReceipt.status === 1) {
            console.log('Burn liquidity transaction successful!');
            
            // Check final balances
            const finalDotProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, DOT_TOKEN_ADDRESS);
            const finalUsdtProxyBalance = await xcmProxy.getUserTokenBalance(signer.address, USDT_TOKEN_ADDRESS);
            
            console.log(`\nFinal XCMProxy balance: ${ethers.formatUnits(finalDotProxyBalance, dotDecimals)} ${dotSymbol}`);
            console.log(`Final XCMProxy balance: ${ethers.formatUnits(finalUsdtProxyBalance, usdtDecimals)} ${usdtSymbol}`);
          } else {
            console.log('Burn liquidity transaction failed!');
          }
        }
      }
    } else {
      console.log('Add liquidity transaction failed!');
    }
    
  } catch (error) {
    console.error("Error during liquidity operations:", error);
    
    // Check if there's more detailed error info
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
  
  console.log('\nLiquidity test completed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
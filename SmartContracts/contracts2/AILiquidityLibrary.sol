// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

import './Constants.sol';
import './Interfaces.sol';

/**
 * @title AILiquidityLibrary
 * @dev Library containing the core functionality for AILiquidityProvider
 */
library AILiquidityLibrary {
    // Events that will be emitted by the main contract
    event TokenDeposited(address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed token, uint256 amount);
    event XCMRequestSent(address indexed pool, address indexed recipient, uint128 liquidityDesired);
    event AssetsTransferred(address indexed token, uint256 amount, address recipient);
    
    // Data structure for storing contract state, to be used in the main contract
    struct State {
        address aiAgent;
        address xcmProxyAddress;
        uint256 xcmFeeAmount;
        mapping(address => uint256) tokenBalances;
    }
    
    // Enums
    enum TickRangeSize { NARROW, MEDIUM, WIDE, MAXIMUM }
    
    /**
     * @dev Deposit tokens into the contract
     */
    function depositTokens(
        State storage self,
        address token,
        uint256 amount,
        address sender
    ) external returns (bool) {
        require(token != address(0) && amount > 0);
        
        // The calling contract is 'this' in the context of the library call
        IERC20(token).transferFrom(sender, msg.sender, amount);
        
        // Update token balance
        self.tokenBalances[token] += amount;
        
        // Emit event
        emit TokenDeposited(token, amount);
        
        return true;
    }
    
    /**
     * @dev Withdraw tokens from the contract
     */
    function withdrawTokens(
        State storage self,
        address token,
        uint256 amount,
        address recipient
    ) external returns (bool) {
        require(self.tokenBalances[token] >= amount);
        
        // Update token balance
        self.tokenBalances[token] -= amount;
        
        // Transfer tokens to recipient - calling contract is 'this'
        IERC20(token).transfer(recipient, amount);
        
        // Emit event
        emit TokenWithdrawn(token, amount);
        
        return true;
    }
    
    /**
     * @dev Transfer assets to Moonbeam via XCM
     */
    function transferToMoonbeam(
        State storage self,
        address token,
        uint256 amount
    ) external returns (bool) {
        require(self.tokenBalances[token] >= amount);
        
        // Update token balance
        self.tokenBalances[token] -= amount;
        
        // Transfer assets via XCM
        AssetTransferInterface(XCMConstants.ASSET_TRANSFER).transferToParachain(
            XCMConstants.MOONBEAM_PARACHAIN_ID,
            token,
            amount,
            self.xcmProxyAddress,
            XCMConstants.ASSET_TRANSFER_WEIGHT
        );
        
        // Emit event
        emit AssetsTransferred(token, amount, self.xcmProxyAddress);
        
        return true;
    }
    
    /**
     * @dev Add liquidity to a pool via XCM
     */
    function addLiquidity(
        State storage self,
        address pool,
        address token0,
        address token1,
        TickRangeSize rangeSize,
        uint128 liquidityDesired,
        address sender
    ) external returns (bool) {
        require(pool != address(0) && liquidityDesired > 0);
        
        // Create call data for XCM
        bytes memory proxyCall = abi.encodeWithSignature(
            "addLiquidityAdapter((address,address,address,uint8,uint128,address))",
            abi.encode(pool, token0, token1, uint8(rangeSize), liquidityDesired, sender)
        );
        
        // Execute XCM transact
        _sendXCM(self, proxyCall);
        
        // Emit event
        emit XCMRequestSent(pool, sender, liquidityDesired);
        
        return true;
    }
    
    /**
     * @dev Remove liquidity from a pool via XCM
     */
    function removeLiquidity(
        State storage self,
        address pool,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity
    ) external returns (bool) {
        // Create call data for XCM
        bytes memory proxyCall = abi.encodeWithSignature(
            "executeBurn(address,int24,int24,uint128)",
            pool, bottomTick, topTick, liquidity
        );
        
        // Execute XCM transact
        _sendXCM(self, proxyCall);
        
        return true;
    }
    
    /**
     * @dev Internal function to send XCM message
     */
    function _sendXCM(
        State storage self,
        bytes memory call
    ) private {
        IXCMTransactor(XCMConstants.XCM_TRANSACTOR).transactThroughDerivative(
            XCMConstants.MOONBEAM_PARACHAIN_ID,
            XCMConstants.FEE_LOCATION,
            XCMConstants.TRANSACT_WEIGHT,
            abi.encodePacked(self.xcmProxyAddress, call),
            self.xcmFeeAmount,
            XCMConstants.OVERALL_WEIGHT
        );
    }
} 
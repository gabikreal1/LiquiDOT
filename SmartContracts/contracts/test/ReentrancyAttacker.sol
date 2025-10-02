// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReentrancyAttacker
 * @notice Test contract used to verify reentrancy protection in AssetHubVault
 * @dev This contract attempts to exploit reentrancy vulnerabilities
 */

interface IAssetHubVault {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function getUserBalance(address user) external view returns (uint256);
}

contract ReentrancyAttacker {
    IAssetHubVault public vault;
    bool public attacking;
    uint256 public attackCount;
    
    constructor(address _vault) {
        vault = IAssetHubVault(_vault);
        attacking = false;
        attackCount = 0;
    }
    
    /**
     * @notice Attempt reentrancy attack on deposit function
     * @dev Will try to call deposit again when receiving funds
     */
    function attackDeposit() external payable {
        attacking = true;
        attackCount = 0;
        vault.deposit{value: msg.value}();
    }
    
    /**
     * @notice Attempt reentrancy attack on withdraw function
     * @dev Will try to call withdraw again when receiving funds
     */
    function attackWithdraw(uint256 amount) external {
        attacking = true;
        attackCount = 0;
        vault.withdraw(amount);
    }
    
    /**
     * @notice Receive function that attempts reentrancy
     * @dev This is called when the contract receives ETH
     */
    receive() external payable {
        if (attacking && attackCount < 3) {
            attackCount++;
            
            // Attempt to reenter by calling deposit/withdraw again
            if (address(this).balance >= 0.01 ether) {
                try vault.deposit{value: 0.01 ether}() {
                    // Reentrancy succeeded - this is BAD and means protection failed
                } catch {
                    // Reentrancy was blocked - this is GOOD
                }
            }
            
            // Also try withdraw reentrancy
            uint256 balance = vault.getUserBalance(address(this));
            if (balance > 0) {
                try vault.withdraw(balance) {
                    // Reentrancy succeeded - this is BAD
                } catch {
                    // Reentrancy was blocked - this is GOOD
                }
            }
        }
    }
    
    /**
     * @notice Allow contract to receive funds
     */
    fallback() external payable {}
}


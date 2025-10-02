// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestERC20
 * @dev Simple ERC20 token with public mint function for testing
 */
contract TestERC20 is ERC20 {
    
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _decimals = 18;
    }
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    /**
     * @dev Mint tokens to any address (for testing)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from any address (for testing)
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
    
    /**
     * @dev Override decimals if custom value provided
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}


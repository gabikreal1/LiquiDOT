// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _customDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply, address initialHolder)
        ERC20(name_, symbol_)
    {
        _customDecimals = decimals_;
        if (initialSupply > 0 && initialHolder != address(0)) {
            _mint(initialHolder, initialSupply);
        }
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}



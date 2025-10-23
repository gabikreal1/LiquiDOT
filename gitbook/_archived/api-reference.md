---
icon: code
---

# API Reference

This early-stage API section is intentionally minimal. A full REST/WS reference will ship after we stabilize endpoints. For now, integrate directly with the smart contracts using their ABIs.

## Smart contract ABIs

You can find the compiled ABIs in the repository:

- AssetHubVault ABI: `SmartContracts/artifacts-evm/contracts/V1(Current)/AssetHubVault.sol/AssetHubVault.json`
- XCMProxy ABI: `SmartContracts/artifacts-evm/contracts/V1(Current)/XCMProxy.sol/XCMProxy.json`

Suggested next steps:
- See the contract docs: [Smart Contracts](smart-contracts.md)
- Use your tooling (ethers.js/viem) with the ABIs above
- Check `SmartContracts/deployments/` for addresses

## Roadmap
- REST endpoints for positions, pools, and PnL (post-MVP)
- WebSocket subscriptions for position updates
- Type-safe SDK with contract wrappers

If you need an integration hook now, reach out or open an issue, and we’ll prioritize the specific endpoint.

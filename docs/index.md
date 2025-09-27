# 🌟 LiquiDOT Documentation

<div align="center">
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/Solidity-^0.8.20-blue.svg" alt="Solidity">
  <img src="https://img.shields.io/badge/Network-Polkadot-E6007A.svg" alt="Polkadot">
  <img src="https://img.shields.io/badge/Status-MVP-orange.svg" alt="Status">
</div>

> **Automated Cross-Chain Liquidity Management for the Polkadot Ecosystem**

LiquiDOT is a customizable liquidity provider (LP) manager that simplifies and improves participation in DeFi across multiple parachains. Set your risk preferences, automate LP strategies, and let our system manage your positions with stop-loss and take-profit functionality.

---

## 🚀 Quick Start

### For Users
1. **Connect Wallet** - Connect your Polkadot wallet to our interface
2. **Deposit Assets** - Add tokens to the Asset Hub Vault
3. **Set Preferences** - Configure risk tolerance, stop-loss, and take-profit levels
4. **Start Earning** - Let LiquiDOT optimize your liquidity positions automatically

### For Developers
```bash
# Clone the repository
git clone https://github.com/gabikreal1/LiquiDOT.git

# Install dependencies
cd LiquiDOT/SmartContracts
npm install

# Deploy contracts (testnet)
npx hardhat deploy --network moonbeam-testnet
```

---

## 🏗️ Architecture Overview

<div align="center">
  <img src="../images/liquidot-architecture.png" alt="LiquiDOT Architecture" width="800">
</div>

LiquiDOT follows a **hub-and-spoke model** optimized for cross-chain operations:

### 🏦 **Asset Hub Vault** - *Secure Custody Layer*
- **Primary custody** of all user funds
- **Cross-chain orchestration** via XCM messaging
- **Investment tracking** and balance management
- **Emergency controls** and pause functionality

### ⚡ **XCM Proxy** - *Execution Engine* (Moonbeam)
- **DEX integrations** with Algebra pools
- **Asymmetric range management** (e.g., -5%/+10% around current price)
- **Automated liquidations** when positions exit ranges
- **Position monitoring** and fee collection

### 🔄 **Investment Flow**
1. User deposits assets to **Asset Hub Vault**
2. **Investment Decision Worker** analyzes opportunities
3. Assets transferred via **XCM** to Moonbeam with instructions
4. **XCM Proxy** executes swaps and creates LP positions
5. **Stop-Loss Worker** monitors positions for range exits
6. Automated liquidation returns proceeds to Asset Hub

---

## ✨ Key Features

### 🎯 **User-Friendly Risk Management**
- **Asymmetric Ranges**: Set different upside/downside limits (e.g., -5%/+10%)
- **Stop-Loss Protection**: Automatic position closure when price moves against you
- **Take-Profit Triggers**: Lock in gains at predefined levels
- **Custom Asset Selection**: Choose which tokens to include in your strategy

### 🔗 **Cross-Chain Native**
- **Seamless Integration** across Polkadot parachains
- **XCM-Powered** asset transfers and messaging
- **Multi-DEX Support** starting with Moonbeam Algebra pools
- **Future-Ready** for additional parachain integrations

### 🤖 **Automated Intelligence**
- **Real-Time Monitoring** of position health
- **Dynamic Rebalancing** based on market conditions
- **Gas-Optimized** operations to minimize costs
- **24/7 Monitoring** (during normal operation periods)

### 🛡️ **Security First**
- **Battle-Tested** OpenZeppelin contracts
- **Separation of Concerns**: Custody separated from execution
- **Emergency Controls** for crisis management
- **Comprehensive Testing** with Hardhat and Foundry

---

## 📊 Supported Strategies

| Strategy Type | Risk Level | Description | Typical Range |
|---------------|------------|-------------|---------------|
| **Conservative** | 🟢 Low | Narrow ranges, frequent rebalancing | -2% / +3% |
| **Moderate** | 🟡 Medium | Balanced approach to risk/reward | -5% / +8% |
| **Aggressive** | 🔴 High | Wide ranges, higher potential returns | -10% / +15% |
| **Custom** | ⚙️ Variable | User-defined parameters | User choice |

---

## 🔧 Technical Specifications

### Smart Contracts

#### **AssetHubVault.sol** ([View Source](../SmartContracts/contracts/V1(Current)/AssetHubVault.sol))
```solidity
// Primary functions
function deposit(address token, uint256 amount) external
function withdraw(address token, uint256 amount) external  
function dispatchInvestment(...) external onlyOperator
function handleIncomingXCM(...) external
```

#### **XCMProxy.sol** ([View Source](../SmartContracts/contracts/V1(Current)/XCMProxy.sol))
```solidity
// Core execution functions
function executeInvestment(...) external onlyOwner
function calculateTickRange(...) public view returns (int24, int24)
function executeFullLiquidation(uint256 positionId) external
function liquidateSwapAndReturn(...) external onlyOperator
```

### Integration Points

| Component | Network | Purpose |
|-----------|---------|---------|
| **Asset Hub Vault** | Asset Hub | User custody & XCM orchestration |
| **XCM Proxy** | Moonbeam | DEX execution & position management |
| **Investment Decision Worker** | Backend | Strategy analysis & decision making |
| **Stop-Loss Worker** | Backend | Position monitoring & liquidation triggers |
| **Data Aggregator** | Backend | Pool analytics & price monitoring |

---

## 📈 Getting Started

### Step 1: Set Up Your Environment

```bash
# Frontend (Next.js)
cd Frontend
npm install
npm run dev

# Backend (NestJS) 
cd Backend
npm install
npm start

# Smart Contracts
cd SmartContracts
npm install
npx hardhat compile
```

### Step 2: Configure Your Strategy

1. **Risk Tolerance**: Choose your comfort level with price volatility
2. **Asset Preferences**: Select which tokens you want exposure to
3. **Range Parameters**: Set your asymmetric range preferences
4. **Limits**: Define maximum allocation per pool and minimum APY

### Step 3: Monitor Performance

Track your positions through our dashboard:
- **Real-time P&L** tracking
- **Position health** indicators  
- **Historical performance** charts
- **Transaction history** and fee analysis

---

## 🎯 Roadmap

### ✅ **Phase 1 - MVP** (Current)
- [x] Core smart contracts on Asset Hub & Moonbeam
- [x] Basic frontend with wallet connection
- [x] Investment decision engine
- [x] Stop-loss monitoring system

### 🚧 **Phase 2 - Multi-Chain** (Q1-2 2026)
- [ ] Hydration DEX integration
- [ ] Acala parachain support
- [ ] Advanced strategy options
- [ ] Mobile app development

### 🔮 **Phase 3 - Decentralization** (Q3-4 2026)
- [ ] DAO governance implementation
- [ ] zkProof-verified decisions
- [ ] Position NFTs (ERC-721)


---

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guide](./contributing.md) for details.

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes with tests
4. **Submit** a pull request

### Testing
```bash
# Run contract tests
cd SmartContracts
npx hardhat test

# Run frontend tests  
cd Frontend
npm test

# Run backend tests
cd Backend
npm test
```

---

## 📚 Documentation

- **[Smart Contract API](./contracts.md)** - Detailed contract documentation
- **[Integration Guide](./integration.md)** - How to integrate with LiquiDOT
- **[User Manual](./user-guide.md)** - Complete user documentation
- **[Security Audit](./security.md)** - Security considerations and audit reports
- **[FAQ](./faq.md)** - Frequently asked questions

---

## 🆘 Support

- **Discord**: [Join our community](https://discord.gg/liquidot)
- **Twitter**: [@LiquiDOT_xyz](https://twitter.com/liquidot_xyz)
- **Email**: support@liquidot.xyz
- **Documentation**: [docs.liquidot.xyz](https://docs.liquidot.xyz)

---

## ⚖️ License

This project is licensed under the **Apache 2.0 License** - see the [LICENSE](../LICENSE) file for details.

---

## 🏆 Team

- **Gabriel** - Lead Developer & Architecture
- **Rashad** - Fintech & Backend Systems  
- **Theo** - DeFi Strategy & Business Analytics

---

<div align="center">
  <p><strong>Built with ❤️ for the Polkadot Ecosystem</strong></p>
  <p>
    <a href="https://github.com/gabikreal1/LiquiDOT">GitHub</a> •
    <a href="https://liquidot.xyz">Website</a> •
    <a href="https://docs.liquidot.xyz">Documentation</a>
  </p>
</div>

# 🤝 Contributing to LiquiDOT

> Welcome! We're excited you want to contribute to the future of cross-chain liquidity management.

---

## 🎯 How to Contribute

### 🐛 **Bug Reports**
Found something broken? Help us fix it!

### 💡 **Feature Requests**  
Have ideas for improvements? We'd love to hear them!

### 🔧 **Code Contributions**
Ready to get your hands dirty? Jump right in!

### 📚 **Documentation**
Help make our docs clearer for everyone

### 🌟 **Community Support**
Answer questions and help other users

---

## 🚀 Getting Started

### Prerequisites

**Development Environment:**
```bash
# Node.js (v18+)
node --version

# Git
git --version

# Your preferred code editor
# VS Code with Solidity extension recommended
```

**Blockchain Tools:**
```bash
# Hardhat for smart contract development
npm install -g hardhat

# Foundry for advanced testing (optional)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Repository Setup

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/LiquiDOT.git
   cd LiquiDOT
   ```

2. **Install Dependencies**
   ```bash
   # Smart contracts
   cd SmartContracts
   npm install
   
   # Frontend
   cd ../Frontend  
   npm install
   
   # Backend
   cd ../Backend
   npm install
   ```

3. **Set Up Environment**
   ```bash
   # Copy example environment files
   cp Backend/.env.example Backend/.env
   cp SmartContracts/.env.example SmartContracts/.env
   
   # Configure with your settings
   # (API keys, RPC endpoints, etc.)
   ```

4. **Verify Setup**
   ```bash
   # Test smart contract compilation
   cd SmartContracts
   npx hardhat compile
   
   # Run tests
   npx hardhat test
   
   # Start frontend development server
   cd ../Frontend
   npm run dev
   ```

---

## 📋 Development Workflow

### 1. **Create a Branch**
```bash
# Create a descriptive branch name
git checkout -b feature/asymmetric-range-ui
git checkout -b fix/liquidation-gas-optimization
git checkout -b docs/user-guide-improvements
```

### 2. **Make Changes**

#### **Smart Contract Changes**
```bash
cd SmartContracts

# Make your changes
# Edit contracts in contracts/

# Compile and test
npx hardhat compile
npx hardhat test

# Run specific tests
npx hardhat test test/AssetHubVault.test.ts

# Check gas usage
npx hardhat test --gas-reporter
```

#### **Frontend Changes**
```bash
cd Frontend

# Start development server
npm run dev

# Make your changes
# Edit components in components/

# Run tests
npm test

# Check TypeScript
npm run type-check

# Lint code
npm run lint
```

#### **Backend Changes**
```bash
cd Backend

# Start development server
npm start

# Make your changes
# Edit services in src/

# Run tests
npm test

# Check linting
npm run lint
```

### 3. **Test Your Changes**

#### **Comprehensive Testing**
```bash
# Test all components
cd SmartContracts && npm test
cd ../Frontend && npm test  
cd ../Backend && npm test

# Integration testing
# Start local blockchain
cd SmartContracts
npx hardhat node

# Deploy contracts to local network
npx hardhat deploy --network localhost

# Test full stack integration
```

### 4. **Commit and Push**
```bash
# Stage your changes
git add .

# Write a descriptive commit message
git commit -m "feat: add asymmetric range support to position creation

- Add lowerRangePercent and upperRangePercent parameters
- Update calculateTickRange to handle asymmetric ranges  
- Add validation for range parameters
- Update tests for new functionality"

# Push to your fork
git push origin feature/asymmetric-range-ui
```

### 5. **Create Pull Request**

1. **Go to GitHub** and create a pull request from your fork
2. **Write a clear description** of what your changes do
3. **Link related issues** if applicable  
4. **Request review** from maintainers

---

## 📝 Code Standards

### Smart Contract Guidelines

#### **Solidity Style**
```solidity
// Use latest Solidity version
pragma solidity ^0.8.20;

// Clear contract documentation
/**
 * @title AssetHubVault
 * @dev Primary custody layer for cross-chain liquidity management
 * @notice Handles user deposits and cross-chain orchestration
 */
contract AssetHubVault {
    // Constants in UPPER_CASE
    uint256 public constant MAX_POSITION_SIZE = 1e30;
    
    // State variables with clear names
    mapping(address => mapping(address => uint256)) public userBalances;
    
    // Custom errors for gas efficiency
    error InsufficientBalance();
    error InvalidRange();
    
    // Functions with comprehensive documentation
    /**
     * @dev Deposit tokens into the vault
     * @param token ERC20 token address
     * @param amount Amount to deposit in token's smallest unit
     */
    function deposit(address token, uint256 amount) external {
        // Implementation
    }
}
```

#### **Security Best Practices**
- ✅ **Use OpenZeppelin** contracts where possible
- ✅ **Implement reentrancy protection** on state-changing functions
- ✅ **Validate all inputs** with clear error messages
- ✅ **Use custom errors** instead of string reverts (gas efficiency)
- ✅ **Follow checks-effects-interactions** pattern
- ✅ **Add comprehensive tests** for edge cases

### Frontend Guidelines

#### **React/TypeScript Style**
```typescript
// Use TypeScript for all new components
interface LiquidityPositionProps {
  position: Position;
  onLiquidate: (positionId: string) => Promise<void>;
}

// Functional components with hooks
export const LiquidityPosition: React.FC<LiquidityPositionProps> = ({
  position,
  onLiquidate
}) => {
  const [isLiquidating, setIsLiquidating] = useState(false);
  
  const handleLiquidate = async () => {
    setIsLiquidating(true);
    try {
      await onLiquidate(position.id);
    } finally {
      setIsLiquidating(false);
    }
  };
  
  return (
    <div className="position-card">
      {/* Component JSX */}
    </div>
  );
};
```

#### **UI/UX Standards**
- ✅ **Responsive design** for mobile and desktop
- ✅ **Accessible components** with proper ARIA labels
- ✅ **Loading states** for async operations
- ✅ **Error handling** with user-friendly messages
- ✅ **Consistent styling** using Tailwind CSS classes

### Backend Guidelines

#### **NestJS/TypeScript Style**
```typescript
// Use decorators and dependency injection
@Injectable()
export class InvestmentDecisionService {
  constructor(
    private readonly poolAnalytics: PoolAnalyticsService,
    private readonly riskManager: RiskManagerService,
  ) {}
  
  // Clear method documentation
  /**
   * Analyze market conditions and make investment decision
   * @param userPreferences User's risk tolerance and asset preferences
   * @param availablePools Current pool opportunities
   * @returns Investment recommendation with position parameters
   */
  async analyzeInvestmentOpportunity(
    userPreferences: UserPreferences,
    availablePools: Pool[]
  ): Promise<InvestmentDecision> {
    // Implementation
  }
}
```

#### **API Standards**
- ✅ **RESTful endpoints** with clear naming
- ✅ **Input validation** using class-validator
- ✅ **Error handling** with proper HTTP status codes
- ✅ **Rate limiting** to prevent abuse
- ✅ **API documentation** using Swagger/OpenAPI

---

## 🧪 Testing Requirements

### Smart Contract Tests

#### **Required Coverage**
- ✅ **Unit tests** for all public functions
- ✅ **Integration tests** for contract interactions
- ✅ **Edge case testing** for boundary conditions
- ✅ **Security tests** for access control and reentrancy
- ✅ **Gas optimization tests** for cost efficiency

#### **Test Structure**
```typescript
describe("AssetHubVault", () => {
  let vault: AssetHubVault;
  let token: MockERC20;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  
  beforeEach(async () => {
    // Setup test environment
  });
  
  describe("deposit", () => {
    it("should accept valid deposits", async () => {
      // Test normal operation
    });
    
    it("should reject zero amount deposits", async () => {
      // Test edge case
    });
    
    it("should emit Deposit event", async () => {
      // Test event emission
    });
  });
});
```

### Frontend Tests

#### **Component Testing**
```typescript
// Use React Testing Library
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('LiquidityPosition', () => {
  it('displays position information correctly', () => {
    const mockPosition = {
      id: '1',
      pool: 'USDC/DOT',
      value: '1000.00',
      status: 'active'
    };
    
    render(<LiquidityPosition position={mockPosition} />);
    
    expect(screen.getByText('USDC/DOT')).toBeInTheDocument();
    expect(screen.getByText('$1000.00')).toBeInTheDocument();
  });
});
```

### Backend Tests

#### **Service Testing**
```typescript
describe('InvestmentDecisionService', () => {
  let service: InvestmentDecisionService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [InvestmentDecisionService]
    }).compile();
    
    service = module.get<InvestmentDecisionService>(InvestmentDecisionService);
  });
  
  it('should recommend conservative strategy for low risk tolerance', async () => {
    // Test business logic
  });
});
```

---

## 📚 Documentation Standards

### Code Documentation

#### **Inline Comments**
```solidity
// Explain complex business logic
function calculateTickRange(
    address pool,
    int24 lowerRangePercent, // -500 = -5%
    int24 upperRangePercent  // 1000 = +10%
) public view returns (int24 bottomTick, int24 topTick) {
    // Convert percentage to tick approximation (1% ≈ 100 ticks)
    int24 downTicks = int24(lowerRangePercent * 100);
    int24 upTicks = int24(upperRangePercent * 100);
    
    // Rest of implementation...
}
```

#### **README Updates**
When adding new features, update relevant README files:
- Main repository README
- Component-specific READMEs
- Deployment instructions
- API documentation

### User Documentation

#### **User Guide Updates**
```markdown
## New Feature: Asymmetric Range Management

You can now set different upside and downside limits for your positions:

1. **Navigate** to the Strategy Configuration panel
2. **Select** "Custom Range" option  
3. **Set** your downside protection (e.g., -5%)
4. **Set** your upside target (e.g., +10%)
5. **Confirm** your strategy settings

This allows for more nuanced risk management...
```

---

## 🔍 Code Review Process

### Review Checklist

#### **Functionality**
- [ ] **Code works** as intended
- [ ] **Edge cases** are handled
- [ ] **Error handling** is appropriate
- [ ] **Performance** is acceptable

#### **Security**
- [ ] **Input validation** is comprehensive
- [ ] **Access controls** are correct
- [ ] **No vulnerabilities** introduced
- [ ] **Gas usage** is optimized (smart contracts)

#### **Code Quality**
- [ ] **Code is readable** and well-documented
- [ ] **Follows style guidelines** 
- [ ] **No duplicate code** without justification
- [ ] **Tests are comprehensive**

#### **Documentation**
- [ ] **Code changes** are documented
- [ ] **User-facing changes** have updated guides
- [ ] **API changes** are documented
- [ ] **Breaking changes** are clearly marked

### Review Timeline

1. **Initial Review**: Within 2-3 business days
2. **Feedback Cycle**: Respond to comments within 24 hours
3. **Final Approval**: 1-2 business days after addressing feedback
4. **Merge**: After all checks pass and approval

---

## 🏆 Recognition

### Hall of Fame

Contributors who make significant improvements will be recognized:

- **README acknowledgments** for major contributions
- **Special roles** in Discord community
- **Priority consideration** for future opportunities
- **Potential rewards** as the project grows

### Types of Contributions

#### **🥇 Gold Level**
- Major feature implementations
- Significant security improvements
- Architecture enhancements

#### **🥈 Silver Level**  
- Bug fixes and optimizations
- Documentation improvements
- Testing enhancements

#### **🥉 Bronze Level**
- Minor bug fixes
- Code cleanup
- Translation work

---

## 📞 Getting Help

### Development Questions

#### **Discord Channels**
- `#dev-general` - General development discussion
- `#smart-contracts` - Solidity and blockchain questions
- `#frontend` - React/TypeScript/UI questions
- `#backend` - NestJS/API questions

#### **GitHub Resources**
- **Issues**: Search existing issues before creating new ones
- **Discussions**: For broader architectural questions
- **Wiki**: Development guides and best practices

### Maintainer Contact

#### **Core Team**
- **Gabriel** (@gabikreal1) - Lead Developer & Architecture
- **Rashadi** (@rashad-h) - Fintech & Backend Systems
- **Theo** (@fedyacrypto) - DeFi Strategy & Business Analytics

#### **Response Times**
- **Urgent issues**: Within 24 hours
- **General questions**: Within 2-3 days
- **Feature discussions**: Within 1 week

---

## 📜 Contributor License Agreement

By contributing to LiquiDOT, you agree that:

1. **Your contributions** are original work or properly attributed
2. **You have rights** to contribute the work
3. **Your contributions** may be used under the project's Apache 2.0 license
4. **You understand** this is an open-source project

---

**Ready to contribute? 🚀**

Start by exploring our [Good First Issues](https://github.com/gabikreal1/LiquiDOT/labels/good%20first%20issue) or join our [Discord community](https://discord.gg/liquidot) to discuss your ideas!

*Thank you for helping build the future of cross-chain DeFi! 🌟*

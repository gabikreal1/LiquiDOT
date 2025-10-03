# Foundry Installation Guide

This guide will help you install Foundry on your system to run the LiquiDOT Foundry test suite.

## 📋 What is Foundry?

Foundry is a blazing fast, portable, and modular toolkit for Ethereum application development written in Rust. It consists of:

- **Forge** - Ethereum testing framework (like Hardhat, but faster)
- **Cast** - Swiss army knife for interacting with EVM smart contracts
- **Anvil** - Local Ethereum node (like Ganache)
- **Chisel** - Solidity REPL

## 🪟 Windows Installation

### Option 1: Using Foundryup (Recommended)

**Requirements:**
- Git for Windows or WSL (Windows Subsystem for Linux)

**Steps:**

1. **Install Git for Windows** (if not already installed)
   - Download from: https://git-scm.com/download/win
   - Install with default settings

2. **Open Git Bash** (comes with Git for Windows)
   - Right-click in any folder → "Git Bash Here"
   - Or search "Git Bash" in Start menu

3. **Run Foundryup Installer**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   ```

4. **Run Foundryup**
   ```bash
   foundryup
   ```

5. **Verify Installation**
   ```bash
   forge --version
   ```

### Option 2: Using Pre-built Binaries

**Steps:**

1. **Download Latest Release**
   - Go to: https://github.com/foundry-rs/foundry/releases
   - Download `foundry_nightly_windows_amd64.zip` (or latest)

2. **Extract Files**
   - Extract the ZIP file to a folder (e.g., `C:\foundry`)
   - You should see: `forge.exe`, `cast.exe`, `anvil.exe`, `chisel.exe`

3. **Add to PATH**
   - Open "Edit the system environment variables"
   - Click "Environment Variables"
   - Under "User variables", select "Path" → "Edit"
   - Click "New" and add the folder path (e.g., `C:\foundry`)
   - Click "OK" on all dialogs

4. **Restart Terminal**
   - Close and reopen PowerShell or Command Prompt

5. **Verify Installation**
   ```powershell
   forge --version
   ```

### Option 3: Using WSL (Advanced)

If you're comfortable with WSL:

1. **Install WSL**
   ```powershell
   wsl --install
   ```

2. **Open WSL Terminal**
   ```powershell
   wsl
   ```

3. **Follow Linux instructions below**

## 🍎 macOS Installation

### Using Foundryup (Recommended)

```bash
# Install Foundryup
curl -L https://foundry.paradigm.xyz | bash

# Run Foundryup to install Forge, Cast, Anvil, and Chisel
foundryup
```

### Using Homebrew

```bash
# If you prefer Homebrew
brew install foundry
```

### Verify Installation

```bash
forge --version
cast --version
anvil --version
```

## 🐧 Linux Installation

### Using Foundryup

```bash
# Install Foundryup
curl -L https://foundry.paradigm.xyz | bash

# Add foundryup to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$PATH:~/.foundry/bin"

# Run Foundryup
foundryup
```

### Verify Installation

```bash
forge --version
```

## 🔧 Post-Installation Setup

### 1. Install forge-std Library

Navigate to your project directory and run:

```bash
cd SmartContracts
forge install foundry-rs/forge-std --no-commit
```

### 2. Verify Foundry Configuration

Check that `foundry.toml` exists in the `SmartContracts/` directory. If not, the tests will create it automatically.

### 3. Build Contracts

```bash
forge build
```

This will compile all contracts and verify your setup is working.

### 4. Run Tests

```bash
forge test
```

If you see tests running, you're all set! 🎉

## 🐛 Troubleshooting

### Windows Issues

**Issue: "forge is not recognized as a command"**
- **Solution:** Foundry not in PATH. Verify PATH settings or reinstall using Option 2 above.

**Issue: "Error loading DLL" on Windows**
- **Solution:** Install Visual C++ Redistributable:
  - Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
  - Install and restart terminal

**Issue: Git Bash shows "command not found"**
- **Solution:** Close and reopen Git Bash, or restart your computer

### macOS Issues

**Issue: "forge: command not found"**
- **Solution:** Add to PATH:
  ```bash
  echo 'export PATH="$PATH:~/.foundry/bin"' >> ~/.zshrc
  source ~/.zshrc
  ```

**Issue: Permission denied**
- **Solution:** Run with proper permissions:
  ```bash
  chmod +x ~/.foundry/bin/forge
  ```

### Linux Issues

**Issue: "curl: command not found"**
- **Solution:** Install curl first:
  ```bash
  sudo apt-get update
  sudo apt-get install curl
  ```

**Issue: Build errors**
- **Solution:** Install build dependencies:
  ```bash
  sudo apt-get install build-essential
  ```

### General Issues

**Issue: "Compiler version mismatch"**
- **Solution:** Update Foundry:
  ```bash
  foundryup
  ```

**Issue: Tests failing unexpectedly**
- **Solution:** Clean and rebuild:
  ```bash
  forge clean
  forge build
  forge test
  ```

**Issue: Out of memory errors**
- **Solution:** Reduce fuzz runs in `foundry.toml`:
  ```toml
  [fuzz]
  runs = 128  # Reduced from 256
  ```

## 📚 Verify Your Installation

Run these commands to ensure everything is working:

```bash
# Check versions
forge --version
cast --version
anvil --version

# Navigate to project
cd SmartContracts

# Install dependencies
forge install foundry-rs/forge-std --no-commit

# Build contracts
forge build

# Run tests
forge test

# Run with verbosity to see details
forge test -vv
```

Expected output:
```
[⠊] Compiling...
[⠒] Compiling 4 files with 0.8.24
[⠢] Solc 0.8.24 finished in 3.21s
Compiler run successful!

Running 85 tests for test/foundry/AssetHubVault.t.sol:AssetHubVaultTest
[PASS] testDeposit() (gas: 52341)
[PASS] testDepositEmitsEvent() (gas: 54123)
...
Test result: ok. 85 passed; 0 failed; finished in 10.20s
```

## 🎓 Next Steps

After successful installation:

1. **Read the Test README**
   - See `test/foundry/README.md` for test structure and usage

2. **Run Specific Tests**
   ```bash
   forge test --match-path test/foundry/AssetHubVault.t.sol
   ```

3. **Check Gas Usage**
   ```bash
   forge test --gas-report
   ```

4. **Generate Coverage**
   ```bash
   forge coverage
   ```

5. **Learn More**
   - Foundry Book: https://book.getfoundry.sh/
   - GitHub: https://github.com/foundry-rs/foundry

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check the [Foundry Book](https://book.getfoundry.sh/)
2. Search [Foundry GitHub Issues](https://github.com/foundry-rs/foundry/issues)
3. Ask in [Foundry Telegram](https://t.me/foundry_rs)
4. Ask in [Foundry Discord](https://discord.gg/foundry)

## ✅ Installation Checklist

- [ ] Foundry installed (`forge --version` works)
- [ ] forge-std library installed
- [ ] Contracts build successfully (`forge build`)
- [ ] Tests run successfully (`forge test`)
- [ ] Gas reports work (`forge test --gas-report`)

**When all items are checked, you're ready to develop and test with Foundry!** 🚀


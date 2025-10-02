#!/usr/bin/env node
"use strict";

const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");
const { loadState } = require("./utils/state-manager");

const ROOT = path.resolve(__dirname, "..");
const HARDHAT_BIN = process.env.HARDHAT_BIN || path.join(ROOT, "node_modules", ".bin", "hardhat");

function prompt(question, defaultValue) {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed.length > 0 ? trimmed : defaultValue);
    });
  });
}

async function runHardhatScript(scriptPath, network, envOverrides) {
  const absolute = path.resolve(__dirname, scriptPath);
  console.log(`\n▶ Running ${absolute} on network "${network}" ...`);

  await new Promise((resolve, reject) => {
    const child = spawn(
      HARDHAT_BIN,
      ["run", "--network", network, absolute],
      {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, ...envOverrides },
      }
    );

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log("LiquiDOT XCM deployment orchestrator\n" + "=".repeat(36));

  const defaultNetwork = process.env.HARDHAT_NETWORK || "moonbase";
  const network = await prompt("Target network (Hardhat network name)", defaultNetwork);

  const state = loadState();
  const networkState = state.networks?.[network] || {};

  const runAlgebra = await prompt("Deploy Algebra suite? (y/N)", "N");
  const algebraDecision = runAlgebra.toLowerCase() === "y";

  const ownerDefault = process.env.XCMP_OWNER || networkState.contracts?.XCMProxy?.config?.owner;
  const operatorDefault = process.env.XCMP_OPERATOR || networkState.contracts?.XCMProxy?.config?.operator;
  const quoterDefault = process.env.XCMP_QUOTER || networkState.contracts?.XCMProxy?.config?.quoter;
  const routerDefault = process.env.XCMP_ROUTER || networkState.contracts?.XCMProxy?.config?.router;
  const nfpmDefault = process.env.XCMP_NFPM || networkState.contracts?.XCMProxy?.config?.nfpm;
  const xtokensDefault = process.env.XCMP_XTOKENS || networkState.contracts?.XCMProxy?.config?.xtokensPrecompile;
  const destWeightDefault = process.env.XCMP_DEST_WEIGHT || networkState.contracts?.XCMProxy?.config?.defaultDestWeight || "6000000000";
  const paraIdDefault = process.env.XCMP_ASSET_HUB_PARAID || (networkState.contracts?.XCMProxy?.config?.assetHubParaId ?? "0");
  const trustedCallerDefault = process.env.XCMP_TRUSTED_CALLER || networkState.contracts?.XCMProxy?.config?.trustedXcmCaller;
  const transactorDefault = process.env.XCMP_TRANSACTOR || networkState.contracts?.XCMProxy?.config?.xcmTransactorPrecompile;
  const slippageDefault = process.env.XCMP_DEFAULT_SLIPPAGE || (networkState.contracts?.XCMProxy?.config?.defaultSlippageBps ?? "100");
  const supportedTokensDefault = process.env.XCMP_SUPPORTED_TOKENS ||
    (networkState.contracts?.XCMProxy?.config?.supportedTokens ?
      Object.entries(networkState.contracts.XCMProxy.config.supportedTokens)
        .filter(([, val]) => val)
        .map(([token]) => token)
        .join(",") :
      "");
  const freezeDefault = process.env.XCMP_FREEZE_CONFIG || (networkState.contracts?.XCMProxy?.config?.xcmConfigFrozen ? "true" : "false");

  const xcmpOwner = await prompt("XCMProxy owner address", ownerDefault);
  const xcmpOperator = await prompt("XCMProxy operator address", operatorDefault || xcmpOwner);
  const quoter = await prompt("Quoter contract address", quoterDefault || "0x0000000000000000000000000000000000000000");
  const router = await prompt("Swap router contract address", routerDefault || "0x0000000000000000000000000000000000000000");
  const nfpm = await prompt("NFPM contract address", nfpmDefault || "0x0000000000000000000000000000000000000000");
  const xtokensPrecompile = await prompt("xTokens precompile address", xtokensDefault || "0x0000000000000000000000000000000000000000");
  const destWeight = await prompt("Default dest weight", destWeightDefault);
  const paraId = await prompt("Asset Hub paraId", String(paraIdDefault));
  const trustedCaller = await prompt("Trusted XCM caller (optional)", trustedCallerDefault || "0x0000000000000000000000000000000000000000");
  const xcmTransactor = await prompt("XCM Transactor precompile", transactorDefault || "0x0000000000000000000000000000000000000000");
  const defaultSlippage = await prompt("Default slippage bps", String(slippageDefault));
  const supportedTokens = await prompt("Supported tokens (comma-separated)", supportedTokensDefault);
  const freeze = await prompt("Freeze XCM config after setup? (true/false)", freezeDefault);

  const vaultDefault = process.env.ASSETHUB_VAULT_ADDRESS || networkState.contracts?.AssetHubVault?.address || "0x84bc73388D2346B450a03041D27881d87a8F2314";
  const vaultAddress = await prompt("AssetHubVault address", vaultDefault);
  const vaultAdmin = await prompt("Vault admin", process.env.ASSETHUB_ADMIN || networkState.contracts?.AssetHubVault?.config?.admin);
  const vaultOperator = await prompt("Vault operator", process.env.ASSETHUB_OPERATOR || networkState.contracts?.AssetHubVault?.config?.operator || xcmpOperator);
  const vaultEmergency = await prompt("Vault emergency", process.env.ASSETHUB_EMERGENCY || networkState.contracts?.AssetHubVault?.config?.emergency || xcmpOwner);
  const vaultPrecompile = await prompt("Vault XCM precompile", process.env.ASSETHUB_XCM_PRECOMPILE || networkState.contracts?.AssetHubVault?.config?.xcmPrecompile || xtokensPrecompile);
  const vaultFreeze = await prompt("Freeze vault XCM precompile? (true/false)", process.env.ASSETHUB_FREEZE || (networkState.contracts?.AssetHubVault?.config?.xcmPrecompileFrozen ? "true" : "false"));
  const vaultPause = await prompt("Set vault paused state? (true/false)", process.env.ASSETHUB_PAUSE || (networkState.contracts?.AssetHubVault?.config?.paused ? "true" : "false"));

  const childEnv = {
    XCMP_OWNER: xcmpOwner,
    XCMP_OPERATOR: xcmpOperator,
    XCMP_QUOTER: quoter,
    XCMP_ROUTER: router,
    XCMP_NFPM: nfpm,
    XCMP_XTOKENS: xtokensPrecompile,
    XCMP_DEST_WEIGHT: destWeight,
    XCMP_ASSET_HUB_PARAID: paraId,
    XCMP_TRUSTED_CALLER: trustedCaller,
    XCMP_TRANSACTOR: xcmTransactor,
    XCMP_DEFAULT_SLIPPAGE: defaultSlippage,
    XCMP_SUPPORTED_TOKENS: supportedTokens,
    XCMP_FREEZE_CONFIG: freeze,
    ASSETHUB_VAULT_ADDRESS: vaultAddress,
    ASSETHUB_ADMIN: vaultAdmin,
    ASSETHUB_OPERATOR: vaultOperator,
    ASSETHUB_EMERGENCY: vaultEmergency,
    ASSETHUB_XCM_PRECOMPILE: vaultPrecompile,
    ASSETHUB_FREEZE: vaultFreeze,
    ASSETHUB_PAUSE: vaultPause,
  };

  try {
    if (algebraDecision) {
      await runHardhatScript("XCMPROXY/deploy-algebra-suite.js", network, childEnv);
    } else {
      console.log("Skipping Algebra suite deployment as requested.");
    }

    await runHardhatScript("XCMPROXY/deploy-xcm-proxy.js", network, childEnv);
    await runHardhatScript("AssetHubVault/configure-assethub-vault.js", network, childEnv);

    console.log("\n✅ XCM deployment pipeline complete.");
  } catch (error) {
    console.error("\n❌ Pipeline failed:", error.message);
    process.exitCode = 1;
  }
}

main();



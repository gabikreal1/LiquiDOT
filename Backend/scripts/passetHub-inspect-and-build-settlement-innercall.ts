/*
  PassetHub metadata inspector + settlement innerCall builder.

  MIGRATED TO P-API (polkadot-api) - replaces previous Polkadot.js implementation.

  What it does:
  - Connects to PASSET_HUB_WS via P-API (polkadot-api)
  - Checks availability of pallets/calls used for Transact settlement
  - Builds SCALE-encoded innerCall hex for:
      - Revive.call(...)
      - Utility.force_batch([...]) (if available)

  Usage (run from Backend/):
    PASSET_HUB_WS=wss://... \
    ASSET_HUB_VAULT=0x... \
    POSITION_ID=0x... (bytes32) \
    AMOUNT=12345 \
    node --loader ts-node/esm scripts/passetHub-inspect-and-build-settlement-innercall.ts

  Notes:
  - This script is metadata-driven: it does not hardcode pallet indices.
  - Uses P-API UnsafeApi for dynamic pallet access (no codegen required).
*/

import { Interface } from 'ethers';

type HexString = `0x${string}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function isHexString(v: string): v is HexString {
  return /^0x[0-9a-fA-F]*$/.test(v);
}

function asHex(name: string, v: string): HexString {
  if (!isHexString(v)) throw new Error(`${name} must be hex, got: ${v}`);
  return v as HexString;
}

function optionalBool(v: string | undefined): boolean {
  if (!v) return false;
  return ['1', 'true', 'yes', 'y'].includes(v.toLowerCase());
}

/**
 * UnsafeApi type - provides dynamic access to pallets without descriptors
 */
type UnsafeApi = {
  tx: Record<string, Record<string, (args: Record<string, unknown>) => unknown>>;
  query: Record<string, Record<string, unknown>>;
};

/**
 * Transaction type from polkadot-api
 */
interface PapiTransaction {
  getEncodedData(): Promise<{ asHex(): string; asBytes(): Uint8Array }>;
  decodedCall: unknown;
}

async function main() {
  const ws = requireEnv('PASSET_HUB_WS');
  const assetHubVault = requireEnv('ASSET_HUB_VAULT');
  const positionId = asHex('POSITION_ID', requireEnv('POSITION_ID'));
  const amountStr = requireEnv('AMOUNT');
  const includeMapAccount = optionalBool(process.env.INCLUDE_MAP_ACCOUNT);

  if (!/^0x[0-9a-fA-F]{40}$/.test(assetHubVault)) {
    throw new Error(`ASSET_HUB_VAULT must be an EVM address (0x + 40 hex chars), got: ${assetHubVault}`);
  }
  const amount = BigInt(amountStr);

  // Dynamic import P-API (ESM-only)
  const { createClient } = await import('polkadot-api');
  const { getWsProvider } = await import('polkadot-api/ws-provider/node');

  console.log(`Connecting to PassetHub: ${ws}`);
  const provider = getWsProvider(ws);
  const client = createClient(provider);

  try {
    // Get UnsafeApi for dynamic pallet access
    const unsafeApi = (client as any).getUnsafeApi() as UnsafeApi;

    const hasRevive = !!unsafeApi.tx.Revive;
    const hasUtility = !!unsafeApi.tx.Utility;

    console.log('Pallets present:', { Revive: hasRevive, Utility: hasUtility });

    if (!hasRevive) {
      throw new Error(`No Revive pallet found in metadata (unsafeApi.tx.Revive is undefined).`);
    }

    const reviveCall = unsafeApi.tx.Revive?.call;
    const reviveMapAccount = unsafeApi.tx.Revive?.map_account;

    console.log('Revive calls present:', {
      call: typeof reviveCall === 'function',
      map_account: typeof reviveMapAccount === 'function',
    });

    // Build the EVM calldata for AssetHubVault.settleLiquidation(bytes32,uint256)
    const vaultIface = new Interface([
      'function settleLiquidation(bytes32 positionId,uint256 receivedAmount)',
    ]);
    const evmCalldata = vaultIface.encodeFunctionData('settleLiquidation', [positionId, amount]) as HexString;

    console.log('EVM calldata:', { evmCalldata, bytes: (evmCalldata.length - 2) / 2 });

    // ----- Try to construct Revive.call(...) in a runtime-agnostic way -----
    const candidates: Array<{ label: string; args: Record<string, unknown> }> = [
      {
        label: 'A(dest,value,gas_limit,storage_deposit_limit,data)',
        args: {
          dest: assetHubVault,
          value: 0n,
          gas_limit: 1_000_000_000n,
          storage_deposit_limit: undefined,
          data: evmCalldata,
        },
      },
      {
        label: 'B(dest,value,gas_limit,storage_deposit_limit,input_data)',
        args: {
          dest: assetHubVault,
          value: 0n,
          gas_limit: 1_000_000_000n,
          storage_deposit_limit: undefined,
          input_data: evmCalldata,
        },
      },
      {
        label: 'C(dest,value,gas_limit,data) - no storage limit',
        args: {
          dest: assetHubVault,
          value: 0n,
          gas_limit: 1_000_000_000n,
          data: evmCalldata,
        },
      },
    ];

    let reviveCallTx: PapiTransaction | null = null;
    let reviveCallUsed: string | null = null;

    for (const c of candidates) {
      try {
        reviveCallTx = reviveCall!(c.args) as PapiTransaction;
        reviveCallUsed = c.label;
        break;
      } catch (e: any) {
        console.log(`Revive.call candidate failed (${c.label}): ${e?.message ?? e}`);
      }
    }

    if (!reviveCallTx) {
      throw new Error('Failed to construct Revive.call extrinsic with all candidates.');
    }

    const reviveInnerCallEncoded = await reviveCallTx.getEncodedData();
    const reviveInnerCallHex = reviveInnerCallEncoded.asHex() as HexString;

    console.log('Revive.call constructed with:', reviveCallUsed);
    console.log('innerCallHex (Revive.call only):', reviveInnerCallHex);

    // ----- Optionally wrap in utility batch -----
    const forceBatch = unsafeApi.tx.Utility?.force_batch;
    const batchAll = unsafeApi.tx.Utility?.batch_all;
    const batch = unsafeApi.tx.Utility?.batch;

    const canMap = typeof reviveMapAccount === 'function';

    if (hasUtility && (typeof forceBatch === 'function' || typeof batchAll === 'function' || typeof batch === 'function')) {
      const calls: unknown[] = [];

      if (includeMapAccount) {
        if (!canMap) {
          console.log('INCLUDE_MAP_ACCOUNT was set, but Revive.map_account is not available on this runtime. Skipping.');
        } else {
          try {
            const mapAccountTx = reviveMapAccount!({}) as PapiTransaction;
            calls.push(mapAccountTx.decodedCall);
          } catch (e: any) {
            console.log(`Revive.map_account() construct failed: ${e?.message ?? e}`);
          }
        }
      }

      calls.push(reviveCallTx.decodedCall);

      const batchFn = forceBatch || batchAll || batch;
      const batchLabel =
        batchFn === forceBatch ? 'Utility.force_batch' : batchFn === batchAll ? 'Utility.batch_all' : 'Utility.batch';

      const batchedTx = batchFn!({ calls }) as PapiTransaction;
      const batchedEncoded = await batchedTx.getEncodedData();
      const batchedInnerCallHex = batchedEncoded.asHex() as HexString;

      console.log('innerCallHex (batched):', { batchLabel, batchedInnerCallHex });
    } else {
      console.log('Utility batching not available on this runtime; only Revive.call innerCall produced.');
    }

    // Bonus: print Revive.map_account availability
    if (canMap) {
      console.log('Revive.map_account is available on this runtime');
    }
  } finally {
    // Disconnect client
    try {
      const c: any = client;
      if (c?.disconnect) await c.disconnect();
      if (c?.destroy) await c.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

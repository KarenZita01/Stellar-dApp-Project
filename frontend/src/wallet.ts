/**
 * wallet.ts
 *
 * Real wallet integration using @creit.tech/stellar-wallets-kit v2.5.
 *
 * StellarWalletsKit and Networks come from the main package entry.
 * FreighterModule must be imported from the subpath:
 *   @creit.tech/stellar-wallets-kit/modules/freighter
 */

import {
  StellarWalletsKit,
  Networks,
} from '@creit.tech/stellar-wallets-kit';

import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';

// ── Initialise the kit once at module load ────────────────────────────────
// StellarWalletsKit.init must be called before any other method.
StellarWalletsKit.init({
  modules: [new FreighterModule()],
  network: Networks.TESTNET,
});

// ── Re-export for consumers ───────────────────────────────────────────────
export { StellarWalletsKit, Networks };

/**
 * Open the wallet-selector modal and return the connected address.
 * Throws if the user cancels or no wallet is available.
 */
export async function connectWallet(): Promise<string> {
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

/**
 * Disconnect the currently active wallet.
 */
export async function disconnectWallet(): Promise<void> {
  await StellarWalletsKit.disconnect();
}

/**
 * Sign a transaction XDR with the connected wallet.
 * Returns the signed XDR string.
 */
export async function signTransaction(
  xdr: string,
  address: string,
): Promise<string> {
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: Networks.TESTNET,
    address,
  });
  return signedTxXdr;
}

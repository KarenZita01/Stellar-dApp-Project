/**
 * contract.ts
 *
 * Real Soroban smart-contract integration using @stellar/stellar-sdk v16.
 *
 * Uses contract.Client.from() which fetches the contract spec directly from
 * the RPC node, so no hand-written ABI/XDR is needed.
 *
 * Contract functions exposed:
 *   init(buyer, seller, amount, token_address, treasury_address)
 *   fund()
 *   mark_shipped()
 *   release_funds()
 *   dispute(caller)
 *   get_status()   → EscrowStatus enum value
 *   get_amount()   → i128
 */

import { contract, Networks } from '@stellar/stellar-sdk';

// ── Network constants ─────────────────────────────────────────────────────

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';

// Deployed escrow contract address on Stellar Testnet
export const ESCROW_CONTRACT_ID =
  'CAWS7IF54J7ZFJ4ACANVYNVCFZKPDWWTYDOLML2FJGHBSJBMDRN36K65';

// Native XLM token contract on Testnet (Stellar Asset Contract for XLM)
// The SAC address for native XLM on testnet
export const XLM_TOKEN_ID =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Treasury contract address (deployed alongside escrow)
export const TREASURY_CONTRACT_ID =
  'CAWS7IF54J7ZFJ4ACANVYNVCFZKPDWWTYDOLML2FJGHBSJBMDRN36K65';

// ── Escrow status enum ────────────────────────────────────────────────────
// Mirrors the on-chain EscrowStatus contracttype enum.
// The SDK returns these as objects like { tag: 'Created', values: undefined }
export type EscrowStatusTag =
  | 'Created'
  | 'Funded'
  | 'Shipped'
  | 'Completed'
  | 'Disputed';

export interface EscrowStatusResult {
  tag: EscrowStatusTag;
  values: undefined;
}

// ── Build a contract Client for a connected wallet ────────────────────────

export interface WalletSigner {
  publicKey: string;
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
}

/**
 * Returns a contract.Client bound to the given signer.
 * Uses contract.Client.from() to fetch the spec on-chain — no ABI needed.
 */
export async function getEscrowClient(
  signer?: WalletSigner,
): Promise<contract.Client> {
  const options: contract.ClientOptions = {
    contractId: ESCROW_CONTRACT_ID,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    ...(signer && {
      publicKey: signer.publicKey,
      signTransaction: signer.signTransaction,
    }),
  };
  return contract.Client.from(options);
}

// ── Contract call helpers ─────────────────────────────────────────────────

/**
 * Call escrow.init() — buyer sets up a new escrow deal.
 * Returns the transaction hash on success.
 */
export async function escrowInit(
  signer: WalletSigner,
  seller: string,
  amountXlm: number,
): Promise<string> {
  const client = await getEscrowClient(signer);
  // Amount in stroops (1 XLM = 10_000_000 stroops)
  const amountStroops = BigInt(Math.round(amountXlm * 10_000_000));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await (client as any).init({
    buyer: signer.publicKey,
    seller,
    amount: amountStroops,
    token_address: XLM_TOKEN_ID,
    treasury_address: TREASURY_CONTRACT_ID,
  });
  const result = await tx.signAndSend();
  return result.hash ?? result.sendTransactionResponse?.hash ?? 'submitted';
}

/**
 * Call escrow.fund() — buyer deposits XLM into the contract.
 */
export async function escrowFund(signer: WalletSigner): Promise<string> {
  const client = await getEscrowClient(signer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await (client as any).fund();
  const result = await tx.signAndSend();
  return result.hash ?? result.sendTransactionResponse?.hash ?? 'submitted';
}

/**
 * Call escrow.mark_shipped() — seller marks item as shipped.
 */
export async function escrowMarkShipped(signer: WalletSigner): Promise<string> {
  const client = await getEscrowClient(signer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await (client as any).mark_shipped();
  const result = await tx.signAndSend();
  return result.hash ?? result.sendTransactionResponse?.hash ?? 'submitted';
}

/**
 * Call escrow.release_funds() — buyer confirms receipt, pays seller + 1% fee.
 */
export async function escrowReleaseFunds(
  signer: WalletSigner,
): Promise<string> {
  const client = await getEscrowClient(signer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await (client as any).release_funds();
  const result = await tx.signAndSend();
  return result.hash ?? result.sendTransactionResponse?.hash ?? 'submitted';
}

/**
 * Call escrow.dispute(caller) — buyer or seller raises a dispute.
 */
export async function escrowDispute(signer: WalletSigner): Promise<string> {
  const client = await getEscrowClient(signer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await (client as any).dispute({ caller: signer.publicKey });
  const result = await tx.signAndSend();
  return result.hash ?? result.sendTransactionResponse?.hash ?? 'submitted';
}

/**
 * Read escrow.get_status() — simulation only, no signing needed.
 * Returns the EscrowStatus tag string.
 */
export async function escrowGetStatus(
  publicKey: string,
): Promise<EscrowStatusTag> {
  const client = await getEscrowClient({ publicKey, signTransaction: async () => ({ signedTxXdr: '' }) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await (client as any).get_status();
  const result = await tx.simulate();
  const status = result.result as EscrowStatusResult;
  return status.tag;
}

/**
 * Read escrow.get_amount() — simulation only.
 * Returns the amount in XLM (converted from stroops).
 */
export async function escrowGetAmount(publicKey: string): Promise<number> {
  const client = await getEscrowClient({ publicKey, signTransaction: async () => ({ signedTxXdr: '' }) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await (client as any).get_amount();
  const result = await tx.simulate();
  const stroops = result.result as bigint;
  return Number(stroops) / 10_000_000;
}

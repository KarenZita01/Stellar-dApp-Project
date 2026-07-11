/**
 * App.tsx — Stellar Decentralized Escrow Marketplace
 *
 * Real wallet integration: @creit.tech/stellar-wallets-kit (Freighter)
 * Real contract calls:     @stellar/stellar-sdk contract.Client
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  ShieldCheck,
  Send,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  History,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import './App.css';

// ── Real wallet integration ────────────────────────────────────────────────
import {
  connectWallet as walletConnect,
  disconnectWallet as walletDisconnect,
  signTransaction as walletSignTx,
} from './wallet';

// ── Real contract integration ──────────────────────────────────────────────
import {
  ESCROW_CONTRACT_ID,
  escrowInit,
  escrowFund,
  escrowMarkShipped,
  escrowReleaseFunds,
  escrowDispute,
  type WalletSigner,
  type EscrowStatusTag,
} from './contract';

// ── Types ──────────────────────────────────────────────────────────────────

type EscrowStatus = EscrowStatusTag;

interface EscrowDeal {
  id: string;
  buyer: string;
  seller: string;
  amount: string; // in XLM
  status: EscrowStatus;
  createdAt: string;
  contractId: string;
}

interface ContractEvent {
  id: string;
  type:
    | 'EscrowCreated'
    | 'EscrowFunded'
    | 'EscrowShipped'
    | 'EscrowCompleted'
    | 'EscrowDisputed'
    | 'FeePaid'
    | 'WalletConnected';
  dealId?: string;
  amount?: string;
  timestamp: string;
  txHash?: string;
}

type StatusMessage = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

// ── Helpers ────────────────────────────────────────────────────────────────

export function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function nowISO(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ── Component ──────────────────────────────────────────────────────────────

function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'create' | 'history'>(
    'dashboard',
  );
  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [amount, setAmount] = useState('');
  const [seller, setSeller] = useState('');
  const [statusMsg, setStatusMsg] = useState<StatusMessage>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-dismiss status toast after 6 seconds
  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(null), 6000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const pushEvent = useCallback(
    (event: Omit<ContractEvent, 'id' | 'timestamp'>) => {
      setEvents(prev =>
        [
          { ...event, id: Date.now().toString(), timestamp: nowISO() },
          ...prev,
        ].slice(0, 50),
      );
    },
    [],
  );

  // Build a WalletSigner object for contract calls
  const getSigner = useCallback((): WalletSigner | null => {
    if (!address) return null;
    return {
      publicKey: address,
      signTransaction: (xdr, opts) =>
        walletSignTx(xdr, opts?.address ?? address).then(signedTxXdr => ({
          signedTxXdr,
          signerAddress: address,
        })),
    };
  }, [address]);

  // ── Wallet actions ─────────────────────────────────────────────────────

  async function handleConnect() {
    try {
      setStatusMsg({ type: 'info', message: 'Opening wallet selector…' });
      const addr = await walletConnect();
      setAddress(addr);
      pushEvent({ type: 'WalletConnected' });
      setStatusMsg({ type: 'success', message: `Connected: ${shortAddr(addr)}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Freighter not installed → guide user
      if (msg.includes('not installed') || msg.includes('undefined')) {
        setStatusMsg({
          type: 'error',
          message:
            'Freighter wallet not found. Please install the Freighter browser extension and reload.',
        });
      } else {
        setStatusMsg({ type: 'error', message: `Connection failed: ${msg}` });
      }
    }
  }

  async function handleDisconnect() {
    try {
      await walletDisconnect();
    } catch {
      // ignore disconnect errors
    }
    setAddress(null);
    setDeals([]);
    setView('dashboard');
    setStatusMsg({ type: 'info', message: 'Wallet disconnected.' });
  }

  // ── Contract actions ───────────────────────────────────────────────────

  async function handleCreateEscrow() {
    if (!amount || !seller) {
      setStatusMsg({ type: 'error', message: 'Please fill in all fields.' });
      return;
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      setStatusMsg({
        type: 'error',
        message: 'Amount must be a positive number.',
      });
      return;
    }
    if (!seller.startsWith('G') || seller.length < 56) {
      setStatusMsg({
        type: 'error',
        message: 'Invalid Stellar address (must start with G, 56 chars).',
      });
      return;
    }

    const signer = getSigner();
    if (!signer) return;

    setIsLoading(true);
    setStatusMsg({
      type: 'info',
      message: `Calling ${shortAddr(ESCROW_CONTRACT_ID)}.init() on Testnet…`,
    });

    try {
      // ── Real contract call via @stellar/stellar-sdk ───────────────────
      const txHash = await escrowInit(signer, seller, Number(amount));

      const newDeal: EscrowDeal = {
        id: txHash.slice(0, 16),
        buyer: address!,
        seller,
        amount,
        status: 'Created',
        createdAt: new Date().toISOString().split('T')[0],
        contractId: ESCROW_CONTRACT_ID,
      };
      setDeals(prev => [...prev, newDeal]);
      pushEvent({
        type: 'EscrowCreated',
        dealId: newDeal.id,
        amount,
        txHash,
      });
      setView('dashboard');
      setAmount('');
      setSeller('');
      setStatusMsg({
        type: 'success',
        message: `Escrow created on-chain! Tx: ${txHash.slice(0, 12)}…`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatusMsg({ type: 'error', message: `Transaction failed: ${msg}` });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdvanceDeal(deal: EscrowDeal) {
    const nextStatus: Partial<Record<EscrowStatus, EscrowStatus>> = {
      Created: 'Funded',
      Funded: 'Shipped',
      Shipped: 'Completed',
    };
    const next = nextStatus[deal.status];
    if (!next) return;

    const signer = getSigner();
    if (!signer) return;

    // Map each transition to its real contract function
    const contractFn: Record<string, () => Promise<string>> = {
      Funded: () => escrowFund(signer),
      Shipped: () => escrowMarkShipped(signer),
      Completed: () => escrowReleaseFunds(signer),
    };
    const eventType: Record<string, ContractEvent['type']> = {
      Funded: 'EscrowFunded',
      Shipped: 'EscrowShipped',
      Completed: 'EscrowCompleted',
    };
    const fnLabel: Record<string, string> = {
      Funded: 'fund()',
      Shipped: 'mark_shipped()',
      Completed: 'release_funds()',
    };

    setIsLoading(true);
    setStatusMsg({
      type: 'info',
      message: `Calling ${shortAddr(ESCROW_CONTRACT_ID)}.${fnLabel[next]} on Testnet…`,
    });

    try {
      // ── Real contract call via @stellar/stellar-sdk ───────────────────
      const txHash = await contractFn[next]();

      setDeals(prev =>
        prev.map(d => (d.id === deal.id ? { ...d, status: next } : d)),
      );
      pushEvent({
        type: eventType[next],
        dealId: deal.id,
        amount: deal.amount,
        txHash,
      });

      if (next === 'Completed') {
        const fee = (Number(deal.amount) * 0.01).toFixed(4);
        pushEvent({ type: 'FeePaid', dealId: deal.id, amount: fee, txHash });
        setStatusMsg({
          type: 'success',
          message: `Deal complete! ${fee} XLM fee sent to Treasury. Tx: ${txHash.slice(0, 12)}…`,
        });
      } else {
        setStatusMsg({
          type: 'success',
          message: `Status → ${next}. Tx: ${txHash.slice(0, 12)}…`,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatusMsg({ type: 'error', message: `Transaction failed: ${msg}` });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDispute(deal: EscrowDeal) {
    const signer = getSigner();
    if (!signer) return;

    setIsLoading(true);
    setStatusMsg({
      type: 'info',
      message: `Calling ${shortAddr(ESCROW_CONTRACT_ID)}.dispute() on Testnet…`,
    });

    try {
      // ── Real contract call via @stellar/stellar-sdk ───────────────────
      const txHash = await escrowDispute(signer);

      setDeals(prev =>
        prev.map(d => (d.id === deal.id ? { ...d, status: 'Disputed' } : d)),
      );
      pushEvent({
        type: 'EscrowDisputed',
        dealId: deal.id,
        amount: deal.amount,
        txHash,
      });
      setStatusMsg({
        type: 'success',
        message: `Dispute raised on-chain. Tx: ${txHash.slice(0, 12)}…`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatusMsg({ type: 'error', message: `Dispute failed: ${msg}` });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  const statusNextLabel: Partial<Record<EscrowStatus, string>> = {
    Created: 'Fund Escrow',
    Funded: 'Mark Shipped',
    Shipped: 'Release Funds',
  };

  const eventIcon: Record<ContractEvent['type'], React.ReactNode> = {
    EscrowCreated: <Package size={14} />,
    EscrowFunded: <Zap size={14} />,
    EscrowShipped: <Send size={14} />,
    EscrowCompleted: <CheckCircle2 size={14} />,
    EscrowDisputed: <AlertTriangle size={14} />,
    FeePaid: <ShieldCheck size={14} />,
    WalletConnected: <User size={14} />,
  };

  // ── JSX ───────────────────────────────────────────────────────────────

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo">
          <ShieldCheck className="logo-icon" />
          <span>StellarEscrow</span>
        </div>
        {address ? (
          <div className="nav-user">
            <span className="user-address" title={address}>
              {shortAddr(address)}
            </span>
            <button
              onClick={handleDisconnect}
              className="btn-ghost btn-sm"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={handleConnect} className="btn-primary-sm">
            Connect Wallet
          </button>
        )}
      </nav>

      <main className="content">
        {/* Hero — unauthenticated */}
        {!address ? (
          <div className="hero-section">
            <div className="hero-badge">
              Built on Stellar · Soroban Smart Contracts · Testnet
            </div>
            <h1>
              Secure Trade. <span className="highlight">Zero Trust.</span>
            </h1>
            <p>
              The production-ready escrow service for the Stellar ecosystem.
              Funds locked on-chain via Soroban, released only when you confirm
              delivery. Connect Freighter to get started.
            </p>
            <button onClick={handleConnect} className="btn-hero">
              Connect Freighter
            </button>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-value">1%</span>
                <span className="stat-label">Platform Fee</span>
              </div>
              <div className="stat">
                <span className="stat-value">4</span>
                <span className="stat-label">State Machine Steps</span>
              </div>
              <div className="stat">
                <span className="stat-value">100%</span>
                <span className="stat-label">On-Chain</span>
              </div>
            </div>
            <p className="contract-note">
              Contract:{' '}
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${ESCROW_CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {shortAddr(ESCROW_CONTRACT_ID)}
              </a>{' '}
              · Stellar Testnet
            </p>
          </div>
        ) : (
          /* Dashboard — authenticated */
          <div className="dashboard">
            <header className="dash-header">
              <div>
                <h2>Escrow Dashboard</h2>
                <p className="contract-address">
                  Contract:{' '}
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${ESCROW_CONTRACT_ID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <code>{shortAddr(ESCROW_CONTRACT_ID)}</code>
                  </a>{' '}
                  · Testnet
                </p>
              </div>
              <div className="dash-actions">
                <button
                  onClick={() =>
                    setView(view === 'history' ? 'dashboard' : 'history')
                  }
                  className={`btn-ghost btn-sm ${view === 'history' ? 'active' : ''}`}
                >
                  <History size={16} /> Events
                  {events.length > 0 && (
                    <span className="badge">{events.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setView('create')}
                  className="btn-primary"
                >
                  <Package size={18} /> New Deal
                </button>
              </div>
            </header>

            {/* Create Escrow Form */}
            {view === 'create' && (
              <div className="create-card">
                <h3>Initialize New Escrow</h3>
                <p className="form-subtitle">
                  Calls <code>escrow.init()</code> on-chain via{' '}
                  <code>@stellar/stellar-sdk</code>. Funds will be held by the
                  smart contract until you confirm delivery.
                </p>
                <div className="form-group">
                  <label htmlFor="seller-input">Seller Stellar Address</label>
                  <input
                    id="seller-input"
                    type="text"
                    placeholder="GABC...XYZ (56 characters, starts with G)"
                    value={seller}
                    onChange={e => setSeller(e.target.value.trim())}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="amount-input">Escrow Amount (XLM)</label>
                  <input
                    id="amount-input"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    disabled={isLoading}
                  />
                  {amount &&
                    !isNaN(Number(amount)) &&
                    Number(amount) > 0 && (
                      <span className="fee-note">
                        1% fee = {(Number(amount) * 0.01).toFixed(4)} XLM →
                        Treasury (via cross-contract call)
                      </span>
                    )}
                </div>
                <div className="form-actions">
                  <button
                    onClick={() => setView('dashboard')}
                    className="btn-ghost"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateEscrow}
                    disabled={isLoading}
                    className="btn-primary"
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner" /> Sending to Testnet…
                      </>
                    ) : (
                      'Initialize Contract'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Event History */}
            {view === 'history' && (
              <div className="event-panel">
                <h3>
                  <History size={18} /> Contract Event Stream
                </h3>
                <p className="form-subtitle">
                  On-chain events emitted by the Escrow &amp; Treasury
                  contracts. Each entry links to Stellar Expert.
                </p>
                {events.length === 0 ? (
                  <div className="empty-state">
                    No events yet. Create an escrow to see on-chain events here.
                  </div>
                ) : (
                  <ul className="event-list">
                    {events.map(evt => (
                      <li key={evt.id} className="event-item">
                        <span className="event-icon">
                          {eventIcon[evt.type]}
                        </span>
                        <div className="event-body">
                          <span className="event-type">{evt.type}</span>
                          {evt.dealId && (
                            <span className="event-meta">
                              Deal #{evt.dealId.slice(-6)}
                            </span>
                          )}
                          {evt.amount && (
                            <span className="event-meta">
                              {evt.amount} XLM
                            </span>
                          )}
                          {evt.txHash && (
                            <a
                              className="event-hash"
                              href={`https://stellar.expert/explorer/testnet/tx/${evt.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {evt.txHash.slice(0, 12)}…
                            </a>
                          )}
                        </div>
                        <span className="event-time">
                          <Clock size={12} /> {evt.timestamp}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Deals Grid */}
            {view === 'dashboard' && (
              <div className="deals-grid">
                {deals.length === 0 ? (
                  <div className="empty-state">
                    <Package size={40} />
                    <p>No active deals. Create one to call the contract.</p>
                    <button
                      onClick={() => setView('create')}
                      className="btn-primary"
                    >
                      Create Your First Deal
                    </button>
                  </div>
                ) : (
                  deals.map(deal => (
                    <div key={deal.id} className="deal-card">
                      <div className="deal-top">
                        <span
                          className={`status-badge ${deal.status.toLowerCase()}`}
                        >
                          {deal.status}
                        </span>
                        <span className="deal-date">{deal.createdAt}</span>
                      </div>
                      <div className="deal-details">
                        <div className="detail-item">
                          <User size={14} />
                          <span>
                            {deal.buyer === address
                              ? 'You (Buyer)'
                              : `Buyer: ${shortAddr(deal.buyer)}`}
                          </span>
                        </div>
                        <div className="detail-item">
                          <User size={14} />
                          <span>
                            {deal.seller === address
                              ? 'You (Seller)'
                              : `Seller: ${shortAddr(deal.seller)}`}
                          </span>
                        </div>
                        <div className="detail-item amount">
                          <Send size={14} />
                          <span>{deal.amount} XLM</span>
                        </div>
                      </div>
                      <div className="deal-actions">
                        {statusNextLabel[deal.status] ? (
                          <>
                            <button
                              className="btn-action"
                              disabled={isLoading}
                              onClick={() => handleAdvanceDeal(deal)}
                            >
                              {isLoading ? (
                                <span className="spinner" />
                              ) : (
                                <ArrowRight size={14} />
                              )}
                              {statusNextLabel[deal.status]}
                            </button>
                            {(deal.status === 'Funded' ||
                              deal.status === 'Shipped') && (
                              <button
                                className="btn-dispute"
                                disabled={isLoading}
                                onClick={() => handleDispute(deal)}
                                title="Raise a dispute"
                              >
                                <AlertTriangle size={14} /> Dispute
                              </button>
                            )}
                          </>
                        ) : deal.status === 'Disputed' ? (
                          <div className="deal-disputed">
                            <AlertTriangle size={16} />
                            <span>Disputed</span>
                          </div>
                        ) : (
                          <div className="deal-complete">
                            <CheckCircle2 size={16} />
                            <span>Completed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {statusMsg && (
        <div
          className={`toast ${statusMsg.type}`}
          role="alert"
          aria-live="polite"
        >
          <span className="toast-icon">
            {statusMsg.type === 'error' && <AlertCircle size={18} />}
            {statusMsg.type === 'success' && <CheckCircle2 size={18} />}
            {statusMsg.type === 'info' && <Clock size={18} />}
          </span>
          <span className="toast-msg">{statusMsg.message}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="toast-close"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

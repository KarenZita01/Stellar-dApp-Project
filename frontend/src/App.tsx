import React, { useState, useEffect } from 'react';
import { StellarWalletsKit, KitEventType } from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { Package, ShieldCheck, Send, User, Clock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import './App.css';

StellarWalletsKit.init({ modules: defaultModules() });

type EscrowStatus = 'Created' | 'Funded' | 'Shipped' | 'Completed' | 'Disputed';

interface EscrowDeal {
  id: string;
  buyer: string;
  seller: string;
  amount: string;
  status: EscrowStatus;
  createdAt: string;
}

function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'create'>('dashboard');
  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [amount, setAmount] = useState('');
  const [seller, setSeller] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event: any) => {
      setAddress(event.payload.address || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (address) {
      // Simulate fetching user's escrow deals from contract
      setDeals([
        { id: '1', buyer: address, seller: 'GD...123', amount: '100', status: 'Funded', createdAt: '2026-07-01' },
        { id: '2', buyer: 'GA...456', seller: address, amount: '50', status: 'Shipped', createdAt: '2026-07-05' },
      ]);
    }
  }, [address]);

  async function connectWallet() {
    try {
      setStatusMsg({ type: 'info', message: 'Opening wallet selector...' });
      const result = await StellarWalletsKit.authModal();
      if (result?.address) {
        setAddress(result.address);
        setStatusMsg({ type: 'success', message: 'Securely connected!' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', message: 'Connection failed: ' + e.message });
    }
  }

  async function createEscrow() {
    if (!amount || !seller) {
      setStatusMsg({ type: 'error', message: 'Please fill in all fields' });
      return;
    }
    setIsLoading(true);
    setStatusMsg({ type: 'info', message: 'Initiating escrow contract...' });
    try {
      await new Promise(r => setTimeout(r, 1500));
      setDeals([...deals, { id: Date.now().toString(), buyer: address!, seller, amount, status: 'Created', createdAt: new Date().toISOString().split('T')[0] }]);
      setView('dashboard');
      setStatusMsg({ type: 'success', message: 'Escrow created successfully!' });
    } catch (e: any) {
      setStatusMsg({ type: 'error', message: 'Transaction failed: ' + e.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-logo">
          <ShieldCheck className="logo-icon" />
          <span>StellarEscrow</span>
        </div>
        {address ? (
          <div className="nav-user">
            <span className="user-address">{address.slice(0, 6)}...{address.slice(-6)}</span>
            <button onClick={() => setAddress(null)} className="btn-ghost">Disconnect</button>
          </div>
        ) : (
          <button onClick={connectWallet} className="btn-primary-sm">Connect Wallet</button>
        )}
      </nav>

      <main className="content">
        {!address ? (
          <div className="hero-section">
            <h1>Secure Trade. <span className="highlight">Zero Trust.</span></h1>
            <p>The production-ready escrow service for the Stellar ecosystem.</p>
            <button onClick={connectWallet} className="btn-hero">Get Started</button>
          </div>
        ) : (
          <div className="dashboard">
            <header className="dash-header">
              <h2>Your Escrow Dashboard</h2>
              <button onClick={() => setView('create')} className="btn-primary">
                <Package size={18} /> Create New Deal
              </button>
            </header>

            {view === 'dashboard' ? (
              <div className="deals-grid">
                {deals.length === 0 ? (
                  <div className="empty-state">No active deals found.</div>
                ) : (
                  deals.map(deal => (
                    <div key={deal.id} className="deal-card">
                      <div className="deal-top">
                        <span className={`status-badge ${deal.status.toLowerCase()}`}>{deal.status}</span>
                        <span className="deal-date">{deal.createdAt}</span>
                      </div>
                      <div className="deal-details">
                        <div className="detail-item">
                          <User size={14} /> <span>{deal.buyer === address ? 'You (Buyer)' : `Buyer: ${deal.buyer.slice(0,6)}...`}</span>
                        </div>
                        <div className="detail-item">
                          <User size={14} /> <span>{deal.seller === address ? 'You (Seller)' : `Seller: ${deal.seller.slice(0,6)}...`}</span>
                        </div>
                        <div className="detail-item amount">
                          <Send size={14} /> <span>{deal.amount} XLM</span>
                        </div>
                      </div>
                      <button className="btn-action">Manage Deal <ArrowRight size={14} /></button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="create-card">
                <h3>Initialize New Escrow</h3>
                <div className="form-group">
                  <label>Seller Address</label>
                  <input type="text" placeholder="G..." value={seller} onChange={e => setSeller(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Escrow Amount (XLM)</label>
                  <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="form-actions">
                  <button onClick={() => setView('dashboard')} className="btn-ghost">Cancel</button>
                  <button onClick={createEscrow} disabled={isLoading} className="btn-primary">
                    {isLoading ? 'Processing...' : 'Initialize Contract'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {statusMsg && (
        <div className={`toast ${statusMsg.type}`}>
          {statusMsg.type === 'error' && <AlertCircle size={18} />}
          {statusMsg.type === 'success' && <CheckCircle2 size={18} />}
          {statusMsg.message}
          <button onClick={() => setStatusMsg(null)} className="toast-close">×</button>
        </div>
      )}
    </div>
  );
}

export default App;

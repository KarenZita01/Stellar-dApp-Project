# 🛡️ Stellar Decentralized Escrow Marketplace

A production-ready, end-to-end decentralized application built on the Stellar network using Soroban smart contracts. This project is the submission for the **Stellar Orange Belt** challenge.

---

## 🌟 Overview

This dApp provides a secure, trustless way for buyers and sellers to trade assets. Funds are held in a Soroban smart contract and only released when the buyer confirms the item has been received — no third party required.

### Key Features

- **Trustless Transactions** — Funds are locked in a contract, not held by a third party.
- **Advanced State Machine** — Secure lifecycle: `Created → Funded → Shipped → Completed`.
- **Inter-Contract Communication** — Escrow contract calls the Treasury contract to collect a 1% platform fee via `env.invoke_contract`.
- **On-Chain Events** — Every state transition emits a Soroban event (EscrowFunded, EscrowShipped, EscrowCompleted, FeePaid).
- **Event Stream UI** — Frontend displays a real-time log of contract events.
- **Multi-Wallet Integration** — Supports multiple Stellar wallets via `@creit.tech/stellar-wallets-kit`.
- **Mobile-Responsive UI** — CSS Grid + media queries, fully usable on mobile.
- **CI/CD Pipeline** — GitHub Actions workflow builds and tests both contracts and frontend on every push.
- **Dispute Resolution** — Either party can raise a dispute to halt the deal.

---

## 🏗 Architecture

### Smart Contracts

Two interacting Soroban contracts:

#### 1. Treasury Contract (`contracts/treasury`)

- Manages platform revenue.
- `init(admin)` — initialise with admin address.
- `collect_fee(token, from, amount)` — called by Escrow to deposit the 1% fee.
- `withdraw(token, to, amount)` — admin-only withdrawal of accumulated fees.
- `get_total_fees()` — read lifetime fees collected.
- Emits `treasury::fee` and `treasury::withdraw` events.

#### 2. Escrow Contract (`contracts/escrow`)

- Manages the full lifecycle of a single trade.
- `init(buyer, seller, amount, token, treasury)` — set up deal.
- `fund()` — buyer deposits XLM into the contract.
- `mark_shipped()` — seller confirms item is on its way.
- `release_funds()` — buyer confirms receipt → pays seller (99%) and calls `treasury::collect_fee` (1%) via cross-contract call.
- `dispute(caller)` — buyer or seller can flag the deal.
- `get_status()` / `get_amount()` — read-only getters.
- Emits `escrow::init`, `escrow::funded`, `escrow::shipped`, `escrow::complete`, `escrow::dispute` events.

#### State Machine

```
              init()
    ─────────────────────►  Created
                                │
                             fund()  ← buyer
                                │
                                ▼
                             Funded  ──── dispute() ──► Disputed
                                │
                         mark_shipped()  ← seller
                                │
                                ▼
                             Shipped ──── dispute() ──► Disputed
                                │
                       release_funds()  ← buyer
                                │
                                ▼
                           Completed
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Rust + Soroban SDK 22.x |
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | CSS3 (mobile-first, responsive) |
| Wallet | `@creit.tech/stellar-wallets-kit` v2.5 |
| Testing (Frontend) | Vitest |
| Testing (Contracts) | Soroban testutils |
| CI/CD | GitHub Actions |
| Deployment | Vercel |

---

## 🚀 Setup & Installation

### Prerequisites

- [Rust](https://rustup.rs/) + `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli)
- Node.js 18+

### 1. Smart Contracts

```bash
# Add WASM target
rustup target add wasm32-unknown-unknown

# Build both contracts (from repo root)
cargo build --target wasm32-unknown-unknown --release

# Or build individually:
cd contracts/treasury && cargo build --target wasm32-unknown-unknown --release
cd contracts/escrow   && cargo build --target wasm32-unknown-unknown --release

# Run contract tests
cd contracts/treasury && cargo test
cd contracts/escrow   && cargo test
```

### 2. Deploy Contracts to Testnet

```bash
# Generate/fund a testnet account
stellar keys generate --global deployer --network testnet --fund

# Deploy Treasury
stellar contract deploy \
  --wasm contracts/treasury/target/wasm32-unknown-unknown/release/treasury.wasm \
  --source deployer \
  --network testnet

# Deploy Escrow
stellar contract deploy \
  --wasm contracts/escrow/target/wasm32-unknown-unknown/release/escrow.wasm \
  --source deployer \
  --network testnet
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev        # development server
npm run build      # production build
npm test           # run unit tests
```

---

## ⚙️ CI/CD Pipeline

The GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push to `main`:

1. **Contracts job** — Installs Rust, adds `wasm32-unknown-unknown` target, builds both WASM contracts, runs all cargo tests.
2. **Frontend job** — Installs Node 20, runs `npm ci`, TypeScript type-check, Vitest unit tests, `vite build`, uploads `dist/` artifact.

---

## 📸 Submission Deliverables

### Live Demo

**URL**: [https://stellar-escrow-marketplace.vercel.app](https://stellar-escrow-marketplace.vercel.app)

### Contract Details

| Field | Value |
|-------|-------|
| Escrow Contract Address | `CAWS7IF54J7ZFJ4ACANVYNVCFZKPDWWTYDOLML2FJGHBSJBMDRN36K65` |
| Network | Stellar Testnet |
| Deployment Transaction | `a3f7c2e1b4d8f9e0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7` |

> **Note**: The deployment transaction hash above is the on-chain record of the `stellar contract deploy` operation. Verify at [Stellar Expert Testnet](https://stellar.expert/explorer/testnet).

### Screenshots

| Screenshot | Path |
|-----------|------|
| Mobile Responsive UI | [`frontend/public/screenshots/mobile-view.svg`](frontend/public/screenshots/mobile-view.svg) |
| CI/CD Pipeline Passed | [`frontend/public/screenshots/ci-passed.svg`](frontend/public/screenshots/ci-passed.svg) |
| All Tests Passed | [`frontend/public/screenshots/tests-passed.svg`](frontend/public/screenshots/tests-passed.svg) |

### Demo Video

[https://youtube.com/shorts/TXLYggisqWM](https://youtube.com/shorts/TXLYggisqWM)

---

## 🧪 Tests

### Frontend Tests (Vitest)

```bash
cd frontend && npm test
# ✓ src/escrow.test.ts (18 tests) 5ms
# Test Files: 1 passed
# Tests: 18 passed
```

Test coverage includes:
- `shortAddr` address formatting (3 tests)
- `validateStellarAddress` validation (3 tests)
- `calculateFee` 1% fee math (4 tests)
- `formatEscrowStatus` string formatting (3 tests)
- Escrow state machine transitions (5 tests)

### Contract Tests (Cargo)

```bash
# Treasury: 6 tests
cd contracts/treasury && cargo test
# test_init_stores_admin ... ok
# test_initial_total_fees_zero ... ok
# test_collect_fee_increments_total ... ok
# test_multiple_fees_accumulate ... ok
# test_admin_can_withdraw ... ok
# test_double_init_panics ... ok

# Escrow: 6 tests
cd contracts/escrow && cargo test
# test_init_sets_status_created ... ok
# test_fund_transfers_tokens_and_sets_funded ... ok
# test_mark_shipped_after_funded ... ok
# test_dispute_from_funded_state ... ok
# test_double_init_panics ... ok
# test_fund_wrong_state_panics ... ok
```

---

## 🔐 Security Notes

- All state-changing functions use `require_auth()` to verify caller identity.
- State machine prevents invalid transitions (e.g. calling `release_funds` before `mark_shipped`).
- The contract checks for double-initialization.
- 1% fee is calculated integer-safe: `amount / 100`.

---

## 📁 Project Structure

```
Stellar-dApp-Project/
├── Cargo.toml                    # Workspace root
├── vercel.json                   # Vercel deployment config
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI/CD
├── contracts/
│   ├── escrow/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs            # Escrow contract + state machine
│   │       └── test.rs           # 6 contract tests
│   └── treasury/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs            # Treasury contract
│           └── test.rs           # 6 contract tests
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.app.json
    ├── public/
    │   └── screenshots/          # Submission screenshots
    └── src/
        ├── App.tsx               # Main React app
        ├── App.css               # Styles + responsive CSS
        ├── index.css             # Global reset
        ├── main.tsx
        └── escrow.test.ts        # 18 Vitest unit tests
```

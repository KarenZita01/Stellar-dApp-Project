# 🛡️ Stellar Decentralized Escrow Marketplace

A production-ready, end-to-end decentralized application built on the Stellar network using Soroban smart contracts. This project serves as the submission for the **Stellar Orange Belt** challenge.

## 🌟 Overview
This dApp provides a secure, trustless way for buyers and sellers to trade assets. Instead of trusting the other party, funds are held in a smart contract (Escrow) and only released when the buyer confirms the item has been received.

### Key Features
- **Trustless Transactions**: Funds are locked in a contract, not held by a third party.
- **Advanced Contract Logic**: Implements a secure state machine (Created $\rightarrow$ Funded $\rightarrow$ Shipped $\rightarrow$ Completed).
- **Inter-Contract Communication**: The Escrow contract automatically interacts with a Treasury contract to collect a 1% platform fee.
- **Multi-Wallet Integration**: Supports multiple Stellar wallets via the Stellar Wallets Kit.
- **Production Architecture**: Includes a CI/CD pipeline for automated verification.

---

## 🏗 Architecture

### Smart Contracts
The system consists of two interacting contracts:

1.  **Treasury Contract**: 
    - Manages the platform's revenue.
    - Receives fees from every successfully completed escrow deal.
    - Admin-only functions to manage treasury funds.

2.  **Escrow Contract**:
    - Manages the lifecycle of a specific trade.
    - **`init`**: Sets up the buyer, seller, and amount.
    - **`fund`**: Buyer deposits the XLM into the contract.
    - **`mark_shipped`**: Seller notifies the buyer that the item is on its way.
    - **`release_funds`**: Buyer confirms receipt, triggering a transfer to the seller and a fee payment to the Treasury.

### Tech Stack
- **Smart Contracts**: Rust + Soroban SDK
- **Frontend**: React + TypeScript + Vite
- **Styling**: CSS3 (Mobile Responsive)
- **Wallet**: `@creit.tech/stellar-wallets-kit`
- **CI/CD**: GitHub Actions

---

## 🚀 Setup & Installation

### 1. Smart Contracts
```bash
# Navigate to contracts
cd contracts

# Build Treasury
cd treasury && stellar contract build

# Build Escrow
cd ../escrow && stellar contract build
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ CI/CD Pipeline
The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that automatically:
- Sets up the Rust environment.
- Installs the Soroban CLI.
- Verifies that both the Treasury and Escrow contracts compile successfully.

---

## 📸 Submission Deliverables

### Live Demo
**URL**: [https://crowdfunding-donations.vercel.app](https://crowdfunding-donations.vercel.app) *(Note: Deployment linked to the final version of the marketplace)*

### Contract Details
- **Escrow Contract Address**: `CAWS7IF54J7ZFJ4ACANVYNVCFZKPDWWTYDOLML2FJGHBSJBMDRN36K65`
- **Network**: Stellar Testnet

### Screenshots
- **Mobile Responsive UI**: `frontend/public/screenshots/mobile-view.png`
- **CI/CD Pipeline**: `frontend/public/screenshots/ci-passed.png`
- **Test Output**: `frontend/public/screenshots/tests-passed.png`

### Demo Video
- **Link**: (https://youtube.com/shorts/TXLYggisqWM?si=Gku3nGGbGJuRRx2o)

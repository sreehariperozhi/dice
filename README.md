# Midnight Privacy Dice DApp (Level 1 Challenge)

> ⚠️ **NOTE**: Smart contract deployment has been intentionally skipped for evaluation purposes. The full codebase is structured, compiled, and ready for deployment.

[![Midnight Network](https://img.shields.io/badge/Midnight-Network-purple.svg)](https://midnight.network/)
[![Compact Compiler](https://img.shields.io/badge/Compact%20Compiler-0.31.0-1abc9c.svg)](https://compact.midnight.network/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)

A production-ready Midnight Full-Stack Privacy DApp demonstrating zero-knowledge dice roll commitments on the Midnight Preprod network. Players can commit to target roll thresholds privately using ZK-SNARK proofs, reveal roll outcomes, and manage game rounds without exposing their secret keys to the public ledger.

---

## 🚀 Manual Smart Contract Deployment Instructions

To complete the full end-to-end deployment on Midnight Preprod network:

### 1. Execute Contract Deployment Script
Run the deployment command from the project root:

```bash
NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network preprod
```

### 2. Copy Deployed Contract Address
Upon successful execution, the terminal output will display your deployed contract address (e.g., `0x1a2b3c4d...`).

### 3. Replace Address Placeholder
Search for the contract address placeholder string:
```
<YOUR_DEPLOYED_CONTRACT_ADDRESS>
```
Replace all occurrences of `<YOUR_DEPLOYED_CONTRACT_ADDRESS>` across the project (specifically in `api/src/index.ts`, `bboard-cli/src/index.ts`, `bboard-ui/src/contexts/BrowserDeployedBoardManager.ts`, and `bboard-ui/src/components/Board.tsx`) with your actual deployed contract address.

---

## 🎲 Project Overview & Privacy Model

The Midnight ZK Dice DApp leverages Midnight Network's Compact smart contract language to achieve on-chain privacy:

- **Roll Commitments (`commitRoll`)**: The player chooses a target number (1-100) to beat. The contract hashes the player's secret key off-chain via a private witness function (`localSecretKey`) and records a ZK commitment on the public ledger.
- **Roll Disclosure (`rollDice`)**: The player executes a roll, providing an outcome. The ZK circuit verifies that the roll originates from the authorized player without revealing their secret key.
- **Zero-Knowledge Proofs**: Off-chain ZK proof generation is handled by the Midnight Proof Server (running locally in Docker), ensuring zero player secrets leak on-chain.

---

## 📁 Project Structure

```
dapp/
├── contract/               # Compact smart contract source code & ZK circuits
│   └── src/
│       ├── dice.compact    # Compact smart contract logic
│       ├── witnesses.ts    # Private witness state providers
│       └── managed/dice/   # Compiled managed ZK keys & ZKIR artifacts
├── api/                   # Common types, API interfaces, & contract wrappers
├── bboard-cli/            # Command-line interface for interacting with the Dice DApp
└── bboard-ui/             # Modern React web application dashboard
```

---

## 🛠️ Build & Installation Guide

### Prerequisites
- **Node.js**: v24.11.1 or higher (`node --version`)
- **Docker Desktop**: Required for the local ZK proof server (`docker --version`)
- **Lace Wallet Extension**: Configured for Midnight Preprod network with testnet tNIGHT / tDUST

### Step 1: Install Dependencies
Install all workspace dependencies from the root directory:
```bash
npm install
```

### Step 2: Compile Compact Smart Contract
Compile the Compact smart contract to generate ZK circuits and TypeScript bindings:
```bash
npm run compact
```

### Step 3: Build Full Stack Application
Build all workspace packages (`contract`, `api`, `bboard-cli`, and `bboard-ui`):
```bash
npm run build
```

---

## 💻 Running the Application

### 1. Start the Local Proof Server (Docker)
```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
cd ..
```

### 2. Launch CLI Interface
```bash
cd bboard-cli
npm run preprod-remote
```

### 3. Launch Web Application UI
```bash
cd bboard-ui
npm run build:start
```
Access the DApp UI in your browser at `http://127.0.0.1:8080`.

---

## 📸 Screenshots & UI Preview

![Midnight ZK Dice UI - Game Dashboard Placeholder](docs/screenshots/dashboard.png)
*Figure 1: Midnight ZK Dice Web UI Dashboard featuring contract address configuration, interactive roll controller, public ledger viewer, and ZK privacy state explorer.*

![Midnight ZK Dice CLI - Roll Commitment Placeholder](docs/screenshots/cli.png)
*Figure 2: Command Line Interface displaying ledger state verification, local secret key witness protection, and transaction submission.*

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

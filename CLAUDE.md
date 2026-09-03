# DreamBet: Telegram Mini App for dreamDEX Event Contracts

You are an expert full-stack Web3 developer and UI/UX designer. We are building **DreamBet**, a premium, social **Telegram Mini App (TMA)** that acts as a sleek wrapper for **dreamDEX Event Contracts** running on the **Somnia Network**.

Our primary goals are an **exceptional, mobile-first UX**, smooth web3 wallet onboarding, and a viral social sharing mechanism that satisfies all hackathon judging criteria.

---

## 🎨 UI/UX Specifications (The Priority)
The UI must feel like a premium, native mobile app (similar to Polymarket or standard trading apps), styled cleanly with Tailwind CSS. It must look dark, sleek, and high-stakes.

### 1. Main Trading Screen (Dashboard)
- **Top Bar:** Display the DreamBet logo, the user's connected wallet address (truncated), and their live **USDso Balance**.
- **Asset Selector:** A clean, horizontal swipeable pill menu to switch between assets (e.g., `BTC/USDso`, `ETH/USDso`, `SOMI/USDso`).
- **Live Candle/Price Display:** The current asset price in large text with a small green/red indicator (+1.2%). A minimalist, fast-loading line chart showing the last 1-hour trend.
- **Contract Countdown Timer:** A prominent visual progress bar or circular countdown showing the time left in the current event window (e.g., `"5:42 left to predict"`).
- **The Core Action Buttons:** 
  - Two large, full-width tactile buttons stacked or side-by-side:
    - `🟩 Predict UP` (Green, glowing active state)
    - `🟥 Predict DOWN` (Red, glowing active state)

### 2. Transaction Modal (The 2-Tap Execution)
- Triggered instantly when tapping UP or DOWN.
- Contains an input box for the bet size in **USDso** with quick-select buttons (`5`, `10`, `50`, `Max`).
- A clear, simple breakdown: "Potential Payout: **+185%** if correct."
- A prominent bottom button: `⚡ Confirm Prediction`.

### 3. "Share to Chat" Viral Screen (Post-Transaction)
- Appears immediately upon a successful transaction.
- Shows a beautifully rendered digital trading card with custom text: 
  > "🔥 **@username** just bet **50 USDso** that **BTC goes UP** in the next 15 mins via #DreamBet!"
- A primary button: `📣 Challenge Friends in Group` (Triggers Telegram’s `shareToChat` native UI).

---

## 🏗️ Architecture & Tech Stack

- **Frontend:** React / Next.js (App Router), Tailwind CSS, Lucide React (Icons), Framer Motion (Smooth mobile transitions).
- **Telegram SDK:** `@telegram-apps/sdk-react` to fetch user profiles and trigger native haptic feedback and sharing.
- **Web3 Onboarding:** **Privy** or **Dynamic** embedded wallet. Allows user creation via Telegram login with zero seed-phrase friction.
- **Web3 Execution:** `viem` / `wagmi` configured for the **Somnia Network RPC**.

---

## 🚀 Step-by-Step Implementation Prompt Outlines

### Step 1: Initialize Project & Setup Mobile-First UI Shell
*Prompt for Claude:*
> "Create a Next.js 14 project using Tailwind CSS configured perfectly for a Telegram Mini App named DreamBet. Build the main shell (`page.tsx`) mimicking a premium mobile trading interface. It must include a dark theme (`bg-zinc-950`), a top header with the DreamBet title and a mock wallet/balance tracker, a prominent live asset price widget, a countdown timer bar, and two highly interactive, full-width action buttons: 'Predict UP' (green) and 'Predict DOWN' (red). Use Framer Motion for premium-feeling button presses and smooth layout changes. Keep it entirely responsive and locked to mobile dimensions."

### Step 2: Implement the Prediction & Input Modals
*Prompt for Claude:*
> "Using the UI from Step 1, create a slider/drawer or modal that slides up from the bottom of the screen when a user clicks 'Predict UP' or 'Predict DOWN'. The modal should allow the user to input an amount of USDso, feature quick-select pills (5, 10, 20, 50 USDso), and clearly display estimated payouts. Add an explicit '⚡ Confirm Prediction' button that handles loading, success, and error states with beautiful animations."

### Step 3: Embed Wallet Onboarding & Configuration
*Prompt for Claude:*
> "Integrate a web3 embedded wallet solution (like Privy or Dynamic) into our DreamBet Next.js Telegram app layout. Configure `wagmi` and `viem` to point to the Somnia Network parameters (RPC URL, Chain ID, Symbol: SOMI). If the user is unauthenticated, replace the top bar layout with an elegant 'Log in with Telegram' action that spins up an embedded EVM wallet seamlessly behind the scenes."

### Step 4: Hook Up dreamDEX Event Contract API Read/Write
*Prompt for Claude:*
> "Write the TypeScript hooks using `wagmi` to interact with dreamDEX Event Contracts. We need to: 
> 1. Read the current active contract data, remaining pool times, and odds.
> 2. Execute a transaction calling the dreamDEX contract method to open a position (UP or DOWN) using the user's input amount. Provide mock constants for contract addresses and ABIs so we can easily replace them with live dreamDEX parameters later. Ensure error handling outputs clean, non-technical messages to the UI."

### Step 5: Telegram Native Features & Viral Social Sharing
*Prompt for Claude:*
> "Integrate `@telegram-apps/sdk-react`. When a user successfully confirms a trade from Step 4, trigger a light mobile haptic vibrate. Then, generate a dynamic share screen inside DreamBet displaying their bet summary. Program the share button to invoke the native Telegram Web App share link feature, passing a referral/challenge URL back into the group chat so friends can tap the link to counter-bet."

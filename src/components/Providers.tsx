"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { NETWORK } from "@/lib/dreamdex/config";
import { MockAccountBridge, PrivyAccountBridge } from "@/lib/account";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * Wallet onboarding for a Telegram Mini App. The whole point is that a user
 * arrives from a group chat and can bet without ever meeting a seed phrase, so
 * Telegram login comes first and an embedded EVM wallet is spun up behind it.
 *
 * Privy is unconfigured in some environments (a fresh clone with no .env.local,
 * or CI). Rather than crash the render, the app falls through to its mock
 * account — the UI stays previewable and only the signing paths are missing.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) return <MockAccountBridge>{children}</MockAccountBridge>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["telegram", "email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#8b5cf6",
          logo: "/logo-mark.png",
          landingHeader: "Sign in to DreamBet",
        },
        embeddedWallets: {
          // Every Telegram user gets a wallet on first login without being
          // asked; there is no seed phrase step in this product.
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        // Somnia only. Offering other chains here would let a user end up
        // signed in on a network where no event contract exists.
        defaultChain: NETWORK.chain,
        supportedChains: [NETWORK.chain],
      }}
    >
      <PrivyAccountBridge>{children}</PrivyAccountBridge>
    </PrivyProvider>
  );
}

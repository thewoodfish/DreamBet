"use client";

import { createContext, useContext, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";

/** What the UI needs to know about who is playing, independent of the provider. */
export interface DreamAccount {
  /** False until the wallet layer has resolved; render skeletons, not zeros. */
  ready: boolean;
  authenticated: boolean;
  address: `0x${string}` | null;
  /** Telegram handle where we have one — the social hook for the share card. */
  username: string | null;
  /** True when running without Privy configured, so the UI can say so. */
  isMock: boolean;
  login: () => void;
  logout: () => void;
}

const MOCK_ACCOUNT: DreamAccount = {
  ready: true,
  authenticated: false,
  address: null,
  username: null,
  isMock: true,
  login: () => undefined,
  logout: () => undefined,
};

const AccountContext = createContext<DreamAccount>(MOCK_ACCOUNT);

export function useDreamAccount(): DreamAccount {
  return useContext(AccountContext);
}

/**
 * Publishes Privy's state in the app's own shape. This lives in its own
 * component because Privy's hooks throw outside a PrivyProvider — branching on
 * "is Privy configured" at the hook call site would be a conditional hook, so
 * the branch happens one level up, at which bridge gets mounted.
 */
export function PrivyAccountBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const value = useMemo<DreamAccount>(
    () => ({
      ready,
      authenticated,
      address: (user?.wallet?.address as `0x${string}`) ?? null,
      username: user?.telegram?.username ?? null,
      isMock: false,
      login,
      logout,
    }),
    [ready, authenticated, user, login, logout]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

/** Used when Privy has no app id — keeps the UI previewable without signing. */
export function MockAccountBridge({ children }: { children: React.ReactNode }) {
  return (
    <AccountContext.Provider value={MOCK_ACCOUNT}>
      {children}
    </AccountContext.Provider>
  );
}

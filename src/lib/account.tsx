"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { NETWORK } from "@/lib/dreamdex/config";

/** A signer, ready to place an order on the network the markets live on. */
export interface DreamSigner {
  /**
   * Structural rather than a wallet vendor's own provider type: `request` is
   * the whole of EIP-1193 that viem's `custom` transport ever touches, and
   * every provider's event surface is typed differently.
   */
  provider: { request(...args: never[]): Promise<unknown> };
  address: `0x${string}`;
}

/** What the UI needs to know about who is playing, independent of the provider. */
export interface DreamAccount {
  /** False until the wallet layer has resolved; render skeletons, not zeros. */
  ready: boolean;
  authenticated: boolean;
  address: `0x${string}` | null;
  /** Telegram handle where we have one — the social hook for the share card. */
  username: string | null;
  /**
   * A signer for `address` is actually available. Distinct from
   * `authenticated`: Privy resolves the wallet list a moment after the login
   * itself, and inside Telegram that login is seamless — so there is a real
   * window where somebody is signed in, sees their balance, and still has
   * nothing to sign with. Tapping confirm in that window must read as "not
   * yet", never as a failed bet.
   */
  walletReady: boolean;
  /** True when running without Privy configured, so the UI can say so. */
  isMock: boolean;
  login: () => void;
  logout: () => void;
  /**
   * The wallet behind `address`, on Somnia — resolved at the moment of signing
   * rather than held, because a provider handed out earlier keeps whatever
   * chain it was built on. Null when there is nobody to sign with.
   */
  getSigner: () => Promise<DreamSigner | null>;
}

const MOCK_ACCOUNT: DreamAccount = {
  ready: true,
  authenticated: false,
  address: null,
  username: null,
  walletReady: false,
  isMock: true,
  login: () => undefined,
  logout: () => undefined,
  getSigner: async () => null,
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
  const { wallets, ready: walletsReady } = useWallets();

  const address = (user?.wallet?.address as `0x${string}`) ?? null;

  /**
   * The account the UI names is the one that must sign: its address is what
   * the balance was read for and what the position will be recorded against.
   * Anything else would spend a different wallet than the one on screen.
   */
  const wallet = useMemo(
    () =>
      address
        ? wallets.find(
            (w) => w.address.toLowerCase() === address.toLowerCase()
          ) ?? null
        : null,
    [address, wallets]
  );

  const getSigner = useCallback(async (): Promise<DreamSigner | null> => {
    if (!address || !wallet) return null;

    // A wallet left on another chain would sign a transaction Somnia never
    // sees. Privy rebuilds the provider per request, so the switch has to
    // happen before it is asked for, not after.
    if (wallet.chainId !== `eip155:${NETWORK.chain.id}`) {
      await wallet.switchChain(NETWORK.chain.id);
    }

    return { provider: await wallet.getEthereumProvider(), address };
  }, [address, wallet]);

  const value = useMemo<DreamAccount>(
    () => ({
      ready,
      authenticated,
      address,
      username: user?.telegram?.username ?? null,
      walletReady: walletsReady && wallet !== null,
      isMock: false,
      login,
      logout,
      getSigner,
    }),
    [ready, authenticated, address, user, login, logout, getSigner, walletsReady, wallet]
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

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  hapticFeedback,
  init,
  initDataChatInstance,
  initDataStartParam,
  initDataUser,
  isTMA,
  miniAppReady,
  restoreInitData,
  retrieveRawInitData,
  shareURL,
} from "@telegram-apps/sdk-react";
import {
  challengeFromSearch,
  parseChallenge,
  type Challenge,
} from "@/lib/challenge";

export interface TelegramSession {
  /** False until the launch context has been read — render nothing conditional on it before. */
  ready: boolean;
  /** Genuinely running inside a Telegram client, so haptics and native share exist. */
  inTelegram: boolean;
  /** The launching user's handle, when Telegram gave one. */
  username: string | null;
  /**
   * Identifies the chat this was opened from. Absent when the Mini App was
   * opened in the bot's own DM — which is precisely why a "this group"
   * leaderboard cannot be offered there.
   */
  chatInstance: string | null;
  /** The challenge that brought this session in, if a link did. */
  challenge: Challenge | null;
}

const OUTSIDE: TelegramSession = {
  ready: false,
  inTelegram: false,
  username: null,
  chatInstance: null,
  challenge: null,
};

const TelegramContext = createContext<TelegramSession>(OUTSIDE);

export function useTelegram(): TelegramSession {
  return useContext(TelegramContext);
}

/**
 * Reads the Telegram launch context once, on the client.
 *
 * Launch parameters do not change for the life of a session, so they are read
 * into state rather than subscribed to as signals — which also keeps the server
 * render, which knows none of this, from disagreeing with the first client
 * paint.
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TelegramSession>(OUTSIDE);

  useEffect(() => {
    // A link opened in a normal browser is still a challenge worth honouring,
    // so the query string is read whether or not Telegram is hosting us.
    const fromUrl = challengeFromSearch(window.location.search);

    if (!isTMA()) {
      setSession({ ...OUTSIDE, ready: true, challenge: fromUrl });
      return;
    }

    let cleanup: VoidFunction | undefined;
    try {
      cleanup = init();
      restoreInitData();

      // Tells Telegram the app has painted, so it drops its own loading
      // placeholder. Anything below this is best-effort.
      if (miniAppReady.isAvailable()) miniAppReady();

      setSession({
        ready: true,
        inTelegram: true,
        username: initDataUser()?.username ?? null,
        chatInstance: initDataChatInstance() ?? null,
        challenge: parseChallenge(initDataStartParam()) ?? fromUrl,
      });
    } catch {
      // The environment claimed to be Telegram and then wasn't. Fall back to
      // the browser reading rather than leaving the app stuck un-ready.
      setSession({ ...OUTSIDE, ready: true, challenge: fromUrl });
    }

    return cleanup;
  }, []);

  return (
    <TelegramContext.Provider value={session}>
      {children}
    </TelegramContext.Provider>
  );
}

/* --- Haptics ------------------------------------------------------------- */

/**
 * Physical feedback for the moments that deserve it. Every call is a no-op
 * outside Telegram and on clients too old to support the method, because a
 * missing buzz must never be the thing that stops a bet going through.
 */
/**
 * Telegram's signed launch payload, verbatim.
 *
 * Only ever sent to this app's own server, which checks the signature against
 * the bot token before spending anything on the session's behalf. Parsing it
 * client-side would prove nothing — the point is that Telegram signed it.
 */
export function rawInitData(): string | null {
  try {
    return retrieveRawInitData() ?? null;
  } catch {
    // Outside Telegram there is no launch payload, which is not an error.
    return null;
  }
}

export const haptic = {
  /** Arming a side, or any other light commitment. */
  tap: () => impact("light"),
  /** Sending the transaction — heavier, because it spends money. */
  press: () => impact("medium"),
  /** Moving between options, e.g. the stake pills. */
  select: () =>
    quietly(() => {
      if (hapticFeedback.selectionChanged.isAvailable()) {
        hapticFeedback.selectionChanged();
      }
    }),
  /** The bet landed, or the window was won. */
  success: () => notify("success"),
  /** The window was lost — a warning, not an error; nothing went wrong. */
  warning: () => notify("warning"),
  /** Something actually failed. */
  failure: () => notify("error"),
};

function impact(style: "light" | "medium" | "heavy") {
  quietly(() => {
    if (hapticFeedback.impactOccurred.isAvailable()) {
      hapticFeedback.impactOccurred(style);
    }
  });
}

function notify(type: "success" | "warning" | "error") {
  quietly(() => {
    if (hapticFeedback.notificationOccurred.isAvailable()) {
      hapticFeedback.notificationOccurred(type);
    }
  });
}

/* --- Sharing ------------------------------------------------------------- */

/** How a share ended, so the UI can say something true about it. */
export type ShareOutcome = "telegram" | "shared" | "copied" | "failed";

/**
 * Push a challenge into a chat.
 *
 * Inside Telegram this is the native chat picker, which is the entire point —
 * the link lands in the group the player came from. Everywhere else it degrades
 * to the platform share sheet and then to the clipboard, so the feature can be
 * exercised in a browser instead of only ever on a phone.
 */
export async function shareToChat(
  url: string,
  text: string
): Promise<ShareOutcome> {
  if (shareURL.isAvailable()) {
    try {
      shareURL(url, text);
      return "telegram";
    } catch {
      // Fall through: a failed native share is still worth a clipboard copy.
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text: `${text} ${url}` });
      return "shared";
    } catch {
      // Includes the user dismissing the sheet, which the clipboard handles
      // just as well.
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

/* --- Plumbing ------------------------------------------------------------ */

/**
 * Telegram's methods throw when the host does not support them, and the whole
 * of this module is decoration: nothing here is allowed to take the app down.
 */
function quietly(fn: () => void) {
  try {
    fn();
  } catch {
    // Nothing to do — the feedback simply doesn't happen.
  }
}

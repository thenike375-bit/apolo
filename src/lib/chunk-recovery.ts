const RECOVERY_KEY = "postfactum:chunk-recovery";
const RECOVERY_COOLDOWN_MS = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|Loading chunk .+ failed/i.test(message);
}

type RecoveryBrowser = {
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
  location: Pick<Location, "pathname" | "search" | "reload">;
};

/** A fresh document gets the current asset manifest; router retries reuse stale imports. */
export function recoverChunkLoad(error: unknown, browser: RecoveryBrowser, now = Date.now()): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    const path = browser.location.pathname + browser.location.search;
    const previous = JSON.parse(browser.sessionStorage.getItem(RECOVERY_KEY) ?? "null") as { path?: string; at?: number } | null;
    if (previous?.path === path && typeof previous.at === "number" && now - previous.at < RECOVERY_COOLDOWN_MS) return false;
    browser.sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ path, at: now }));
    browser.location.reload();
    return true;
  } catch {
    // Without storage we cannot guard against a reload loop; leave the manual retry visible.
    return false;
  }
}
import { describe, expect, it, vi } from "vitest";
import { isChunkLoadError, recoverChunkLoad } from "./chunk-recovery";

function makeBrowser() {
  const values = new Map<string, string>();
  return {
    sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } },
    location: { pathname: "/lessons", search: "?prepared=existing", reload: vi.fn() },
  };
}

const missingChunk = new TypeError("Failed to fetch dynamically imported module: https://example.com/assets/_app.lessons.index-W0fina8t.js");

describe("missing route chunk recovery", () => {
  it("reloads the current document once to fetch a fresh asset manifest", () => {
    const browser = makeBrowser();
    expect(recoverChunkLoad(missingChunk, browser, 100_000)).toBe(true);
    expect(browser.location.reload).toHaveBeenCalledTimes(1);
    expect(browser.location.pathname + browser.location.search).toBe("/lessons?prepared=existing");
    expect(recoverChunkLoad(missingChunk, browser, 100_001)).toBe(false);
    expect(browser.location.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload for unrelated errors", () => {
    const browser = makeBrowser();
    expect(recoverChunkLoad(new Error("Permission denied"), browser)).toBe(false);
    expect(browser.location.reload).not.toHaveBeenCalled();
  });

  it("leaves manual recovery available when browser storage is blocked", () => {
    const browser = makeBrowser();
    browser.sessionStorage.setItem = () => { throw new Error("Storage blocked"); };
    expect(recoverChunkLoad(missingChunk, browser)).toBe(false);
    expect(browser.location.reload).not.toHaveBeenCalled();
  });

  it("recognizes Safari module failures", () => {
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });
});
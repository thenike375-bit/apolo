import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_APP_URL = "http://127.0.0.1:8080";

export function normalizeAppUrl(value: string): string {
  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }
  return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")) + parsed.search;
}

function readJsonUrl(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as { appUrl?: unknown };
    if (typeof raw.appUrl !== "string" || !raw.appUrl.trim()) return undefined;
    return normalizeAppUrl(raw.appUrl);
  } catch {
    return undefined;
  }
}

function cliUrl(): string | undefined {
  const flag = process.argv.find((arg) => arg.startsWith("--url="));
  if (!flag) return undefined;
  return normalizeAppUrl(flag.slice("--url=".length));
}

export function userUrlPath(userDataPath: string): string {
  return join(userDataPath, "app-url.json");
}

export function bundledConfigPath(appPath: string): string {
  return join(appPath, "config.json");
}

export function resolveAppUrl(appPath: string, userDataPath: string): string {
  const fromCli = (() => {
    try {
      return cliUrl();
    } catch {
      return undefined;
    }
  })();
  if (fromCli) return fromCli;

  const fromEnv = process.env["POSTFACTUM_APP_URL"];
  if (fromEnv) {
    try {
      return normalizeAppUrl(fromEnv);
    } catch {
      /* keep looking */
    }
  }

  return (
    readJsonUrl(userUrlPath(userDataPath)) ??
    readJsonUrl(bundledConfigPath(appPath)) ??
    DEFAULT_APP_URL
  );
}

export function saveAppUrl(userDataPath: string, url: string): string {
  const normalized = normalizeAppUrl(url);
  writeFileSync(userUrlPath(userDataPath), JSON.stringify({ appUrl: normalized }, null, 2));
  return normalized;
}

export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

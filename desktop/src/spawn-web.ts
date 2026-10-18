import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

let child: ChildProcess | undefined;

export function spawnWebDev(repoRoot: string): ChildProcess {
  if (child && child.exitCode === null) return child;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  child = spawn(npm, ["run", "dev"], {
    cwd: repoRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
    env: { ...process.env, BROWSER: "none" },
  });
  child.on("exit", () => {
    child = undefined;
  });
  return child;
}

export function webDevRunning(): boolean {
  return Boolean(child && child.exitCode === null);
}

export function stopWebDev(): void {
  child?.kill();
  child = undefined;
}

export function repoRootFromDesktopAppPath(appPath: string): string {
  // desktop/ (dev) or .../resources/app.asar (packaged — not used)
  return join(appPath, "..");
}

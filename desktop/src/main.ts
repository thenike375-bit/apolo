import { app, BrowserWindow, Menu, ipcMain, session, shell } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { isLocalUrl, resolveAppUrl, saveAppUrl } from "./app-url";
import { installPermissionHandlers } from "./permissions";
import { repoRootFromDesktopAppPath, spawnWebDev, stopWebDev, webDevRunning } from "./spawn-web";
import { isUrlReachable, waitForUrl } from "./wait-for-url";

const PARTITION = "persist:postfactum";
const isDev = process.argv.includes("--dev") || !app.isPackaged;

let mainWindow: BrowserWindow | undefined;
let appUrl = "";

function preloadPath(): string {
  return join(__dirname, "preload.js");
}

function setupPage(): string {
  return join(app.getAppPath(), "setup.html");
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "PostFactum",
    autoHideMenuBar: !isDev,
    webPreferences: {
      preload: preloadPath(),
      partition: PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 960,
          height: 720,
          autoHideMenuBar: true,
          // OAuth popups can share the session, but must never receive the desktop bridge.
          webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false },
        },
      };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("did-fail-load", (_event, errorCode, _desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (validatedURL.startsWith("file:")) return;
    void showSetup();
  });

  return window;
}

async function showSetup(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await mainWindow.loadFile(setupPage());
}

async function loadApp(url: string): Promise<void> {
  appUrl = url;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await mainWindow.loadURL(url);
}

async function openResolvedUrl(): Promise<void> {
  const url = resolveAppUrl(app.getAppPath(), app.getPath("userData"));
  appUrl = url;

  if (!app.isPackaged && isLocalUrl(url) && !(await isUrlReachable(url))) {
    spawnWebDev(repoRootFromDesktopAppPath(app.getAppPath()));
    const ready = await waitForUrl(url, 90_000, webDevRunning);
    if (!ready) {
      await showSetup();
      return;
    }
  } else if (!(await isUrlReachable(url))) {
    await showSetup();
    return;
  }

  await loadApp(url);
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Change website URL…",
          click: () => {
            void showSetup();
          },
        },
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopWebDev();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
    void openResolvedUrl();
  }
});

function isSetupSender(event: Electron.IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  return Boolean(frame && frame === event.sender.mainFrame && frame.url === pathToFileURL(setupPage()).href);
}

ipcMain.handle("desktop:get-app-url", (event) => {
  if (!isSetupSender(event)) throw new Error("This desktop action is only available on the setup page.");
  return appUrl || resolveAppUrl(app.getAppPath(), app.getPath("userData"));
});

ipcMain.handle("desktop:save-app-url", async (event, raw: unknown) => {
  if (!isSetupSender(event)) throw new Error("This desktop action is only available on the setup page.");
  if (typeof raw !== "string") throw new Error("URL is required.");
  const url = saveAppUrl(app.getPath("userData"), raw);
  await loadApp(url);
  return url;
});

ipcMain.handle("desktop:retry", async (event) => {
  if (!isSetupSender(event)) throw new Error("This desktop action is only available on the setup page.");
  await openResolvedUrl();
});

void app.whenReady().then(async () => {
  const ses = session.fromPartition(PARTITION);
  installPermissionHandlers(ses, () => appUrl || resolveAppUrl(app.getAppPath(), app.getPath("userData")));
  buildMenu();
  mainWindow = createWindow();
  await openResolvedUrl();
});

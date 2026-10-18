import { contextBridge, ipcRenderer } from "electron";

window.addEventListener("DOMContentLoaded", () => {
  if (window.location.protocol !== "file:" || !window.location.pathname.endsWith("/setup.html") || document.body?.dataset["postfactumSetup"] !== "true") return;
  contextBridge.exposeInMainWorld("postfactumDesktop", {
    platform: process.platform,
    getAppUrl: () => ipcRenderer.invoke("desktop:get-app-url") as Promise<string>,
    saveAppUrl: (url: string) => ipcRenderer.invoke("desktop:save-app-url", url) as Promise<string>,
    retry: () => ipcRenderer.invoke("desktop:retry") as Promise<void>,
  });
  const form = document.querySelector("#form");
  const input = document.querySelector("#url");
  const error = document.querySelector("#error");
  const retry = document.querySelector("#retry");
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) return;

  void window.postfactumDesktop.getAppUrl().then((url) => {
    input.value = url;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (error) error.textContent = "";
    void window.postfactumDesktop.saveAppUrl(input.value).catch((cause: unknown) => {
      if (error) error.textContent = cause instanceof Error ? cause.message : "Could not open that URL.";
    });
  });

  retry?.addEventListener("click", () => {
    void window.postfactumDesktop.retry();
  });
});

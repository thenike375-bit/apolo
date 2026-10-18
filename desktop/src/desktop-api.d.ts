export {};

declare global {
  interface Window {
    postfactumDesktop: {
      platform: NodeJS.Platform;
      getAppUrl: () => Promise<string>;
      saveAppUrl: (url: string) => Promise<string>;
      retry: () => Promise<void>;
    };
  }
}

export async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.status < 500;
  } catch {
    return false;
  }
}

export async function waitForUrl(
  url: string,
  timeoutMs: number,
  shouldContinue?: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (shouldContinue && !shouldContinue()) return false;
    if (await isUrlReachable(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return isUrlReachable(url);
}

import { desktopCapturer, systemPreferences, type Session } from "electron";

const MEDIA_PERMISSIONS = new Set(["media", "audioCapture", "videoCapture", "display-capture"]);

function sameOrigin(requestUrl: string, appUrl: string): boolean {
  try {
    return new URL(requestUrl).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

async function askDarwinMedia(
  permission: string,
  details: Electron.PermissionRequest,
): Promise<boolean> {
  if (process.platform !== "darwin") return true;
  const mediaTypes =
    "mediaTypes" in details && Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
  const needsMicrophone =
    permission === "audioCapture" ||
    (permission === "media" && (mediaTypes.length === 0 || mediaTypes.includes("audio")));
  const needsCamera =
    permission === "videoCapture" ||
    (permission === "media" && mediaTypes.includes("video"));
  let allowed = true;
  if (needsMicrophone) {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    allowed =
      status === "granted" || (await systemPreferences.askForMediaAccess("microphone"));
  }
  if (needsCamera) {
    const status = systemPreferences.getMediaAccessStatus("camera");
    allowed =
      allowed && (status === "granted" || (await systemPreferences.askForMediaAccess("camera")));
  }
  return allowed;
}

export function installPermissionHandlers(ses: Session, getAppUrl: () => string): void {
  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    if (!MEDIA_PERMISSIONS.has(permission)) return true;
    return sameOrigin(requestingOrigin, getAppUrl());
  });

  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || ("securityOrigin" in details ? details.securityOrigin ?? "" : "");
    if (!MEDIA_PERMISSIONS.has(permission)) {
      callback(true);
      return;
    }
    if (!sameOrigin(requestingUrl, getAppUrl())) {
      callback(false);
      return;
    }
    void askDarwinMedia(permission, details)
      .then(callback)
      .catch(() => callback(false));
  });

  ses.setDisplayMediaRequestHandler((_request, callback) => {
    void desktopCapturer
      .getSources({ types: ["screen", "window"] })
      .then((sources) => {
        const source = sources[0];
        if (!source) {
          callback({});
          return;
        }
        callback({ video: source });
      })
      .catch(() => callback({}));
  });
}

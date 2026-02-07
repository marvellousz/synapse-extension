/** Chrome extension APIs used by the popup */

export function captureVisibleTab(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!chrome?.tabs) {
      reject(new Error("extension API not available"));
      return;
    }
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      const err = chrome?.runtime?.lastError;
      if (err) {
        reject(new Error(err.message ?? "capture failed"));
        return;
      }
      resolve(dataUrl);
    });
  });
}

export function getCurrentTabUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!chrome?.tabs) {
      resolve(null);
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? null;
      resolve(url);
    });
  });
}

export function getCurrentTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    if (!chrome?.tabs) {
      resolve(null);
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const id = tabs[0]?.id ?? null;
      resolve(id ?? null);
    });
  });
}

export function sendToBackground(msg: { action: string; tabId?: number; title?: string | null }): Promise<{ ok?: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!chrome?.runtime?.sendMessage) {
      resolve({ ok: false, error: "Extension API not available" });
      return;
    }
    chrome.runtime.sendMessage(msg, (response: unknown) => {
      if (chrome?.runtime?.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      const r = response as { ok?: boolean; error?: string } | undefined;
      resolve(r ?? { ok: false });
    });
  });
}

export function dataUrlToFile(dataUrl: string, filename: string, mime: string): File {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1] ?? "");
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new File([u8], filename, { type: mime });
}

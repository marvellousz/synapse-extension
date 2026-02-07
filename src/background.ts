/**
 * Service worker: injects section-capture content script, captures tab, asks content to crop, uploads.
 */

const API_URL = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "synapse_token";

type Rect = { x: number; y: number; w: number; h: number };

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0]?.match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(arr[1] ?? "");
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

async function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome!.storage!.local!.get([TOKEN_KEY], (result: Record<string, unknown>) =>
      resolve((result[TOKEN_KEY] as string | null) ?? null)
    );
  });
}

async function createMemory(token: string, title: string | null): Promise<{ id: string }> {
  const base = API_URL.replace(/\/$/, "");
  const body = {
    type: "image",
    contentHash: `hash-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    title: title || null,
    summary: null,
    sourceUrl: null,
    status: "processing",
  };
  const res = await fetch(`${base}/memories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

async function uploadFile(token: string, memoryId: string, blob: Blob): Promise<unknown> {
  const base = API_URL.replace(/\/$/, "");
  const form = new FormData();
  form.append("files", new File([blob], "screenshot.png", { type: "image/png" }));
  const res = await fetch(`${base}/memories/${memoryId}/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

chrome!.runtime!.onMessage!.addListener(
  (msg: unknown, _sender: unknown, sendResponse: (r: { ok?: boolean; error?: string }) => void) => {
    const m = msg as { action: string; tabId?: number; title?: string | null };
    if (m.action !== "startSectionCapture" || m.tabId == null) return false;

    const tabId = m.tabId;
    const title = m.title ?? null;

    (async () => {
      const token = await getToken();
      if (!token) {
        sendResponse({ ok: false, error: "Not logged in" });
        return;
      }

      try {
        await chrome!.scripting!.executeScript!({
          target: { tabId },
          files: ["contentSectionCapture.js"],
        });
      } catch (e) {
        sendResponse({ ok: false, error: "Could not inject capture script" });
        return;
      }

      await chrome!.tabs!.sendMessage!(tabId, { action: "startSelection" });

      const tab = await chrome!.tabs!.get(tabId);
      const windowId = tab.windowId ?? undefined;

      const regionPromise = new Promise<{ rect: Rect; devicePixelRatio: number } | "cancelled">(
        (resolveRegion) => {
          const listener = (msg: unknown) => {
            const m = msg as { action: string; rect?: Rect; devicePixelRatio?: number };
            if (m.action === "regionSelected" && m.rect != null) {
              chrome!.runtime!.onMessage!.removeListener!(listener as () => void);
              resolveRegion({
                rect: m.rect,
                devicePixelRatio: m.devicePixelRatio ?? 1,
              });
            } else if (m.action === "selectionCancelled") {
              chrome!.runtime!.onMessage!.removeListener!(listener as () => void);
              resolveRegion("cancelled");
            }
          };
          chrome!.runtime!.onMessage!.addListener!(listener);
        }
      );

      const region = await regionPromise;
      if (region === "cancelled") {
        sendResponse({ ok: true });
        return;
      }

      let dataUrl: string;
      try {
        dataUrl = await new Promise<string>((resolve, reject) => {
          chrome!.tabs!.captureVisibleTab!(windowId ?? null, { format: "png" }, (url: string) => {
            const err = chrome!.runtime!.lastError;
            if (err) reject(new Error(err.message));
            else resolve(url);
          });
        });
      } catch (e) {
        sendResponse({ ok: false, error: "Capture failed" });
        return;
      }

      const croppedPromise = new Promise<string>((resolve, reject) => {
        chrome!.tabs!.sendMessage!(
          tabId,
          {
            action: "cropImage",
            dataUrl,
            rect: region.rect,
            devicePixelRatio: region.devicePixelRatio,
          },
          (response: unknown) => {
            if (chrome!.runtime!.lastError) {
              reject(new Error(chrome!.runtime!.lastError?.message));
              return;
            }
            const r = response as { dataUrl?: string; error?: string } | undefined;
            if (r?.error) reject(new Error(r.error));
            else if (r?.dataUrl) resolve(r.dataUrl);
            else reject(new Error("No crop response"));
          }
        );
      });

      let croppedDataUrl: string;
      try {
        croppedDataUrl = await croppedPromise;
      } catch (e) {
        sendResponse({ ok: false, error: "Crop failed" });
        return;
      }

      try {
        const memory = await createMemory(token, title);
        const blob = dataUrlToBlob(croppedDataUrl);
        await uploadFile(token, memory.id, blob);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : "Upload failed",
        });
      }
    })();

    return true; // keep channel open for async sendResponse
  }
);

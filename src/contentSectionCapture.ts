/**
 * Injected content script: overlay for selecting a region, then crops image when asked.
 */

type Rect = { x: number; y: number; w: number; h: number };

function createOverlay(): {
  overlay: HTMLDivElement;
  setRect: (r: Rect | null) => void;
  getRect: () => Rect | null;
  destroy: () => void;
  onCapture: (cb: () => void) => void;
  onCancel: (cb: () => void) => void;
} {
  const overlay = document.createElement("div");
  overlay.id = "synapse-section-capture-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    background: "rgba(0,0,0,0.4)",
    cursor: "crosshair",
  });

  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "fixed",
    border: "2px solid #3b82f6",
    background: "rgba(59,130,246,0.15)",
    pointerEvents: "none",
    display: "none",
  });
  overlay.appendChild(box);

  const hint = document.createElement("div");
  Object.assign(hint.style, {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.8)",
    color: "#fff",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    zIndex: "2147483647",
  });
  hint.textContent = "Drag to select an area";
  overlay.appendChild(hint);

  const buttons = document.createElement("div");
  Object.assign(buttons.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "none", // hidden until user finishes drawing selection
    gap: "12px",
    zIndex: "2147483647",
    flexDirection: "row",
    flexWrap: "nowrap",
  });

  let currentRect: Rect | null = null;
  let startX = 0,
    startY = 0;
  let selectionDone = false; // true after mouse up with valid rect → buttons visible

  const setRect = (r: Rect | null) => {
    currentRect = r;
    if (r) {
      box.style.display = "block";
      box.style.left = `${r.x}px`;
      box.style.top = `${r.y}px`;
      box.style.width = `${r.w}px`;
      box.style.height = `${r.h}px`;
    } else {
      box.style.display = "none";
    }
  };

  const getRect = () => currentRect;

  const showButtons = () => {
    selectionDone = true;
    buttons.style.display = "flex";
    hint.textContent = "Click Capture to save or Cancel";
  };

  const onMouseDown = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "BUTTON" || t.closest?.("button")) return;
    if (selectionDone) return; // already have selection, only buttons are clickable
    if (t !== overlay && t !== hint && t !== box) return;
    startX = e.clientX;
    startY = e.clientY;
    setRect({ x: startX, y: startY, w: 0, h: 0 });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!currentRect || selectionDone) return;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    setRect({ x, y, w, h });
  };

  const onMouseUp = () => {
    if (selectionDone) return;
    // After release: if we have a non-zero selection, show the buttons
    if (currentRect && currentRect.w > 0 && currentRect.h > 0) {
      showButtons();
    }
  };

  const captureBtn = document.createElement("button");
  Object.assign(captureBtn.style, {
    padding: "10px 20px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
  });
  captureBtn.textContent = "Capture";
  const cancelBtn = document.createElement("button");
  Object.assign(cancelBtn.style, {
    padding: "10px 20px",
    background: "#475569",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
  });
  cancelBtn.textContent = "Cancel";

  let captureCb: () => void = () => {};
  let cancelCb: () => void = () => {};

  const onCapture = (cb: () => void) => {
    captureCb = cb;
  };
  const onCancel = (cb: () => void) => {
    cancelCb = cb;
  };

  captureBtn.addEventListener("click", (event) => {
    // Prevent overlay drag handlers from seeing button interactions.
    event.stopPropagation();
    if (currentRect && currentRect.w > 0 && currentRect.h > 0) captureCb();
  });
  cancelBtn.addEventListener("click", (event) => {
    // Keep callback dynamic so later onCancel assignment is respected.
    event.stopPropagation();
    cancelCb();
  });

  buttons.appendChild(captureBtn);
  buttons.appendChild(cancelBtn);
  overlay.appendChild(buttons);

  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);

  const keydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") cancelCb();
  };
  document.addEventListener("keydown", keydown);

  const destroy = () => {
    overlay.remove();
    document.removeEventListener("keydown", keydown);
  };

  return { overlay, setRect, getRect, destroy, onCapture, onCancel };
}

function cropImageToDataUrl(
  fullDataUrl: string,
  rect: Rect,
  devicePixelRatio: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const dpr = devicePixelRatio;
      const sx = rect.x * dpr;
      const sy = rect.y * dpr;
      const sw = rect.w * dpr;
      const sh = rect.h * dpr;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 2d not available"));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = fullDataUrl;
  });
}

function run() {
  let overlayApi: ReturnType<typeof createOverlay> | null = null;

  chrome!.runtime!.onMessage!.addListener(
    (msg: unknown, _sender: unknown, sendResponse: (r: { dataUrl?: string; error?: string }) => void) => {
      const m = msg as { action: string; dataUrl?: string; rect?: Rect; devicePixelRatio?: number };
      if (m.action === "stopSelection") {
        overlayApi?.destroy();
        overlayApi = null;
        chrome!.runtime!.sendMessage!({ action: "selectionCancelled" });
        return;
      }
      if (m.action === "cropImage" && m.dataUrl && m.rect != null && m.devicePixelRatio != null) {
        cropImageToDataUrl(m.dataUrl, m.rect, m.devicePixelRatio)
          .then((dataUrl) => sendResponse({ dataUrl }))
          .catch((e) => sendResponse({ error: String(e) }));
        return true; // async response
      }

      if (m.action === "startSelection") {
        if (overlayApi) {
          overlayApi.destroy();
          overlayApi = null;
        }
        overlayApi = createOverlay();
        overlayApi.onCapture(() => {
          const rect = overlayApi?.getRect();
          if (rect && rect.w > 0 && rect.h > 0) {
            overlayApi?.destroy();
            overlayApi = null;
            chrome!.runtime!.sendMessage!({
              action: "regionSelected",
              rect,
              devicePixelRatio: window.devicePixelRatio,
            });
          }
        });
        overlayApi.onCancel(() => {
          overlayApi?.destroy();
          overlayApi = null;
          chrome!.runtime!.sendMessage!({ action: "selectionCancelled" });
        });
        document.body.appendChild(overlayApi.overlay);
      }
    }
  );
}

run();

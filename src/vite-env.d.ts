/// <reference types="vite/client" />

declare const chrome: {
  tabs?: {
    captureVisibleTab: (
      windowId: number | null,
      options: { format: "png" | "jpeg" },
      callback: (dataUrl: string) => void
    ) => void;
    query: (
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: { id?: number; url?: string; windowId?: number }[]) => void
    ) => void;
    get: (tabId: number) => Promise<{ windowId?: number }>;
    sendMessage: (
      tabId: number,
      msg: unknown,
      callback?: (response: unknown) => void
    ) => void;
  };
  runtime?: {
    lastError?: { message?: string };
    sendMessage?: (msg: unknown, callback?: (response: unknown) => void) => void;
    onMessage?: {
      addListener: (cb: (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => void) => void;
      removeListener: (cb: (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => void) => void;
    };
  };
  storage?: {
    local?: {
      set: (keys: Record<string, unknown>, callback?: () => void) => void;
      get: (keys: string | string[], callback: (result: Record<string, unknown>) => void) => void;
      remove: (keys: string | string[], callback?: () => void) => void;
    };
  };
  scripting?: {
    executeScript: (options: { target: { tabId: number }; files: string[] }) => Promise<void>;
  };
} | undefined;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

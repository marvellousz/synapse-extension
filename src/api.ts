const TOKEN_KEY = "synapse_token";

export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || "http://localhost:8000";
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    try {
      chrome?.storage?.local?.set({ [TOKEN_KEY]: token });
    } catch {
      // ignore if not in extension context
    }
  } else {
    localStorage.removeItem(TOKEN_KEY);
    try {
      chrome?.storage?.local?.remove(TOKEN_KEY);
    } catch {
      // ignore if not in extension context
    }
  }
}

export type MemoryType = "text" | "image" | "webpage" | "youtube";

export interface MemoryCreate {
  type: MemoryType;
  contentHash: string;
  title?: string | null;
  summary?: string | null;
  sourceUrl?: string | null;
  status?: string;
}

export interface Memory {
  id: string;
  type: string;
  title: string | null;
  summary: string | null;
  status: string;
}

async function api<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string> }
): Promise<T> {
  const base = getApiUrl().replace(/\/$/, "");
  const { params, ...init } = options ?? {};
  const url = new URL(path.startsWith("http") ? path : base + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, v);
    });
  }
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init.body && typeof init.body === "string") headers["Content-Type"] = "application/json";
  const res = await fetch(url.toString(), { ...init, headers });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<{ access_token: string }> {
  const data = await api<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data;
}

export async function createMemory(body: MemoryCreate): Promise<Memory> {
  return api<Memory>("/memories", { method: "POST", body: JSON.stringify(body) });
}

export async function uploadFiles(memoryId: string, files: File[]): Promise<unknown> {
  const base = getApiUrl().replace(/\/$/, "");
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base}/memories/${memoryId}/uploads`, {
    method: "POST",
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

function generateContentHash(): string {
  return `hash-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function buildCreateBody(
  type: MemoryType,
  title: string,
  summary: string,
  sourceUrl: string
): MemoryCreate {
  return {
    type,
    contentHash: generateContentHash(),
    title: title || null,
    summary: summary || null,
    sourceUrl: type === "webpage" || type === "youtube" ? (sourceUrl || null) : null,
    status: "processing",
  };
}

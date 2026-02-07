import { useState, useEffect } from "react";
import {
  getToken,
  setToken,
  login,
  createMemory,
  uploadFiles,
  buildCreateBody,
} from "./api";
import { captureVisibleTab, getCurrentTabUrl, getCurrentTabId, sendToBackground, dataUrlToFile } from "./extension";

type View = "welcome" | "login" | "app";

export default function App() {
  const [token, setTokenState] = useState<string | null>(null);
  const [view, setView] = useState<View>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState<"screenshot" | "screenshot_section" | "web" | "youtube" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = getToken();
    setTokenState(t);
    if (t) setView("app");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login(email, password);
      setTokenState(getToken());
      setView("app");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setTokenState(null);
    setView("welcome");
  };

  const clearFeedback = () => {
    setError(null);
    setSuccess(false);
  };

  const handleScreenshot = async () => {
    if (!token) return;
    clearFeedback();
    setLoading("screenshot");
    try {
      const dataUrl = await captureVisibleTab();
      const file = dataUrlToFile(dataUrl, "screenshot.png", "image/png");
      const body = buildCreateBody("image", title, "", "");
      const memory = await createMemory(body);
      await uploadFiles(memory.id, [file]);
      setSuccess(true);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "screenshot failed");
    } finally {
      setLoading(null);
    }
  };

  const handleSectionCapture = async () => {
    if (!token) return;
    clearFeedback();
    setLoading("screenshot_section");
    try {
      const tabId = await getCurrentTabId();
      if (tabId == null) {
        setError("Could not get current tab");
        setLoading(null);
        return;
      }
      const res = await sendToBackground({ action: "startSectionCapture", tabId, title });
      if (res.ok) {
        setSuccess(true);
        setTitle("");
      } else {
        setError(res.error ?? "Section capture failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "section capture failed");
    } finally {
      setLoading(null);
    }
  };

  const handleSaveCurrentPage = async () => {
    if (!token) return;
    clearFeedback();
    setLoading("web");
    try {
      const url = await getCurrentTabUrl();
      if (!url?.trim()) {
        setError("could not get current page URL");
        setLoading(null);
        return;
      }
      const body = buildCreateBody("webpage", title, "", url);
      await createMemory(body);
      setSuccess(true);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setLoading(null);
    }
  };

  const handleSaveWebUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !webUrl.trim()) return;
    clearFeedback();
    setLoading("web");
    try {
      const body = buildCreateBody("webpage", title, "", webUrl.trim());
      await createMemory(body);
      setSuccess(true);
      setTitle("");
      setWebUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setLoading(null);
    }
  };

  const handleSaveYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !youtubeUrl.trim()) return;
    clearFeedback();
    setLoading("youtube");
    try {
      const body = buildCreateBody("youtube", title, "", youtubeUrl.trim());
      await createMemory(body);
      setSuccess(true);
      setTitle("");
      setYoutubeUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setLoading(null);
    }
  };

  const handleSaveText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pastedText.trim()) return;
    clearFeedback();
    setLoading("text");
    try {
      const body = buildCreateBody("text", title, "", "");
      const memory = await createMemory(body);
      const blob = new File([pastedText.trim()], "note.txt", { type: "text/plain" });
      await uploadFiles(memory.id, [blob]);
      setSuccess(true);
      setTitle("");
      setPastedText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setLoading(null);
    }
  };

  const isCompact = view === "welcome" || view === "login";

  return (
    <div
      className={`w-[400px] bg-slate-900 text-slate-100 text-sm flex flex-col ${isCompact ? "min-h-[320px]" : "min-h-[500px]"}`}
    >
      <header className="px-4 py-3 border-b border-slate-700 shrink-0">
        <h1 className="text-lg font-semibold text-white">synapse</h1>
      </header>

      <div className={`overflow-y-auto p-4 ${isCompact ? "shrink-0" : "flex-1"} space-y-4`}>
        {view === "welcome" && (
          <div className="py-6 px-2 flex flex-col items-center text-center">
            <p className="text-slate-400 text-sm leading-relaxed max-w-[280px] mb-8">
              Save screenshots, links, YouTube videos, and text to your second brain. Search and chat over everything you save.
            </p>
            <button
              type="button"
              onClick={() => setView("login")}
              className="w-full max-w-[240px] py-3 rounded-xl font-semibold text-white transition-all hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.4)",
              }}
            >
              Log in
            </button>
          </div>
        )}

        {view === "login" && (
          <form onSubmit={handleLogin} className="space-y-3">
            <button
              type="button"
              onClick={() => setView("welcome")}
              className="text-slate-500 hover:text-slate-300 text-xs mb-2 cursor-pointer"
            >
              ← Back
            </button>
            <label className="block text-slate-400 mb-1">Log in</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loginLoading ? "…" : "Log in"}
            </button>
          </form>
        )}

        {view === "app" && token && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">logged in</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                log out
              </button>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-700">
              <label className="block text-slate-400 text-xs mb-1">optional title (for any action)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="optional title"
                className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* 1. Screenshot */}
            <section className="space-y-2">
              <h2 className="text-white font-medium text-sm">screenshot</h2>
              <p className="text-slate-400 text-xs">Capture the current page (full or a section) and save as an image memory.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSectionCapture}
                  disabled={!!loading}
                  className="flex-1 py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 disabled:opacity-50 text-sm"
                >
                  {loading === "screenshot_section" ? "…" : "capture section"}
                </button>
                <button
                  type="button"
                  onClick={handleScreenshot}
                  disabled={!!loading}
                  className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 disabled:opacity-50 text-sm"
                >
                  {loading === "screenshot" ? "…" : "full page"}
                </button>
              </div>
            </section>

            {/* 2. Web URL */}
            <section className="space-y-2">
              <h2 className="text-white font-medium text-sm">web url</h2>
              <button
                type="button"
                onClick={handleSaveCurrentPage}
                disabled={!!loading}
                className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {loading === "web" ? "…" : "save current page"}
              </button>
              <form onSubmit={handleSaveWebUrl} className="flex gap-2">
                <input
                  type="url"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="or paste a URL"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!!loading || !webUrl.trim()}
                  className="py-2 px-3 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 disabled:opacity-50"
                >
                  save
                </button>
              </form>
            </section>

            {/* 3. YouTube URL */}
            <section className="space-y-2">
              <h2 className="text-white font-medium text-sm">youtube</h2>
              <form onSubmit={handleSaveYoutube} className="flex gap-2">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/…"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!!loading || !youtubeUrl.trim()}
                  className="py-2 px-3 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 disabled:opacity-50"
                >
                  {loading === "youtube" ? "…" : "save"}
                </button>
              </form>
            </section>

            {/* 4. Text */}
            <section className="space-y-2">
              <h2 className="text-white font-medium text-sm">text</h2>
              <form onSubmit={handleSaveText} className="space-y-2">
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="paste text…"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y text-sm"
                />
                <button
                  type="submit"
                  disabled={!!loading || !pastedText.trim()}
                  className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 disabled:opacity-50"
                >
                  {loading === "text" ? "…" : "save as text memory"}
                </button>
              </form>
            </section>

            {error && <p className="text-red-400 text-xs">{error}</p>}
            {success && (
              <p className="text-green-400 text-xs">saved. processing in background.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
import { Brain, LogOut, Camera, Scissors, Globe, Youtube, FileText, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

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

  return (
    <div className="w-[400px] bg-[#F8FAFC] flex flex-col min-h-[500px] grid-bg selection:bg-indigo-200">
      {/* Header */}
      <header className="px-4 py-4 bg-white border-b-2 border-black flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 border-2 border-black flex items-center justify-center rotate-[-3deg]">
            <Brain className="text-white w-5 h-5" />
          </div>
          <h1 className="heading-brut text-xl tracking-tighter">synapse</h1>
        </div>

        {view === "app" && (
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {view === "welcome" && (
          <div className="py-10 flex flex-col items-center text-center space-y-8">
            <div className="space-y-4">
              <h2 className="heading-brut text-3xl">Capture Everything.</h2>
              <p className="font-bold text-gray-500 text-xs uppercase tracking-widest leading-relaxed max-w-[280px]">
                Save screenshots, links, and video streams to your second brain instantly.
              </p>
            </div>

            <button
              onClick={() => setView("login")}
              className="brut-button w-full max-w-[280px] py-4 text-lg"
            >
              ACCESS PORTAL
            </button>
          </div>
        )}

        {view === "login" && (
          <div className="space-y-6">
            <button
              onClick={() => setView("welcome")}
              className="group flex items-center gap-2 font-black uppercase text-[10px] tracking-widest text-gray-400 hover:text-black transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div className="brut-card p-6 bg-white space-y-4">
              <h2 className="heading-brut text-2xl">Log In.</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="block font-black uppercase text-[9px] tracking-widest text-gray-500">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ENTER EMAIL"
                    required
                    className="brut-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-black uppercase text-[9px] tracking-widest text-gray-500">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="brut-input"
                  />
                </div>
                {loginError && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-500 text-rose-700 text-[10px] font-black uppercase">
                    {loginError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="brut-button w-full py-3"
                >
                  {loginLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : "AUTHENTICATE"}
                </button>
              </form>
            </div>
          </div>
        )}

        {view === "app" && token && (
          <>
            {/* Title Section */}
            <div className="space-y-2">
              <label className="block font-black uppercase text-[10px] tracking-widest text-indigo-600">Memory Label (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="WHAT IS THIS MEMORY?"
                className="brut-input bg-white text-sm"
              />
            </div>

            {/* Main Actions Group */}
            <div className="grid grid-cols-2 gap-4">
              {/* Screenshot */}
              <button
                onClick={handleSectionCapture}
                disabled={!!loading}
                className="brut-card p-4 flex flex-col items-center gap-2 hover:bg-indigo-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-indigo-100 border-2 border-black flex items-center justify-center rotate-[-2deg] group-hover:rotate-0 transition-transform">
                  {loading === "screenshot_section" ? <Loader2 className="animate-spin" /> : <Scissors size={20} />}
                </div>
                <span className="font-black uppercase text-[10px] tracking-widest">Section</span>
              </button>

              <button
                onClick={handleScreenshot}
                disabled={!!loading}
                className="brut-card p-4 flex flex-col items-center gap-2 hover:bg-emerald-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-emerald-100 border-2 border-black flex items-center justify-center rotate-[2deg] group-hover:rotate-0 transition-transform">
                  {loading === "screenshot" ? <Loader2 className="animate-spin" /> : <Camera size={20} />}
                </div>
                <span className="font-black uppercase text-[10px] tracking-widest">Full Tab</span>
              </button>
            </div>

            {/* Content Groupings */}
            <div className="space-y-4">
              {/* Web URL */}
              <div className="brut-card bg-white p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Globe size={14} className="text-indigo-600" />
                  <span className="font-black uppercase text-[10px] tracking-widest">Web stream</span>
                </div>
                <button
                  onClick={handleSaveCurrentPage}
                  disabled={!!loading}
                  className="brut-button w-full py-2 bg-indigo-500 text-[10px]"
                >
                  {loading === "web" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "CAPTURE CURRENT PAGE"}
                </button>
                <form onSubmit={handleSaveWebUrl} className="relative">
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="PASTE URL..."
                    className="brut-input pr-12 h-10"
                  />
                  <button
                    type="submit"
                    disabled={!!loading || !webUrl.trim()}
                    className="absolute right-1 top-1 bottom-1 px-3 bg-black text-white font-black text-[9px] uppercase border-l-2 border-black hover:bg-indigo-600 transition-colors"
                  >
                    GO
                  </button>
                </form>
              </div>

              {/* YouTube */}
              <div className="brut-card bg-white p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Youtube size={14} className="text-rose-500" />
                  <span className="font-black uppercase text-[10px] tracking-widest">Video link</span>
                </div>
                <form onSubmit={handleSaveYoutube} className="relative">
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="YOUTUBE LINK..."
                    className="brut-input pr-12 h-10"
                  />
                  <button
                    type="submit"
                    disabled={!!loading || !youtubeUrl.trim()}
                    className="absolute right-1 top-1 bottom-1 px-3 bg-rose-500 text-white font-black text-[9px] uppercase border-l-2 border-black hover:bg-rose-600 transition-colors"
                  >
                    SYNC
                  </button>
                </form>
              </div>

              {/* Text Note */}
              <div className="brut-card bg-white p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-amber-500" />
                  <span className="font-black uppercase text-[10px] tracking-widest">Quick note</span>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="PASTE SNIPPET..."
                  rows={2}
                  className="brut-input text-xs lowercase h-20"
                />
                <button
                  onClick={handleSaveText}
                  disabled={!!loading || !pastedText.trim()}
                  className="brut-button w-full py-2 bg-amber-400 text-black text-[10px]"
                >
                  {loading === "text" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "SAVE TEXT CORE"}
                </button>
              </div>
            </div>

            {/* Status Footer */}
            {(error || success) && (
              <div className={`p-3 border-2 border-black shadow-[2px_2px_0px_0px_black] flex items-center gap-2 ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                }`}>
                {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                <p className="font-black uppercase text-[9px] tracking-widest">
                  {error || "Synchronization Complete."}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="px-4 py-3 bg-white border-t-2 border-black text-center">
        <p className="font-black uppercase text-[8px] tracking-[0.2em] text-gray-400">
          SYNAPSE CORP.
        </p>
      </footer>
    </div>
  );
}

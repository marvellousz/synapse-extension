# extension

react + vite + tailwind. chrome extension popup.

```bash
cp .env.example .env   # set VITE_API_URL if not localhost:8000
pnpm install
pnpm build            # → dist/
```

**load as extension:** chrome → `chrome://extensions` → turn on "Developer mode" → "Load unpacked" → choose the `dist` folder. the synapse icon will appear in the toolbar; click it to open the popup.

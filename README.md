# Synapse Browser Extension

Plain React + TypeScript + Vite + Tailwind. Popup UI only — no routing, no server.

## Setup

```bash
cd extensions
npm install
```

## Develop

```bash
npm run dev
```

Runs Vite dev server. For extension development you’ll typically point your browser extension at the `dist` folder after building.

## Build

```bash
npm run build
```

Output: `dist/` — static files for the extension popup.

## Stack

- **React 18** — popup UI
- **TypeScript** — type safety
- **Vite** — build tool
- **Tailwind CSS** — styling

No router, no backend. Industry-standard extension popup setup.

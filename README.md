# extension

this is the chrome extension ui for synapse.

built with react + vite + tailwind. it gives a quick popup flow tied to your backend api.

## quick start

```bash
cp .env.example .env   # set VITE_API_URL if not localhost:8000
pnpm install
pnpm build            # → dist/
```

## load in chrome

1. open `chrome://extensions`
2. toggle on developer mode
3. click load unpacked
4. select the `dist` folder

then pin the synapse icon and open the popup.

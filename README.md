# Meme Lab Starter Template

A minimal full-stack starter for Meme Lab featuring a Node.js + Express API and a vanilla JavaScript frontend. The app highlights trending memes from Reddit's `r/memes` subreddit and now ships with an offline cache so you can keep laughing even when the network flakes out.

## Project structure

```
memelab/
├── client/          # Static frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── main.js
│   ├── styles.css
│   └── package.json
├── server/          # Node.js backend API
│   ├── package.json
│   ├── public/
│   │   └── cache/   # Local meme assets used for offline mode
│   └── src/
│       ├── app.js
│       ├── memes.js
│       ├── routes.js
│       ├── data/
│       └── server.js
└── README.md
```

## Getting started

### Backend

1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and adjust values if needed.
4. Provide `OPENAI_API_KEY` in `.env` (and optionally override `OPENAI_MODEL`, which defaults to `gpt-5-mini`) if you want GPT-5-backed analysis; otherwise the server falls back to heuristic tags.
5. `npm run dev`

The API listens on `http://localhost:5000` by default.

### Frontend

Use the bundled static dev server so the app is hosted from `http://localhost:5173` instead of loading the HTML file directly:

```bash
cd client
npm install
npm run dev
```

Then visit `http://localhost:5173`.

You will see a **Trending from r/memes** panel, a ⚙️ settings button in the top-right corner, and an inline offline indicator that lights up whenever cached memes are being served.

- Use **Fetch Meme 🎲** to grab the next meme from Reddit (or the cache when offline).
- Hit **Analyze** to send the current meme (title + image URL, and the image itself when online) to GPT-5 for Humor Genome tags and a one-line summary—falling back to heuristics when offline or when no API key is present.
- Open **Settings** and toggle **Go Offline / Go Online** to force cache mode on or off. When offline mode is active (either manually or because Reddit failed), the inline badge will appear, responses include `page.offline: true`, and images are served from `server/public/cache` via `/static/cache/...` URLs.

## API routes

- `GET /api/health` – simple health check.
- `GET /api/memes/trending?after=<token>&offline=true` – proxies Reddit hot posts from `r/memes`. Append `offline=true` to force cache mode. Responses include `page.offline` to indicate the data source.
- `GET /api/memes` – returns the in-memory meme list (legacy endpoint, handy if you want to reintroduce custom memes).
- `POST /api/memes` – accepts `{ "title": string, "imageUrl": string }` and adds a new meme to the list.
- `POST /api/memes/analyze` – GPT-5 categorisation when `OPENAI_API_KEY` is set, otherwise heuristic fallback.

## Next steps

- Expand the cache with more local memes or generate metadata dynamically.
- Cache Reddit responses or add rate limiting if you expect lots of trending requests.
- Re-enable the custom meme composer or add sharing features when you need them.
- Persist fetched memes locally to keep an archive of favorites.

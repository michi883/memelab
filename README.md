# Meme Lab Starter Template

A minimal full-stack starter for Meme Lab featuring a Node.js + Express API and a vanilla JavaScript frontend. The app highlights trending memes from Reddit's `r/memes` subreddit, offers GPT-powered analysis, and supports Gemini-based remixes when API keys are configured.

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

You will see a **Trending from r/memes** panel with controls to fetch, analyze, and remix the latest posts.

- Use **Fetch Meme 🎲** to grab the next meme from Reddit (optionally continuing with the `after` token provided by the backend).
- Hit **Analyze** to send the current meme (title plus image content) to GPT-5 Mini for Humor Genome tags and a one-line summary—falling back to an error message when no API key is present.
- Enter remix instructions and press **Remix with AI ⚡** to generate a fresh variation with Gemini, provided a Gemini API key is configured.

## API routes

- `GET /api/health` – simple health check.
- `GET /api/memes/trending?after=<token>` – proxies Reddit hot posts from `r/memes`, returning a pagination token in `page.after` when more results are available.
- `GET /api/memes` – returns the in-memory meme list (legacy endpoint, handy if you want to reintroduce custom memes).
- `POST /api/memes` – accepts `{ "title": string, "imageUrl": string }` and adds a new meme to the list.
- `POST /api/memes/analyze` – GPT-5 categorisation when `OPENAI_API_KEY` is set, otherwise heuristic fallback.

## Next steps

- Cache Reddit responses or add rate limiting if you expect lots of trending requests.
- Re-enable the custom meme composer or add sharing features when you need them.
- Persist fetched memes locally to keep an archive of favorites.

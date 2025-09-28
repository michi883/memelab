# Meme Lab

A full-stack playground for exploring internet humor. The Node.js + Express backend fetches live content from Reddit's `r/memes`, optionally enriches it with GPT-based analysis and Gemini remixing, while a lightweight vanilla JS frontend presents the experience.

## Project structure

```
memelab/
├── client/
│   ├── index.html
│   ├── main.js
│   ├── styles.css
│   └── package.json
├── server/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── app.js
│       ├── memes.js
│       ├── routes.js
│       └── server.js
└── README.md
```

There is no longer an in-memory mock dataset—the app always pulls Reddit content (unless you add your own source).

## Getting started

### Backend

1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env`
4. Populate the file:
   - `OPENAI_API_KEY` (optional but required for GPT-powered analysis)
   - `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)
   - `GEMINI_API_KEY` and optional `GEMINI_MODEL` for image remixing
5. `npm run dev`

The API runs at `http://localhost:5000`.

### Frontend

```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:5173`.

## Using the app

- **Search / Remix field** – the single input drives both searching and remixing.
  - Enter a keyword (e.g. “dog”) and hit the search icon to query Reddit. Submit an empty field to fetch the next unfiltered meme.
  - After a meme is loaded, type remix instructions in the same field and press **Remix** (or Cmd/Ctrl+Enter) to spawn a new version when Gemini is configured.
- **Analyze** – sends the current meme (title + image) to GPT. Without an OpenAI key, the button stays disabled.
- **Download icons** – hovering a meme reveals a subtle download action. Originals and remixes open in a new tab for saving.

## API routes

- `GET /api/health` – health probe.
- `GET /api/memes/trending` – fetches the next Reddit post. Accepts:
  - `after` – Reddit pagination token
  - `q` – optional search keyword (max 120 chars)
- `POST /api/memes/analyze` – invokes GPT analysis (`OPENAI_API_KEY` required).
- `POST /api/memes/remix` – sends instructions plus the original image to Gemini (`GEMINI_API_KEY` required).

Legacy `/api/memes` endpoints have been removed along with the mock data seed.

## Notes & ideas

- Consider caching Reddit responses or respecting rate limit headers for production use.
- The download buttons currently open assets in a new tab; swap in a Blob-based downloader if you need same-tab saves.
- Styling is vanilla CSS—tweak `client/styles.css` to rebrand or theme the experience.

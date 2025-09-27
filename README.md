# Meme Lab Starter Template

A minimal full-stack starter for Meme Lab featuring a Node.js + Express API and a vanilla JavaScript frontend. Designed to help you prototype meme ideas quickly while keeping the tech stack lightweight.

## Project structure

```
memelab/
├── client/          # Static frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── server/          # Node.js backend API
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── controllers/
│       ├── data/
│       ├── routes/
│       └── server.js
└── README.md
```

## Getting started

### Backend

1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and adjust values if needed.
4. `npm run dev`

The API listens on `http://localhost:5000` by default.

### Frontend

The frontend is plain HTML/CSS/JS. You can open `client/index.html` directly in your browser or serve it locally for proper CORS support:

```bash
cd client
python3 -m http.server 5173
```

Then visit `http://localhost:5173`.

> Using a static file server keeps fetch requests to `http://localhost:5000` working without additional configuration.

## API routes

- `GET /api/health` – simple health check.
- `GET /api/memes` – returns the in-memory meme list.
- `POST /api/memes` – accepts `{ "title": string, "imageUrl": string }` and adds a new meme to the list.

## Next steps

- Swap the mock data store with a database or filesystem once you are ready for persistence.
- Add authentication if you plan to share meme drafts with collaborators.
- Enhance the frontend with better validation, previews, and meme templates.

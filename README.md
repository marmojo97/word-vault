# Word Vault

A personal vocabulary app for heavy readers. Upload a screenshot of any word
lookup (dictionary app, Kindle, browser), Claude reads it for you, and the
word goes into your spaced-repetition flashcard deck. There's also a word of
the day on the home screen and a searchable vault of everything you've saved.

## Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node + Express
- **Database**: SQLite via `better-sqlite3` (file lives at `wordvault.db` next to the server)
- **AI**: Anthropic API (`claude-sonnet-4-20250514`) for screenshot parsing, on-demand examples, and synonyms

## Local development

```bash
git clone <this repo>
cd word-vault
npm install
cp .env.example .env       # then paste your Anthropic API key into .env
npm run dev
```

This starts:

- the API server at `http://localhost:3001`
- the Vite dev server at `http://localhost:5173` (proxies `/api/*` to the API)

Open `http://localhost:5173` in your browser. The database is auto-created
on first run and seeded with five example words so the app isn't empty.

### Scripts

- `npm run dev` — server + client together (hot reload on both)
- `npm run dev:server` / `npm run dev:client` — run them individually
- `npm run build` — build the client to `dist/`
- `npm start` — start the API server (production)

### Environment variables

Set these in `.env`:

| Var | Required | Default | Notes |
| --- | -------- | ------- | ----- |
| `ANTHROPIC_API_KEY` | yes | — | Get one at https://console.anthropic.com/. Without it, screenshot parsing will fail (everything else still works.) |
| `PORT` | no | `3001` | API server port |

## API

All routes are mounted at `/api/words`.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/` | List all words. Query params: `sort=date\|mastery\|alpha`, `filter=all\|new\|learning\|mastered`. |
| GET | `/today` | Word of the day plus a "coming tomorrow" preview. |
| GET | `/flashcards` | Up to 12 cards due for review today. |
| GET | `/:id` | One word. |
| POST | `/` | Add a word. Body: `{ word, part_of_speech, definition, example_sentence, source }`. |
| POST | `/parse-screenshot` | Body: `{ image, media_type }` where `image` is a base64 string or data URL. Returns `{ word, part_of_speech, definition, example_sentence }` — does NOT save. |
| PATCH | `/:id/mastery` | Body: `{ result: "known" \| "review" }`. Updates mastery and `next_review_date`. |
| PUT | `/:id` | Edit a word. |
| DELETE | `/:id` | Delete a word. |
| POST | `/:id/examples` | Generate 5 example sentences for the word. |
| POST | `/:id/synonyms` | Generate 6 synonyms for the word. |

## Spaced repetition intervals

| New mastery | Days until next review |
| ----------- | ---------------------- |
| 1 | 1 |
| 2 | 3 |
| 3 | 7 |
| 4 | 14 |
| 5 | 30 |

A "review again" answer keeps mastery the same and pushes the next review to tomorrow.

## Deploying

- **Frontend (Vercel)**: build command `npm run build`, output directory `dist`. Set the API origin via a Vercel rewrite (e.g. `/api/* -> https://your-api.example.com/api/*`).
- **Backend (Railway / Render)**: deploy the repo with start command `npm start` and persistent disk for `wordvault.db`. Add `ANTHROPIC_API_KEY` to the env.

## Folder layout

```
word-vault/
├── package.json            # single root package — runs both halves
├── vite.config.js
├── client/
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       ├── api.js
│       ├── components/     # TabBar, Toast, Modal, Flashcard
│       └── screens/        # Today, Practice, Vault, Add
└── server/
    ├── index.js            # Express setup
    ├── db.js               # SQLite schema + seed
    ├── routes/words.js
    └── lib/anthropic.js    # Claude calls
```
# word-vault

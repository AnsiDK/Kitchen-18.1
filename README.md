# Closest Guess

A tiny dorm-kitchen game: the host makes a round with a question and a secret number, everyone else guesses once, and the host reveals who was closest and who was furthest.

No dependencies: one Node server (`server.js`) and one page (`index.html`).

## Run locally

```bash
npm start
```

Open http://localhost:3000. Run the tests with `npm test`.

## Deploy (free, on Render)

1. Push this repo to GitHub.
2. On https://render.com, choose **New → Blueprint** and pick the repo. `render.yaml` sets up a free Node web service.
3. Share the `https://closest-guess-xxxx.onrender.com` link in the kitchen group chat.

Free-plan things to know:
- The site sleeps after about 15 minutes with no visitors. The first visit after that takes around a minute to wake up.
- Rounds are kept in memory, so they are lost when it sleeps or redeploys. A finished round is gone after that, which is fine for a party game.

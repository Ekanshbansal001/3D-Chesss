# MONARCH — Deployment Guide

## 1. Create a Firebase project (free tier is enough)

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it anything (e.g. `monarch-chess`). Google Analytics is optional — you can skip it.
3. Once created, click the **`</>`** (web) icon to register a web app. Give it a nickname; you don't need Firebase Hosting for this step.
4. Firebase will show you a `firebaseConfig` object that looks like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "monarch-chess.firebaseapp.com",
     databaseURL: "https://monarch-chess-default-rtdb.firebaseio.com",
     projectId: "monarch-chess",
     storageBucket: "monarch-chess.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

5. Copy those exact values into **`js/firebase-config.js`**, replacing the `YOUR_...` placeholders.

## 2. Enable Realtime Database

1. In the Firebase console, open **Build → Realtime Database**.
2. Click **Create Database**. Choose a location close to your players.
3. Start in **locked mode** (we'll paste real rules next).
4. Once created, open the **Rules** tab and paste the contents of `database.rules.json` from this project, then click **Publish**.

These rules let anyone *read* room state (needed for spectators/future features) but only let a player write to the seat (`white`/`black`) they already occupy, based on a per-device player ID — this stops a stranger from overwriting someone else's seat in a room they're not part of.

## 3. Test locally

From the project folder:

```bash
npx serve .
```

Open the printed URL in two separate browser windows (or one normal + one incognito window, so they get different local identities) to simulate two players:

1. Window A: **Create Private Game** → note the room code.
2. Window B: **Join Game** → enter that code.
3. Confirm both windows show **Opponent Connected**, then play a few moves and confirm they sync in both directions.

## 4. Deploy the static frontend to GitHub Pages

1. Push this project to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, pick your default branch and `/ (root)`, then save.
4. GitHub will publish at `https://<your-username>.github.io/<repo-name>/`. It can take a minute or two for the first deploy.
5. Because `js/firebase-config.js` already contains your real Firebase keys, multiplayer works immediately on the published site — no server to run yourself. (Realtime Database is fully managed by Firebase; your GitHub Pages site just talks to it directly over HTTPS.)

**Important:** Firebase's web API key is meant to be public (it identifies your project, not a secret credential) — this is standard for Firebase web apps. Your `database.rules.json` is what actually protects the data, not keeping the key hidden.

## 5. Two players, two devices, for real

Once deployed, share `https://<your-username>.github.io/<repo-name>/` — or a specific room's invite link (the **Copy Invite** / **Share** buttons in the lobby generate `index.html?join=CODE`, which pre-fills the join form) — with your opponent. Any two browsers, on any two devices, on any network, can now play each other.

## 6. Optional: stronger anti-cheat with Cloud Functions

The current setup validates chess moves in the browser (via chess.js) and restricts *who* can write to a room's seats. What it does **not** do is re-verify, on a server you control, that every move pushed to `fen`/`pgn`/`turn` is actually legal — a modified client could theoretically push an illegal position.

To close that gap:

1. Upgrade the Firebase project to the **Blaze (pay-as-you-go)** plan (Cloud Functions require it; the free quota is generous for a casual chess app).
2. Add a Cloud Function triggered on writes to `rooms/{code}/lastMove` that:
   - Loads the room's previous `fen`.
   - Uses `chess.js` (as a Node dependency) to verify the submitted move is legal from that position.
   - If illegal, reverts `fen`/`pgn`/`turn` to the last known-good state and flags the room.
3. Restrict direct client writes to `fen`/`pgn`/`turn` in `database.rules.json` once the function exists, so only the function (via the Admin SDK, which bypasses rules) can commit state changes.

This is intentionally left out of the base deployment so the project stays 100% static-hosting-friendly and free to run. Add it if you're taking this from a casual project to something with real stakes (ratings, wagers, tournaments).

## 7. Custom domain (optional, later)

GitHub Pages supports custom domains: **Settings → Pages → Custom domain**, add your domain, and create the DNS records GitHub shows you (a `CNAME` record pointing at `<username>.github.io`, or `A` records for an apex domain). GitHub will provision HTTPS automatically once DNS propagates.

---

## Final product checklist

**Fully implemented, working today:**
- Real 3D board and pieces (Three.js), camera rotate/zoom/pan/reset, 3 board themes, 3 piece styles
- Complete chess rules via chess.js: legal moves, check, checkmate, stalemate, castling, en passant, promotion, threefold repetition, fifty-move rule, draw, resignation
- Real-time move/clock/status sync via Firebase Realtime Database (not a local-state simulation)
- Room creation with shareable 6-character codes, copy/share invite
- Reconnection handling (per-device identity, presence via `onDisconnect`)
- 8 configurable time controls with per-move increment
- Move history, captured pieces, connection status indicators
- Cinematic match-found reveal, check highlight, checkmate victory overlay, rematch flow (with color swap)
- Settings drawer: sound, graphics quality, camera sensitivity, board/piece theme, legal-move highlighting, confirm-move, animation intensity — all persisted locally
- Fully responsive desktop/mobile layout with touch camera controls
- All UI states from the brief (loading, connecting, waiting, your turn, opponent's turn, check, checkmate, draw, disconnected, reconnecting, invalid move, game not found, game full, rematch requested/accepted)

**Requires your configuration (10-minute one-time step):**
- A Firebase project + Realtime Database — see §1–2 above. Without this, the app clearly tells the user multiplayer isn't configured rather than faking it.

**Explicitly not implemented (by design, per the brief):**
- No fake payment system. The data model (`rooms`, `players`) is structured so ratings, tournaments, and a real payment provider can be layered on later.
- Full server-side anti-cheat move validation — optional Cloud Functions path documented in §6, not included by default so the project stays free/static-hosting-friendly.

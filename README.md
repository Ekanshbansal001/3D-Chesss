# MONARCH — Premium 3D Online Chess

A cinematic, real-time 3D chess experience for two players, built with plain HTML/CSS/JS, Three.js, chess.js, and Firebase Realtime Database.

## Project structure

```
/
  index.html            Landing page (create/join/play online)
  game.html              The table — 3D board, clocks, move history
  css/
    main.css             Design tokens + landing page styles
    game.css              Game-screen layout and states
  js/
    firebase-config.js    ⚠️ Edit this — your Firebase project keys
    settings.js           Local preferences (localStorage) + time controls
    audio.js               Synthesized sound effects (Web Audio API)
    chess-engine.js         Rules engine — wraps chess.js
    multiplayer.js           Realtime sync — Firebase Realtime Database
    board-scene.js            3D board + pieces — Three.js
    hero-scene.js               Landing page 3D piece
    ui.js                        DOM rendering helpers for the table
    app.js                        Landing page controller
    game.js                        Table controller (ties everything together)
  assets/
    favicon.svg
  database.rules.json     Firebase Realtime Database security rules
  DEPLOYMENT.md            Step-by-step setup + deployment guide
```

## Before you run this

Multiplayer requires a **free Firebase project**. Nothing else in the app needs configuration — the 3D board, sounds, rules engine, and UI all run standalone. See **DEPLOYMENT.md** for the exact steps (about 10 minutes).

Until `js/firebase-config.js` is filled in, the app runs in a clearly-labeled "not configured" state rather than pretending to be multiplayer — no fake rooms, no fake opponents.

## Running locally

Because the app uses ES modules, open it through a local web server rather than a `file://` URL:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then visit `http://localhost:8080` (or the port your server prints).

## What's implemented vs. what needs your configuration

| Feature | Status |
|---|---|
| Full chess rules (legal moves, check, checkmate, stalemate, castling, en passant, promotion, threefold repetition, fifty-move rule) | ✅ via chess.js |
| Real-time 3D board, pieces, camera controls, themes | ✅ |
| Move sync, clocks, draw offers, resignation, rematch | ✅ once Firebase is connected |
| Room creation/joining with shareable codes | ✅ once Firebase is connected |
| Reconnect handling | ✅ (client identity persisted per device) |
| Client-side move validation | ✅ (chess.js) |
| Database write restrictions (only players in a room can write to it) | ✅ via `database.rules.json` |
| Full **server-side** move-legality re-validation (defense against a modified client) | ⚠️ Requires Firebase Cloud Functions — see DEPLOYMENT.md §6 |
| Payments / cosmetic purchases / subscriptions | ❌ Not implemented — architecture is ready for a real payment provider, no fake checkout included |

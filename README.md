# Escape Plan — Starter Template

A minimal client–server socket game using **Node.js + Express + Socket.IO**.

## Features implemented
- 5×5 grid, 5 obstacles, 1 tunnel (server generates random map each game)
- Two roles: **warden** and **prisoner** (randomly assigned among connected clients with nicknames)
- **Warder moves first**; **10 seconds per move** (server‑enforced, random move on timeout)
- Movement only to orthogonally adjacent cells; **warden cannot enter tunnel**, **obstacles are blocked**
- Win conditions:
  - Warder reaches prisoner → warder wins
  - Prisoner reaches tunnel → prisoner wins
- Basic scores tracking; **/admin** page shows online count and provides **Reset** button
- Game auto‑starts when at least two nicknamed clients are connected
- Simple grid UI in the browser

## Quick start
```bash
npm install
npm start
```
Open two browser windows (or two machines) to `http://<server-ip>:8080/`, set different nicknames, and play.

### Admin page
Open `http://<server-ip>:8080/admin` to see online count and reset game & scores.

## Customize
- Adjust grid size and obstacle count at the top of `server.js`
- Extend the client UI in `public/index.html`, `public/client.js`
- Add chat, power‑ups, AI bot, larger maps, etc.

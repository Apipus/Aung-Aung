# 🏃‍♂️ Escape Plan — Next.js + Express Version

This is the upgraded version of **Escape Plan**, a simple multiplayer grid-based game built with:
- **Next.js** for the frontend
- **Express + Socket.io** for the backend

---

## 🚀 Next.js (Frontend)
First, go to the `escape-plan` directory:

```bash
cd escape-plan
npm install
npm run dev
```
## 🖥️ Server (Backend)
Install dependencies and start the server with nodemon:

```bash
cd serverExpress
npm install
nodemon index.js
```

---

## 🌐 LAN Testing (Allow friends on the same Wi‑Fi to connect)

If you want someone on the same Wi‑Fi to connect to your local dev site, follow these steps.

1) Find your Wi‑Fi IPv4 address

```powershell
ipconfig
# Look for the "Wireless LAN adapter Wi‑Fi" -> "IPv4 Address" (e.g. 192.168.1.97)
```

2) Start Next.js bound to all interfaces (so other machines can reach it)

```powershell
cd .\escape-plan
npx next dev -H 0.0.0.0 -p 3000
# or set package.json dev script to: next dev -H 0.0.0.0 -p 3000
```

3) Start the backend (default port 8000)

```powershell
cd .\serverExpress
node index.js
```

4) (Optional) Force the client to use your backend address by creating `escape-plan/.env.local`:

```
NEXT_PUBLIC_SERVER_URL=http://192.168.1.97:8000
```

Restart the Next dev server after editing env.

5) Add your frontend origin to server CORS if you get CORS errors

Edit `serverExpress/index.js` and add your frontend origin (replace IP) to the CORS arrays near the top:

```js
app.use(cors({
	origin: [
		'http://localhost:3000',
		'http://192.168.1.97:3000', // <-- add this
	],
	methods: ['GET','POST']
}));

// And inside new Server(httpServer, { cors: { origin: [ ... ] } })
```

6) Ensure Windows Firewall allows incoming connections (run as Administrator)

```powershell
# Allow ping (ICMPv4)
netsh advfirewall firewall add rule name="Allow ICMPv4-In" dir=in action=allow protocol=icmpv4

# Allow Next dev (3000) and backend (8000)
netsh advfirewall firewall add rule name="NextJS 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Backend 8000" dir=in action=allow protocol=TCP localport=8000
```

To remove the rules later, use `netsh advfirewall firewall delete rule name="..."`.

7) Test from your friend's computer

- Ping your machine:
	`ping 192.168.1.97`
- Open the frontend in a browser:
	`http://192.168.1.97:3000`
- If the page loads but sockets fail, check browser console for CORS/websocket errors and server logs for connection attempts.

Troubleshooting
- If `ping` fails even after firewall rules, check that both devices are on the same SSID (not a guest/isolated network).
- Make sure you use the Wi‑Fi adapter IP (e.g. 192.168.1.97), not a VM/host‑only adapter (e.g. 192.168.56.1) or 127.0.0.1.
- If the router enables client isolation (AP isolation), disable it or use a non‑guest network.

If you want, I can apply the CORS change and create `.env.local` for you — tell me and I'll add them.

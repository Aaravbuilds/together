# Together — YouTube, multiplayer

An experimental Chrome extension for native YouTube tabs. Two modes: **Watch Party** and **Study Room**. Local-first prototype, not production-ready.

## Run locally

Requirements: Node.js 20+ and Chrome desktop.

1. In a terminal: `cd server && npm install && npm start`.
2. In another terminal: `cd extension && npm install && npm run build`.
3. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, choose `extension/dist`.
4. Open a regular `https://www.youtube.com/watch?v=...` page. Click the small **Together** floating button at the lower right.
5. Type your name, keep the server URL as `http://localhost:3100`, pick Watch Party or Study, and click **Create room**.
6. Copy the room code. Have your friends load the extension and **Join room** using that code.

**Important:** `localhost` only works when all participants' browsers are on the same computer, or when they run a room server on their own machine. For real friends on different devices, deploy the server to a reachable HTTPS host and update the extension's `manifest.json` host permissions, rebuild and reload the extension; enter the HTTPS server URL in the panel. Never expose an unprotected HTTP room server to the public internet.

### What works in the prototype

- Native YouTube video on every participant's own tab (not screen sharing)
- Room codes, names and a host; participant list
- Shared play/pause, seeking, speed changes, video switching, server-enforced guest permissions
- Study-specific timestamped shared notes; chat for both modes
- WebRTC peer-to-peer voice with mic toggle for small rooms (experimental; browser autoplay, ICE/NAT limitations apply)
- Periodic drift correction and buffering recovery attempts

### Known limitations / production checklist

- Not tested end-to-end in multiple real browsers. YouTube changes DOM and player behavior frequently.
- No accounts, passwords, invite authentication, moderation, abuse prevention, durable storage or rate limits yet. A room code is **not** secure access control. Don't share personal information in rooms.
- Voice is mesh-based, which is suitable only for small groups; production needs TURN (or an SFU such as LiveKit) for reliable cross-network calls. Chrome may require user interaction before incoming audio plays.
- This prototype does not control or skip YouTube ads; ad timing, buffering, autoplay restrictions, and site updates can prevent close synchronization.
- Rooms, chat and notes exist only in server memory; server restart erases them.
- Multiple tabs for the same user count as separate participants; one room per tab.
- Firefox and mobile browsers are not supported in this build.
- For HTTPS deployment, use proper origin restrictions, WSS, authentication, rate limiting, and privacy disclosures before public release.

## How it is structured

`server/index.js` holds authoritative room permissions and timeline, relays chat/notes and WebRTC signaling. `extension/src/content.js` injects a small floating UI, listens to the native YouTube video and Socket.IO messages, and performs WebRTC peer connections. `extension/dist` is generated with esbuild.

This project is an original starting point, not a production-ready Chrome Web Store release.

## Remote testing via Render

1. Upload the contents of the `youtube-together` directory to a private GitHub repository (so `server/` and `extension/` are at repository root).
2. Render > New > Web Service > connect repository. Set Root Directory `server`, Language `Node`, Build Command `npm install`, Start Command `npm start`, and select Free if available.
3. Once deployed, visit `https://YOUR-RENDER-HOST.onrender.com/health` and verify the JSON includes `"ok":true`. It may need some time to wake.
4. On your laptop, from `extension` run `npm install` then `npm run build`. In Chrome, go to `chrome://extensions`, remove/reload the older Together instance, and Load unpacked from `extension/dist`. After rebuilding a content script, reload your YouTube tab.
5. Open the Together panel. Change Realtime server URL from `http://localhost:3100` to `https://YOUR-RENDER-HOST.onrender.com`. Create a room, and send your friend the code and server URL.
6. Give your friend ONLY the built `extension/dist` folder zipped up; they can extract it and use Load unpacked in Chrome (no Node.js required). On their YouTube tab, enter the same server URL and room code and press Join.

This starter permits HTTPS connections to *.onrender.com in its extension manifest. For an eventual release, narrow this to your actual service origin.

**WARNING: TESTING ONLY.** This prototype has no authentication or invite security; room codes can be guessed and joining an unknown code silently creates a new room. Anyone knowing a code can enter its room. Do not use with strangers, share sensitive content, or publicly list the backend URL. Add proper create-vs-join validation, authentication/invite tokens, strict origin controls and rate limits before distributing widely. Notes and chats live only in memory, so server restarts erase them. WebRTC mic may fail between different networks without TURN.

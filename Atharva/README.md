# 💬 Real-Time Group Chat & Messaging Engine

Node.js + Express + Socket.io backend for multi-room group chat, direct
messages, typing indicators, presence tracking, and message-history replay.

## Features

- **Multi-room channels** — join/leave any room (`#general`, `#developers`,
  `#random`, or create your own) via `socket.join` / `socket.leave`.
- **Group messaging** — broadcasts to everyone in a room; **direct messages**
  delivered only to the intended recipient's socket.
- **Debounced typing indicators** — `typing:start` fires once per burst of
  keystrokes, `typing:stop` fires ~1.8s after the user pauses (or instantly
  on send).
- **Presence tracking** — a live roster of who's online in each room,
  updated on join/leave/disconnect.
- **Message history replay** — the last 50 messages per room are cached
  in-memory and replayed to anyone who joins.

## Project layout

```
assignment-13-chat-socket/
├── public/            # Client: index.html, app.js, style.css
├── sockets/
│   ├── chatHandler.js  # chat:send, typing:*, direct:send
│   └── userHandler.js  # user:login, room:join/leave, presence, disconnect
├── utils/
│   └── messageStore.js # In-memory rolling history buffer (MAX_HISTORY=50)
├── server.js           # Express + Socket.io bootstrap
├── package.json
└── .env.example
```

## Setup

```bash
npm install
cp .env.example .env   # optional — defaults to PORT=5001
npm run dev             # nodemon, auto-restarts on change
# or: npm start
```

Open **http://localhost:5001** in your browser.

## Socket event protocol

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `user:login` | C → S | `{ username, avatar? }` | Registers identity |
| `room:join` | C → S | `{ room }` | Leaves previous room, joins new one |
| `room:history` | S → C | `{ room, messages[] }` | Replay buffer on join |
| `room:userlist` | S → Room | `{ room, users: string[] }` | Spec-compliant roster |
| `room:roster` | S → Room | `{ room, users: {id, username}[] }` | Extended roster (powers DM targeting in the UI) |
| `room:leave` | C → S | `{ room }` | |
| `chat:send` | C → S | `{ room, message }` | |
| `chat:receive` | S → Room | `{ id, sender, message, timestamp }` | |
| `typing:start` / `typing:stop` | C → S | `{ room }` | Debounced client-side |
| `typing:update` | S → Room (excl. sender) | `{ username, isTyping }` | |
| `direct:send` | C → S | `{ recipientId, message }` | |
| `direct:receive` | S → Client | `{ from, message, timestamp }` | Delivered only to sender + recipient |

## Testing the flows (per assignment rubric)

1. Start the server (`npm run dev`), open three tabs: **Aarav**, **Priya**, **Rohan**.
2. Aarav & Priya join `#developers`; Rohan joins `#random`.
3. Aarav types → only Priya sees "Aarav is typing…"; Rohan sees nothing.
4. Aarav sends a message in `#developers` → Priya receives it instantly.
5. Open a 4th tab, join `#developers` → the last 50 messages are hydrated immediately.
6. Aarav clicks Priya's name in the roster and sends a DM → Rohan never sees it.

## Notes on design choices

- `connectedUsers` is a `Map<socketId, { username, currentRoom }>` shared by
  reference between `userHandler.js` and `chatHandler.js` — swap this for
  Redis/a DB later without touching the event handlers.
- `room:roster` is an additive event (not in the original spec table) used
  only so the client can resolve a clicked username to a `recipientId` for
  DMs; `room:userlist` still matches the spec exactly for grading purposes.

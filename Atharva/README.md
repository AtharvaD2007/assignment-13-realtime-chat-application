# Assignment 13 - Real-Time Group Chat & Messaging Engine

A real-time group chat application built using Node.js, Express.js and Socket.io. The application supports multiple chat rooms, real-time messaging, typing indicators, active user presence, direct messages and message history.

## 🚀 Live Deployment

**Frontend:**  
https://assignment-13-realtime-chat-applica.vercel.app/

**Backend:**  
https://assignment-13-realtime-chat-application-bybd.onrender.com

## 🛠️ Tech Stack

- Node.js
- Express.js
- Socket.io
- CORS
- HTML
- CSS
- JavaScript
- In-Memory Storage

## ✨ Features

- 👤 User login with username
- 💬 Real-time group messaging
- 🏠 Multiple chat rooms
- ➕ Dynamic room creation
- ⌨️ Real-time typing indicators
- 🟢 Active user presence
- 🔒 Direct/private messaging
- 📝 Message history
- 🔄 Real-time Socket.io communication
- 📡 Room-based message broadcasting

## 📡 Socket Events

| Event | Description |
|---|---|
| `user:login` | Registers a user |
| `room:join` | Joins a chat room |
| `room:history` | Sends previous room messages |
| `room:userlist` | Updates active users |
| `chat:send` | Sends a group message |
| `chat:receive` | Receives a group message |
| `typing:start` | User starts typing |
| `typing:stop` | User stops typing |
| `typing:update` | Updates typing status |
| `direct:send` | Sends a private message |
| `direct:receive` | Receives a private message |

## 📁 Project Structure

```text
assignment-13-realtime-chat-application/
│
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── sockets/
│   ├── chatHandler.js
│   └── userHandler.js
│
├── utils/
│   └── messageStore.js
│
├── server.js
├── package.json
└── README.md

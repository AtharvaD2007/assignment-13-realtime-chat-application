/**
 * server.js
 * -----------------------------------------------------------------------
 * Express & Socket.io bootstrap for the Real-Time Group Chat & Messaging
 * Engine (Assignment 13).
 * -----------------------------------------------------------------------
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const { registerUserHandlers } = require("./sockets/userHandler");
const { registerChatHandlers } = require("./sockets/chatHandler");

const PORT = process.env.PORT || 5001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

// socketId -> { username, avatar, currentRoom }
// Shared in-memory registry, passed by reference into both handler modules.
const connectedUsers = new Map();

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", connected: connectedUsers.size });
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerUserHandlers(io, socket, connectedUsers);
  registerChatHandlers(io, socket, connectedUsers);

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Chat server running at http://localhost:${PORT}`);
});

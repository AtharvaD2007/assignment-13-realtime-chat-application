/**
 * sockets/chatHandler.js
 * -----------------------------------------------------------------------
 * Handles room broadcast messaging, direct messages, and typing indicator
 * relay. The actual debounce timing lives client-side (app.js); the server
 * simply relays start/stop state changes to the room.
 * -----------------------------------------------------------------------
 */

const { addMessageToHistory } = require("../utils/messageStore");

function registerChatHandlers(io, socket, connectedUsers) {
  // --- chat:send -> chat:receive (room broadcast) ---------------------
  socket.on("chat:send", ({ room, message } = {}) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !room || !message || !message.trim()) return;
    if (user.currentRoom !== room) return; // guard against spoofed rooms

    const messageObj = addMessageToHistory(room, {
      sender: user.username,
      message: message.trim(),
    });

    io.to(room).emit("chat:receive", messageObj);

    // Sending a message implicitly stops typing for that user
    socket.to(room).emit("typing:update", {
      username: user.username,
      isTyping: false,
    });
  });

  // --- typing:start / typing:stop -> typing:update --------------------
  socket.on("typing:start", ({ room } = {}) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !room || user.currentRoom !== room) return;

    socket.to(room).emit("typing:update", {
      username: user.username,
      isTyping: true,
    });
  });

  socket.on("typing:stop", ({ room } = {}) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !room || user.currentRoom !== room) return;

    socket.to(room).emit("typing:update", {
      username: user.username,
      isTyping: false,
    });
  });

  // --- direct:send -> direct:receive (private, single recipient) -----
  socket.on("direct:send", ({ recipientId, message } = {}) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !recipientId || !message || !message.trim()) return;
    if (!connectedUsers.has(recipientId)) {
      socket.emit("error:message", { message: "That user is no longer online." });
      return;
    }

    const payload = {
      from: user.username,
      fromId: socket.id,
      message: message.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    io.to(recipientId).emit("direct:receive", payload);
    // Echo back to sender so their own DM window shows the sent message
    socket.emit("direct:receive", { ...payload, self: true });
  });
}

module.exports = { registerChatHandlers };

/**
 * sockets/userHandler.js
 * -----------------------------------------------------------------------
 * Handles identity registration, room join/leave, presence rosters and
 * disconnect cleanup.
 * -----------------------------------------------------------------------
 */

const { getHistory, listRooms } = require("../utils/messageStore");

/** Builds the online-users list (usernames only) per the protocol spec. */
function getRoomUserList(connectedUsers, room) {
  const users = [];
  for (const info of connectedUsers.values()) {
    if (info.currentRoom === room) users.push(info.username);
  }
  return users;
}

/**
 * Builds a { id, username } roster for a room. This is a superset of
 * room:userlist used to power the direct-message UI, which needs each
 * user's socket id as the DM target.
 */
function getRoomRoster(connectedUsers, room) {
  const roster = [];
  for (const [id, info] of connectedUsers.entries()) {
    if (info.currentRoom === room) roster.push({ id, username: info.username });
  }
  return roster;
}

/** Emits both the spec-compliant userlist and the detailed roster for a room. */
function broadcastRoomPresence(io, connectedUsers, room) {
  io.to(room).emit("room:userlist", {
    room,
    users: getRoomUserList(connectedUsers, room),
  });
  io.to(room).emit("room:roster", {
    room,
    users: getRoomRoster(connectedUsers, room),
  });
}

function registerUserHandlers(io, socket, connectedUsers) {
  // --- user:login ---------------------------------------------------
  socket.on("user:login", ({ username, avatar } = {}) => {
    if (!username || typeof username !== "string") {
      socket.emit("error:message", { message: "A valid username is required." });
      return;
    }

    connectedUsers.set(socket.id, {
      username: username.trim(),
      avatar: avatar || null,
      currentRoom: null,
    });

    socket.emit("user:login:ack", {
      socketId: socket.id,
      username: username.trim(),
      rooms: listRooms(),
    });
  });

  // --- room:join -------------------------------------------------------
  socket.on("room:join", ({ room } = {}) => {
    const user = connectedUsers.get(socket.id);
    if (!user) {
      socket.emit("error:message", { message: "Please login before joining a room." });
      return;
    }
    if (!room || typeof room !== "string") return;

    const previousRoom = user.currentRoom;
    if (previousRoom === room) return; // already there

    // Leave the previous room cleanly first
    if (previousRoom) {
      socket.leave(previousRoom);
      socket.to(previousRoom).emit("typing:update", {
        username: user.username,
        isTyping: false,
      });
    }

    socket.join(room);
    user.currentRoom = room;

    // Hydrate the joiner with the replay buffer for this room
    socket.emit("room:history", {
      room,
      messages: getHistory(room),
    });

    // Update presence rosters for both the old and new room
    if (previousRoom) broadcastRoomPresence(io, connectedUsers, previousRoom);
    broadcastRoomPresence(io, connectedUsers, room);
  });

  // --- room:leave --------------------------------------------------------
  socket.on("room:leave", ({ room } = {}) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !room) return;

    socket.leave(room);
    if (user.currentRoom === room) user.currentRoom = null;

    broadcastRoomPresence(io, connectedUsers, room);
  });

  // --- disconnect ----------------------------------------------------
  socket.on("disconnect", () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const { currentRoom, username } = user;
    connectedUsers.delete(socket.id);

    if (currentRoom) {
      socket.to(currentRoom).emit("typing:update", { username, isTyping: false });
      broadcastRoomPresence(io, connectedUsers, currentRoom);
    }
  });
}

module.exports = { registerUserHandlers, getRoomUserList, getRoomRoster };

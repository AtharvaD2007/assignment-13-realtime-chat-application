/**
 * utils/messageStore.js
 * -----------------------------------------------------------------------
 * In-memory chat history store. Keeps the last MAX_HISTORY messages per
 * room and hydrates new joiners with a replay buffer.
 *
 * Swappable: replace the internal Map with a real database (Mongo, Redis,
 * Postgres) later without changing the public function signatures below.
 * -----------------------------------------------------------------------
 */

const MAX_HISTORY = 50;

// room name -> array of message objects
const roomHistories = new Map([
  ["general", []],
  ["developers", []],
  ["random", []],
]);

let messageCounter = 0;

/** Ensures a room bucket exists (supports ad-hoc rooms like #gaming, #tech). */
function ensureRoom(room) {
  if (!roomHistories.has(room)) {
    roomHistories.set(room, []);
  }
  return roomHistories.get(room);
}

/** Builds a normalized message object and appends it to a room's history. */
function addMessageToHistory(room, { sender, message }) {
  const history = ensureRoom(room);

  const messageObj = {
    id: `msg_${Date.now()}_${++messageCounter}`,
    room,
    sender,
    message,
    timestamp: new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  history.push(messageObj);
  if (history.length > MAX_HISTORY) {
    history.shift(); // drop oldest to keep a rolling buffer
  }

  return messageObj;
}

/** Returns the current replay buffer for a room (creates an empty one if new). */
function getHistory(room) {
  return ensureRoom(room);
}

/** Returns the list of known room names. */
function listRooms() {
  return Array.from(roomHistories.keys());
}

module.exports = {
  MAX_HISTORY,
  addMessageToHistory,
  getHistory,
  listRooms,
};

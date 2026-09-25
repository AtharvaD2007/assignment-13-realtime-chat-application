/**
 * Wire - Real-Time Group Chat
 * Client-side Socket.io application
 */

const DEFAULT_ROOMS = ["general", "developers", "random"];
const TYPING_DELAY = 1800;

const socket = io({ transports: ["websocket", "polling"] });

let myUsername = "";
let mySocketId = "";
let currentRoom = "";
let typingTimer = null;
let isTyping = false;
let typingUsers = new Set();
let dmTargetId = null;
let dmTargetName = "";
const dmHistories = new Map();
const knownRooms = new Set(DEFAULT_ROOMS);

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const loginError = document.getElementById("loginError");
const meLabel = document.getElementById("meLabel");
const roomListEl = document.getElementById("roomList");
const newRoomForm = document.getElementById("newRoomForm");
const newRoomInput = document.getElementById("newRoomInput");
const connStatus = document.getElementById("connStatus");
const activeRoomTitle = document.getElementById("activeRoomTitle");
const typingLine = document.getElementById("typingLine");
const messageLog = document.getElementById("messageLog");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const userListEl = document.getElementById("userList");
const dmLog = document.getElementById("dmLog");
const dmForm = document.getElementById("dmForm");
const dmInput = document.getElementById("dmInput");

// ---------- Connection ----------
socket.on("connect", () => {
  mySocketId = socket.id;
  setConnectionStatus(true);
  console.log("Socket connected:", socket.id);

  // Re-register after a reconnect.
  if (myUsername) {
    socket.emit("user:login", { username: myUsername });
  }
});

socket.on("disconnect", (reason) => {
  setConnectionStatus(false);
  console.log("Socket disconnected:", reason);
});

function setConnectionStatus(online) {
  if (!connStatus) return;
  connStatus.classList.toggle("online", online);
  const textNode = connStatus.lastChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    textNode.textContent = online ? " online" : " disconnected";
  }
}

// ---------- Login ----------
loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  if (!username) {
    showLoginError("Please enter your name.");
    return;
  }

  if (!socket.connected) {
    showLoginError("Server is not connected. Please refresh the page.");
    return;
  }

  hideLoginError();
  socket.emit("user:login", { username });
});

socket.on("user:login:ack", (data = {}) => {
  console.log("Login acknowledged:", data);

  myUsername = data.username || usernameInput.value.trim();
  mySocketId = data.socketId || socket.id;

  (data.rooms || DEFAULT_ROOMS).forEach((room) => knownRooms.add(room));

  meLabel.textContent = myUsername;
  loginScreen.hidden = true;
  appScreen.hidden = false;

  renderRoomList();
  joinRoom("general", true);
  messageInput.focus();
});

socket.on("error:message", ({ message } = {}) => {
  const text = message || "Something went wrong.";
  if (loginScreen.hidden === false) showLoginError(text);
  else appendSystemNote(text);
});

function showLoginError(text) {
  loginError.textContent = text;
  loginError.hidden = false;
}

function hideLoginError() {
  loginError.textContent = "";
  loginError.hidden = true;
}

// ---------- Rooms ----------
function renderRoomList() {
  roomListEl.innerHTML = "";

  knownRooms.forEach((room) => {
    const li = document.createElement("li");
    li.textContent = room;
    li.dataset.room = room;
    if (room === currentRoom) li.classList.add("active");
    li.addEventListener("click", () => joinRoom(room));
    roomListEl.appendChild(li);
  });
}

function joinRoom(room, force = false) {
  if (!room) return;
  if (!force && room === currentRoom) return;
  if (!socket.connected) return;

  stopTyping();
  currentRoom = room;
  knownRooms.add(room);
  dmTargetId = null;
  dmTargetName = "";
  dmForm.hidden = true;

  activeRoomTitle.textContent = `#${room}`;
  messageInput.placeholder = `Message #${room}`;
  messageLog.innerHTML = "";
  userListEl.innerHTML = "";
  typingUsers.clear();
  renderTyping();
  renderRoomList();

  socket.emit("room:join", { room });
}

newRoomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const room = newRoomInput.value.trim().replace(/^#/, "");
  if (!room) return;
  newRoomInput.value = "";
  joinRoom(room);
});

socket.on("room:history", ({ room, messages = [] } = {}) => {
  if (room !== currentRoom) return;

  messageLog.innerHTML = "";

  if (messages.length === 0) {
    appendSystemNote(`No messages yet in #${room}. Say hello!`);
  } else {
    messages.forEach(renderMessage);
  }

  scrollToBottom();
});

// ---------- Group chat ----------
socket.on("chat:receive", (data = {}) => {
  if (data.room !== currentRoom) return;
  renderMessage(data);
  scrollToBottom();
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (!message || !currentRoom || !socket.connected) return;

  socket.emit("chat:send", {
    room: currentRoom,
    message
  });

  messageInput.value = "";
  stopTyping();
  messageInput.focus();
});

function renderMessage({ sender = "", message = "", timestamp = "" }) {
  const div = document.createElement("div");
  div.className = "msg" + (sender === myUsername ? " own" : "");

  div.innerHTML = `
    <div class="meta">
      <span class="sender">${escapeHtml(sender)}</span>
      <span class="time">${escapeHtml(timestamp)}</span>
    </div>
    <div class="body">${escapeHtml(message)}</div>
  `;

  messageLog.appendChild(div);
}

function appendSystemNote(text) {
  const div = document.createElement("div");
  div.className = "system-note";
  div.textContent = text;
  messageLog.appendChild(div);
}

// ---------- Typing ----------
messageInput.addEventListener("input", () => {
  if (!currentRoom || !socket.connected) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit("typing:start", { room: currentRoom });
  }

  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, TYPING_DELAY);
});

function stopTyping() {
  clearTimeout(typingTimer);

  if (isTyping && currentRoom && socket.connected) {
    socket.emit("typing:stop", { room: currentRoom });
  }

  isTyping = false;
}

socket.on("typing:update", ({ username, isTyping: remoteTyping } = {}) => {
  if (!username || username === myUsername) return;

  if (remoteTyping) typingUsers.add(username);
  else typingUsers.delete(username);

  renderTyping();
});

function renderTyping() {
  const names = [...typingUsers];

  if (!names.length) {
    typingLine.innerHTML = "&nbsp;";
  } else if (names.length === 1) {
    typingLine.textContent = `${names[0]} is typing…`;
  } else {
    typingLine.textContent = `${names.join(", ")} are typing…`;
  }
}

// ---------- Presence ----------
socket.on("room:roster", ({ room, users = [] } = {}) => {
  if (room !== currentRoom) return;

  userListEl.innerHTML = "";

  const otherUsers = users.filter((user) => user.id !== mySocketId);

  if (!otherUsers.length) {
    const li = document.createElement("li");
    li.style.color = "var(--muted)";
    li.textContent = "Just you, for now";
    userListEl.appendChild(li);
    return;
  }

  otherUsers.forEach(({ id, username }) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot"></span> ${escapeHtml(username)}`;
    li.addEventListener("click", () => openDm(id, username));
    userListEl.appendChild(li);
  });
});

socket.on("room:userlist", (data) => {
  console.log("Room user list:", data);
});

// ---------- Direct messages ----------
function openDm(id, username) {
  dmTargetId = id;
  dmTargetName = username;
  dmForm.hidden = false;
  dmInput.placeholder = `DM ${username}…`;
  renderDmLog();
  dmInput.focus();
}

dmForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = dmInput.value.trim();
  if (!message || !dmTargetId || !socket.connected) return;

  socket.emit("direct:send", {
    recipientId: dmTargetId,
    message
  });

  dmInput.value = "";
  dmInput.focus();
});

socket.on("direct:receive", ({ from, fromId, message, timestamp, self } = {}) => {
  const peerId = self ? dmTargetId : fromId;
  if (!peerId) return;

  if (!dmHistories.has(peerId)) dmHistories.set(peerId, []);

  dmHistories.get(peerId).push({
    who: self ? "You" : from,
    message,
    timestamp,
    self: Boolean(self)
  });

  if (peerId === dmTargetId) renderDmLog();
});

function renderDmLog() {
  dmLog.innerHTML = "";

  const history = dmHistories.get(dmTargetId) || [];

  history.forEach(({ who, message, timestamp, self }) => {
    const div = document.createElement("div");
    div.className = "dm-msg" + (self ? " self" : "");
    div.innerHTML = `
      <span class="who">${escapeHtml(who)}</span>
      ·
      <span class="time">${escapeHtml(timestamp || "")}</span>
      <br>
      ${escapeHtml(message)}
    `;
    dmLog.appendChild(div);
  });

  dmLog.scrollTop = dmLog.scrollHeight;
}

// ---------- Utilities ----------
function scrollToBottom() {
  messageLog.scrollTop = messageLog.scrollHeight;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

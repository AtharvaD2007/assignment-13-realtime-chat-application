const { io } = require("socket.io-client");
const URL = "http://localhost:5001";

function connectUser(username) {
  return new Promise((resolve) => {
    const socket = io(URL, { forceNew: true, transports: ["websocket"] });
    socket.on("connect", () => {
      socket.emit("user:login", { username });
    });
    socket.once("user:login:ack", () => resolve(socket));
  });
}

(async () => {
  const aarav = await connectUser("Aarav");
  const priya = await connectUser("Priya");
  const rohan = await connectUser("Rohan");

  let priyaSawTyping = false;
  let rohanSawTyping = false;
  priya.on("typing:update", (d) => { if (d.isTyping) priyaSawTyping = true; });
  rohan.on("typing:update", (d) => { if (d.isTyping) rohanSawTyping = true; });

  let priyaGotMessage = null;
  priya.on("chat:receive", (m) => { priyaGotMessage = m; });

  let rohanGotDM = false;
  rohan.on("direct:receive", () => { rohanGotDM = true; });
  let priyaGotDM = null;
  priya.on("direct:receive", (d) => { if (!d.self) priyaGotDM = d; });

  let priyaRoster = null;
  priya.on("room:roster", (d) => { if (d.room === "developers") priyaRoster = d.users; });

  aarav.emit("room:join", { room: "developers" });
  priya.emit("room:join", { room: "developers" });
  rohan.emit("room:join", { room: "random" });

  await new Promise((r) => setTimeout(r, 300));

  aarav.emit("typing:start", { room: "developers" });
  await new Promise((r) => setTimeout(r, 300));

  aarav.emit("chat:send", { room: "developers", message: "Hey everyone!" });
  await new Promise((r) => setTimeout(r, 300));

  const aaravId = aarav.id;
  // find Priya's id from roster (aarav needs priya's id, so join order fetch via priya's own roster)
  const priyaId = priya.id;
  aarav.emit("direct:send", { recipientId: priyaId, message: "Secret DM" });
  await new Promise((r) => setTimeout(r, 300));

  console.log("Priya saw typing from Aarav:        ", priyaSawTyping);
  console.log("Rohan saw typing (should be false): ", rohanSawTyping);
  console.log("Priya received group message:       ", priyaGotMessage && priyaGotMessage.message === "Hey everyone!");
  console.log("Priya received the DM:              ", !!priyaGotDM && priyaGotDM.message === "Secret DM");
  console.log("Rohan received the DM (should be false):", rohanGotDM);
  console.log("Priya's roster includes Aarav & Priya:", JSON.stringify((priyaRoster || []).map(u => u.username)));

  // 4th tab joins developers and should get history hydration
  const kavya = await connectUser("Kavya");
  const historyPromise = new Promise((resolve) => {
    kavya.once("room:history", (d) => resolve(d));
  });
  kavya.emit("room:join", { room: "developers" });
  const history = await historyPromise;
  console.log("New joiner got history replay:      ", history.messages.some(m => m.message === "Hey everyone!"));

  process.exit(0);
})();

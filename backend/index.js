import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// In-memory storage
const rooms = new Map(); // roomId => Set of usernames
const messages = new Map(); // roomId => [ { id, username, message, time, read } ]

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // Join room
  socket.on("join", ({ roomId, username }) => {
    if (!roomId || !username) return;
    currentRoom = roomId;
    currentUser = username;
    socket.join(roomId);

    // Track users
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(username);

    // Send user list and status
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
    io.to(roomId).emit("userStatus", { username, status: "online" });

    // Send previous messages
    const roomMessages = messages.get(roomId) || [];
    socket.emit("loadMessages", roomMessages);

    // console.log(`👤 ${username} joined room ${roomId}`);
  });

  // Send message
  socket.on("sendMessage", ({ roomId, username, message, time, id }) => {
    if (!roomId || !username || !message || !id) return;
    const msg = { id, username, message, time, read: false };
    if (!messages.has(roomId)) messages.set(roomId, []);
    messages.get(roomId).push(msg);

    socket.to(roomId).emit("receiveMessage", msg);
    // console.log(`💬 ${username} sent message to ${roomId}: ${message}`);
  });

  // Typing indicator
  socket.on("typing", ({ roomId, username }) => {
    if (!roomId || !username) return;
    socket.to(roomId).emit("userTyping", username);
  });

  // Read receipt
  socket.on("messageRead", ({ roomId, messageId }) => {
    if (!roomId || !messageId) return;
    const roomMsgs = messages.get(roomId);
    if (roomMsgs) {
      const msg = roomMsgs.find((m) => m.id === messageId);
      if (msg) msg.read = true;
    }
    socket.to(roomId).emit("messageReadAck", { messageId });
  });

  // Leave room manually
  socket.on("leaveRoom", ({ roomId, username }) => {
    if (!roomId || !username) return;
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(username);
      socket.leave(roomId);

      io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
      io.to(roomId).emit("userStatus", { username, status: "offline" });

    //   console.log(`🚪 ${username} left room ${roomId}`);
    }

    currentRoom = null;
    currentUser = null;
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      io.to(currentRoom).emit("userStatus", {
        username: currentUser,
        status: "offline",
      });

      console.log(`❌ ${currentUser} disconnected from ${currentRoom}`);
    } else {
      console.log("❌ User disconnected:", socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

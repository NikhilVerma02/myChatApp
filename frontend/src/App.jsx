import { useEffect, useState, useRef } from 'react';
import './App.css';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import toast, { Toaster } from 'react-hot-toast';

const socket = io("http://localhost:5000");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [userStatusMap, setUserStatusMap] = useState({});
  const [typing, setTyping] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on("userJoined", (users) => setUsers(users));
    socket.on("userTyping", (user) => {
      setTyping(`${user} is typing...`);
      setTimeout(() => setTyping(""), 1500);
    });
    socket.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
      if (document.hidden && Notification.permission === 'granted') {
        new Notification(`${data.username} says:`, { body: data.message });
      }
    });
    socket.on("userStatus", ({ username, status }) => {
      setUserStatusMap((prev) => ({ ...prev, [username]: status }));
    });
    socket.on("messageReadAck", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
    });
    socket.on("loadMessages", (msgs) => {
      const formatted = msgs.map((msg) => ({
        ...msg,
        fromSelf: msg.username === username,
      }));
      setMessages(formatted);
    });

    return () => {
      socket.off("userJoined");
      socket.off("userTyping");
      socket.off("receiveMessage");
      socket.off("userStatus");
      socket.off("messageReadAck");
      socket.off("loadMessages");
    };
  }, [username]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('🔔 Notifications enabled');
        }
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    messages.forEach((msg) => {
      if (!msg.fromSelf && !msg.read) {
        socket.emit("messageRead", { roomId, messageId: msg.id });
      }
    });
  }, [messages]);

  const joinRoom = () => {
    if (!roomId.trim() || !username.trim()) {
      toast.error('Enter both Room ID and Username');
      return;
    }
    socket.emit("join", { roomId, username });
    setJoined(true);
  };

  const createNewRoom = (e) => {
    e.preventDefault();
    const newRoomId = uuidv4();
    setRoomId(newRoomId);
    toast.success('New room created');
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom", { roomId, username });
    setJoined(false);
    setRoomId("");
    setUsername("");
    setMessages([]);
  };

  const sendMessage = () => {
    if (message.trim() === "") return;
    const msgData = {
      id: uuidv4(),
      username,
      message,
      time: new Date().toLocaleTimeString(),
    };
    socket.emit("sendMessage", { roomId, ...msgData });
    setMessages((prev) => [...prev, { ...msgData, fromSelf: true }]);
    setMessage("");
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", { roomId, username });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
      .then(() => toast.success('Room ID copied'))
      .catch(err => console.error('Copy failed:', err));
  };

  if (!joined) {
    return (
      <div className='join-container'>
        <div className="join-form">
          <h1>Join Chat Room</h1>
          <input type="text" placeholder='Room ID' value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyPress={handleKeyPress} />
          <input type="text" placeholder='Username' value={username} onChange={(e) => setUsername(e.target.value)} onKeyPress={handleKeyPress} />
          <button onClick={joinRoom}>Join</button>
          <span className='new-room-span'>
            Don't have an invite? Create &nbsp;
            <a href='' className='createNewBtn' onClick={createNewRoom}>new room</a>
          </span>
          <Toaster />
        </div>
      </div>
    );
  }

  return (
    <div className='chat-container'>
      <div className="sidebar">
        <div className="room-info">
          <h2>Chat Room</h2>
          <button onClick={copyRoomId} className='copy-btn'>Copy Room ID</button>
        </div>
        <h3>Users in Room</h3>
        <ul>
          {users.map((user, index) => (
            <li key={index}>
              {user}
              <span className={`status-dot ${userStatusMap[user] === 'online' ? 'online' : 'offline'}`}></span>
            </li>
          ))}
        </ul>
        <button className='leave-button' onClick={leaveRoom}>Leave</button>
      </div>

      <div className="chat-area">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.fromSelf ? 'self' : 'other'}`}>
              <div className="message-content">{msg.message}</div>
              <div className="message-meta">
                <span>{msg.username}</span> • <span>{msg.time}</span>
                {msg.fromSelf && msg.read && <span className="read-receipt">✅</span>}
              </div>
            </div>
          ))}
          {typing && <div className="typing-indicator">{typing}</div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input">
          <input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default App;
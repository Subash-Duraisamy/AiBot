import { useEffect, useRef, useState } from "react";
import { model } from "../ai/gemini";
import { auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { generateTodayTask } from "../utils/generateTask"; // adjust path if needed
import "../styles/chat.css";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [task, setTask] = useState("");
  const [streak, setStreak] = useState(0);
  const [completed, setCompleted] = useState(null);

  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [_user, setUser] = useState(auth.currentUser);

  const BOT_IMG = "/aibot.png";
  const USER_IMG = "/user1.png";

  function cleanText(text) {
    return text.replace(/\*\*/g, "").replace(/\*/g, "");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Subscribe to auth state and then load/generate today's task
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        loadOrCreateTodayTask(u.uid);
      } else {
        // not signed in — clear UI
        setTask("");
        setCompleted(null);
        setStreak(0);
        setMessages([]);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrCreateTodayTask(uid) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const taskRef = doc(db, "users", uid, "tasks", today);
      const snap = await getDoc(taskRef);

      if (snap.exists()) {
        const data = snap.data();
        setTask(data.task);
        setCompleted(data.completed ?? false);

        setMessages([
          {
            sender: "bot",
            text: `🔥 Hey Subash! Today’s task:\n👉 ${data.task}`,
            avatar: BOT_IMG,
          },
        ]);
      } else {
        // No task for today — generate one, write to DB inside generateTodayTask
        const generated = await generateTodayTask(uid);
        setTask(generated);
        setCompleted(false);

        setMessages([
          {
            sender: "bot",
            text: `🔥 Hey Subash! Today’s task:\n👉 ${generated}`,
            avatar: BOT_IMG,
          },
        ]);
      }

      // load streak (optional)
      const streakRef = doc(db, "users", uid, "streak", "data");
      const sSnap = await getDoc(streakRef);
      if (sSnap.exists()) setStreak(sSnap.data().currentStreak || 0);
    } catch (err) {
      console.error("Error loading/creating today's task:", err);
    }
  }

  function launchCelebration() {
    for (let i = 0; i < 20; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = `hsl(${Math.random() * 360}, 90%, 60%)`;
      piece.style.animationDuration = 0.8 + Math.random() * 0.5 + "s";
      document.body.appendChild(piece);

      setTimeout(() => piece.remove(), 1500);
    }

    const emoji = document.createElement("div");
    emoji.className = "emoji-burst";
    emoji.textContent = "🎉🔥";
    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 1500);
  }

  function launchSadEffect() {
    const container = chatContainerRef.current;
    if (!container) return;

    container.classList.add("sad-shake");
    setTimeout(() => container.classList.remove("sad-shake"), 600);

    for (let i = 0; i < 12; i++) {
      const drop = document.createElement("div");
      drop.className = "sad-drop";
      drop.style.left = Math.random() * 100 + "vw";
      drop.style.animationDuration = 0.7 + Math.random() * 0.4 + "s";
      document.body.appendChild(drop);

      setTimeout(() => drop.remove(), 1200);
    }
  }

  async function sendMessage() {
    if (!input.trim()) return;

    const textToSend = input;
    setInput("");

    const userMsg = {
      sender: "you",
      text: textToSend,
      avatar: USER_IMG,
      read: true,
    };

    setMessages((prev) => [...prev, userMsg]);

    const personality = `
You are Subash's friendly AI buddy.
Tone: simple, casual, funny, supportive.
No vulgar words. No long paragraphs.

Always answer SHORT (max 2 lines).

You remember:
- Today’s task: ${task}
- Completed today: ${completed}
- Streak: ${streak}

If user asks about task → clearly reply with today's task.
If user shows success → encourage (short).
If user shows sadness → respond gently.
User: ${textToSend}
  `;

    try {
      const result = await model.generateContent(personality);
      const reply = cleanText(result.response.text() || "");

      const botMsg = {
        sender: "bot",
        text: reply,
        avatar: BOT_IMG,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("AI error:", err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Oops, something went wrong. Try again.", avatar: BOT_IMG },
      ]);
    }

    if (/done|completed|finished/i.test(textToSend)) {
      launchCelebration();
    }
    if (/sad|not done|failed|cant/i.test(textToSend)) {
      launchSadEffect();
    }
  }

  return (
    <div className="chat-wrapper">
      <div className="chat-container" ref={chatContainerRef} role="region" aria-label="Chat container">
        <div className="chat-header">
          <h2>FiG</h2>
          <p>just us U & Me</p>
        </div>

        <div
          className="chat-body"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`msg-row ${msg.sender === "you" ? "msg-you" : "msg-bot"}`}
            >
              <img
                className="avatar"
                src={msg.avatar}
                alt={msg.sender === "you" ? "Your avatar" : "Bot avatar"}
                loading="lazy"
                width="42"
                height="42"
              />

              <div className={`bubble ${msg.sender}`}>
                {msg.text}
                {msg.sender === "you" && <span className="tick" aria-hidden>✔✔</span>}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            placeholder="Talk to your FiG Buddy…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            aria-label="Type your message"
            inputMode="text"
            autoComplete="off"
          />

          <button
            className="send-btn"
            onClick={sendMessage}
            aria-label="Send message"
            title="Send"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { model } from "../ai/gemini";
import { auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { generateTodayTask } from "../utils/generateTask";
import "../styles/chat.css";


// ----------------------
// RANDOM QUESTIONS OUTSIDE COMPONENT (NO WARNINGS)
// ----------------------
const randomQuestions = [
  "Hello da, suddenly silent… you okay?",
  "If you vanish now, should I come searching? 😭🔥",
  "Quick question: what’s one thing stressing you today?",
  "Oii… why do I feel like you’re thinking deeply?",
  "If I ask a personal question… will you run? 😭",
  "Tell me one happy memory suddenly.",
  "If life gave you one wish now, what would you choose?",
  "Why does your silence feel suspicious? 😂",
  "Who is in your mind right now… tell honestly 👀",
  "If you could restart today, what would you change?"
];


// Clean markdown symbols from output
function cleanText(text) {
  return text.replace(/\*/g, ""); 
}



export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
const [isTyping, setIsTyping] = useState(false);

  const [task, setTask] = useState("");
  const [streak, setStreak] = useState(0);
  const [completed, setCompleted] = useState(null);

  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [_user, setUser] = useState(auth.currentUser);

  const BOT_IMG = "/aibot.png";
  const USER_IMG = "/user1.png";



  // ----------------------------
  // AUTO ASK RANDOM QUESTION IF USER IS SILENT
  // ----------------------------
  useEffect(() => {
    if (!messages.length) return;

    const timer = setTimeout(() => {
      const q = randomQuestions[Math.floor(Math.random() * randomQuestions.length)];
      setMessages((prev) => [...prev, { sender: "bot", text: q, avatar: BOT_IMG }]);
    }, 1700000);

    return () => clearTimeout(timer);
  }, [messages]);



  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);



  // ----------------------------
  // AUTH LISTENER → LOAD USER + TASK
  // ----------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (u) {
        const emailName = u.email ? u.email.split("@")[0] : "User";
        const formattedName =
        emailName.charAt(0).toUpperCase() + emailName.slice(1);
        setUsername(formattedName);
        loadOrCreateTodayTask(u.uid);

      } else {
        setTask("");
        setCompleted(null);
        setStreak(0);
        setMessages([]);
      }
    });

    return () => unsub();
  }, []);



  // ----------------------------
  // LOAD OR GENERATE TODAY'S TASK
  // ----------------------------
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
            text: `🔥 Hey ${username}! Today’s task:<br><b>${data.task}</b>`,
            avatar: BOT_IMG,
          },
        ]);
      } else {
        const generated = await generateTodayTask(uid);
        setTask(generated);
        setCompleted(false);

        setMessages([
          {
            sender: "bot",
            text: `🔥 Hey ${username}! Today’s task:<br><b>${generated}</b>`,
            avatar: BOT_IMG,
          },
        ]);
      }

      const streakRef = doc(db, "users", uid, "streak", "data");
      const sSnap = await getDoc(streakRef);
      if (sSnap.exists()) setStreak(sSnap.data().currentStreak || 0);
    } catch (err) {
      console.error("Error loading today's task:", err);
    }
  }



  // ----------------------------
  // CELEBRATION
  // ----------------------------
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



  // ----------------------------
  // SAD EFFECT
  // ----------------------------
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



  // ----------------------------
  // SEND MESSAGE
  // ----------------------------
  async function sendMessage() {
    if (!input.trim()) return;

    const textToSend = input;
    setInput("");

    setMessages((prev) => [
      ...prev,
      { sender: "you", text: textToSend, avatar: USER_IMG, read: true },
    ]);

   const personality = 
   `
You are FiG — ${username}'s chaotic-funny-emotional-motivating AI soulmate friend.

Rules:
- NEVER use *, **, _, __, or any markdown formatting.
- If bold needed, ONLY use <b>this format</b>.
- Remove all asterisk symbols before replying.

Core Personality:
- Calm, warm, Buddhist-like wisdom
- Funny, teasing, light roasting, emotional but peaceful
- Tamil+English mix
- A real companion who listens deeply to user's feelings
- Can reply SHORT or LONG depending on user's emotional state

Emotional Behaviour:
- If user sounds sad, lonely, confused, hurt → reply long, gentle, comforting, like a close friend who listens.
- If user sounds happy or casual → reply short, fun, teasing.
- ALWAYS acknowledge the user's feelings before giving advice.
- Never ignore emotional hints.

Random Companion Questions:
- Randomly ask things like:
  - How is your day going?
  - What are you doing now?
  - Are you ok jii?
  - Mind calm ah or something bothering you?
  - Did you eat? Slept properly ah?

Daily vibe:
- Encourage focus, patience, mindfulness, discipline
- Remind user to breathe, be calm, let go, samsaram temporary nu sollu
- Motivate user gently, not forcefully
- Not only today's task — talk about life, emotions, day, stress, dreams, mind state

Memory:
- Today's task: ${task}
- Completed: ${completed}
- Streak: ${streak}

Advanced Behaviour:
- If convo is dull or user is silent → ask emotional/funny/flirty/companionship-style questions.
- If user loses focus → gently nudge them back.
- If user feels lonely → stay with them, reassure them you're here.
- If user shares feelings → listen fully before replying.

User said: "${textToSend}"
`;


    try {
  // Start typing indicator
  setIsTyping(true);

  const result = await model.generateContent(personality);
  const reply = cleanText(result.response.text() || "");

  // Stop typing indicator
  setIsTyping(false);

  setMessages((prev) => [
    ...prev,
    { sender: "bot", text: reply, avatar: BOT_IMG },
  ]);

} catch (err) {
  console.error("AI error:", err);

  // Stop typing indicator even on error
  setIsTyping(false);

  setMessages((prev) => [
    ...prev,
    {
      sender: "bot",
      text: "Oops da… something broke. Try again 😭",
      avatar: BOT_IMG,
    },
  ]);
}


    if (/done|completed|finished/i.test(textToSend)) launchCelebration();
    if (/sad|not done|failed|cant/i.test(textToSend)) launchSadEffect();
  }



  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="chat-wrapper">
      <div
        className="chat-container"
        ref={chatContainerRef}
        role="region"
        aria-label="Chat container"
      >
        <div className="chat-header">
          <h2>FiG</h2>
          <p>just us U & Me</p>
        </div>

        <div className="chat-body" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`msg-row ${
                msg.sender === "you" ? "msg-you" : "msg-bot"
              }`}
            >
              <img
                className="avatar"
                src={msg.avatar}
                alt={msg.sender === "you" ? "Your avatar" : "Bot avatar"}
                loading="lazy"
                width="42"
                height="42"
              />

              {/* RENDER HTML LIKE <b> AS BOLD */}
              <div
                className={`bubble ${msg.sender}`}
                dangerouslySetInnerHTML={{ __html: msg.text }}
              ></div>

              {msg.sender === "you" && (
                <span className="tick" aria-hidden>
                  ✔✔
                </span>
              )}
            </div>
          ))}
          {/* TYPING INDICATOR */}
{isTyping && (
  <div className="typing-row">
    <img className="avatar" src={BOT_IMG} width="42" height="42" />

    <div className="typing-bubble">
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
    </div>
  </div>
)}

          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            placeholder="Talk to your FiG Buddy…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            autoComplete="off"
          />

          <button className="send-btn" onClick={sendMessage}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

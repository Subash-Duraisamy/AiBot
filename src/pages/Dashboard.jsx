import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generateTodayTask } from "../utils/generateTask";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [task, setTask] = useState("");
  const [streak, setStreak] = useState(0);
  const user = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      // Load today's task
      const taskRef = doc(db, "users", user.uid, "tasks", today);
      const snap = await getDoc(taskRef);

      if (snap.exists()) {
        setTask(snap.data().task);
      } else {
        const newTask = await generateTodayTask(user.uid);
        setTask(newTask);
      }

      // Load streak
      const streakRef = doc(db, "users", user.uid, "streak", "data");
      const streakSnap = await getDoc(streakRef);

      if (streakSnap.exists()) {
        setStreak(streakSnap.data().currentStreak);
      }
    }

    loadData();
  }, [user]);

  // YES / NO Handler
  async function handleComplete(didComplete) {
    const uid = user.uid;
    const today = new Date().toISOString().split("T")[0];

    const taskRef = doc(db, "users", uid, "tasks", today);
    const streakRef = doc(db, "users", uid, "streak", "data");
    const streakSnap = await getDoc(streakRef);

    let currentStreak = 0;
    let lastUpdated = "";

    if (streakSnap.exists()) {
      currentStreak = streakSnap.data().currentStreak;
      lastUpdated = streakSnap.data().lastUpdated;
    }

    // Update streak logic
    if (didComplete) {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];

      if (lastUpdated === yesterday) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    } else {
      currentStreak = 0;
    }

    await updateDoc(streakRef, {
      currentStreak,
      lastUpdated: today,
    });

    await updateDoc(taskRef, {
      completed: didComplete,
    });

    setStreak(currentStreak);

    alert(
      didComplete
        ? "🔥 Superrr Subashhh!! You completed today's challenge!"
        : "It’s okay jii ❤️ Tomorrow we'll come back stronger!"
    );
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>Heeeyyy Subashhhh!!!! 👋🔥</h1>

      <h2>Your challenge for today:</h2>
      <h2 style={{ color: "#ff007a" }}>👉 {task}</h2>

      <br />
      <h3>🔥 Current streak: {streak} days</h3>

      <br />

      <button
        onClick={() => navigate("/chat")}
        style={{
          padding: "10px 20px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        Chat with AI 🤖
      </button>

      <br />

      <button
        onClick={() => handleComplete(true)}
        style={{
          padding: "10px 20px",
          backgroundColor: "#22c55e",
          color: "white",
          border: "none",
          marginRight: "10px",
          borderRadius: "8px",
        }}
      >
        YES ✔️
      </button>

      <button
        onClick={() => handleComplete(false)}
        style={{
          padding: "10px 20px",
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "8px",
        }}
      >
        NO ❌
      </button>
    </div>
  );
}

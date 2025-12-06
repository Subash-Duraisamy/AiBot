export const config = {
  schedule: "@daily", // runs once a day
};

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyANmG9mm9sZhfpKDmhGnt94eJ7UWOrNh38",
  authDomain: "gps-tracker-demo-e5667.firebaseapp.com",
  projectId: "gps-tracker-demo-e5667",
  storageBucket: "gps-tracker-demo-e5667.firebasestorage.app",
  messagingSenderId: "369759286645",
  appId: "1:369759286645:web:72acf3faece79c61d28f3c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// -------------------------
// Calm Daily Task Generator
// -------------------------
function generateCalmTask() {
  const tasks = [
    {
      quote: "Clarity arrives when the mind becomes gentle.",
      definition: "Peace is not the absence of noise, but balance inside it.",
      task: "Spend 3 minutes today sitting quietly and noticing your breath."
    },
    {
      quote: "Consistency shapes destiny.",
      definition: "Small daily acts create long-term strength.",
      task: "Complete one simple task today without rushing."
    },
    {
      quote: "Your thoughts become lighter when you stop fighting them.",
      definition: "Acceptance creates emotional space.",
      task: "Write down one feeling you're experiencing today."
    },
    {
      quote: "Growth happens quietly, not forcefully.",
      definition: "Gentleness is also strength.",
      task: "Organize one tiny part of your room or workspace."
    },
    {
      quote: "Focus is born from intention, not pressure.",
      definition: "A calm mind works faster.",
      task: "Spend 10 uninterrupted minutes on something meaningful."
    },
    {
      quote: "Self-compassion is the beginning of resilience.",
      definition: "You bloom when you stop blaming yourself.",
      task: "Say one kind sentence to yourself today."
    },
    {
      quote: "Stillness teaches more than chaos ever could.",
      definition: "Quiet moments reveal clarity.",
      task: "Take a slow walk or stretch for 2 minutes mindfully."
    }
  ];

  const r = tasks[Math.floor(Math.random() * tasks.length)];

  return `
<b>Quote:</b> "${r.quote}"
<b>Definition:</b> ${r.definition}
<b>Today's Gentle Task:</b> ${r.task}
  `;
}

// -------------------------
// Handler
// -------------------------
export const handler = async () => {
  const userId = "vte0Vy61V7UMrPVv3XXMD7YeEZ43";
  const today = new Date().toISOString().split("T")[0];

  // Generate beautiful calm task
  const taskText = generateCalmTask();

  const taskRef = doc(db, "users", userId, "tasks", today);

  await setDoc(taskRef, {
    task: taskText,
    completed: false,
    date: today,
    createdAt: new Date().toISOString()
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Calm daily task created successfully",
      task: taskText
    })
  };
};

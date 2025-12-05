import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

// IMPORTANT: Netlify injects GEMINI_API_KEY here
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const handler = async () => {
  const userId = "vte0Vy61V7UMrPVv3XXMD7YeEZ43"; 
  const today = new Date().toISOString().split("T")[0];

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const prompt = `
    You are Subash's motivational AI.
    Generate a short, fun, powerful challenge for the day.
  `;

  const result = await model.generateContent(prompt);
  const taskText = result.response.text();

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
      message: "Daily challenge created successfully",
      task: taskText
    })
  };
};

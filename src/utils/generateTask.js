import { model } from "../ai/gemini";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function generateTodayTask(uid) {
  const today = new Date().toISOString().split("T")[0];

  const prompt = `
    You are Subash's personal motivational friend.
    Create one short, fun, energetic challenge for today.
    Don't add any intro or quotes — just the challenge text.
  `;

  const result = await model.generateContent(prompt);
  const taskText = result.response.text();

  const taskRef = doc(db, "users", uid, "tasks", today);

  await setDoc(taskRef, {
    task: taskText,
    completed: false,
    date: today,
    createdAt: new Date().toISOString(),
  });

  return taskText;
}

// src/ai/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Log to check if env is loaded
console.log("Loaded Gemini Key?", apiKey ? "YES" : "NO");

const genAI = new GoogleGenerativeAI(apiKey);

// IMPORTANT: DO NOT put "models/" prefix
export const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash"
});

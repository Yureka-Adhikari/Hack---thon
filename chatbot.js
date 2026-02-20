import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getVertexAI,
  getGenerativeModel,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-vertexai.js";

// 1. Paste your actual config from the Firebase Console here
const firebaseConfig = {
  apiKey: "AIzaSyCWU1yZufweSez51pQptnr6ZX_FJZ3LKxc",
  authDomain: "hack---a---thon-2026.firebaseapp.com",
  projectId: "hack---a---thon-2026",
  storageBucket: "hack---a---thon-2026.firebasestorage.app",
  messagingSenderId: "566869340021",
  appId: "1:566869340021:web:875343f6c99d165b602d3c",
  measurementId: "G-CVEDYTDJT6"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);

const vertexAI = getVertexAI(app);

const model = getGenerativeModel(vertexAI, { model: "gemini-1.5-flash" });

// Export model for use in chatbot
export { model };

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getVertexAI,
  getGenerativeModel,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-vertexai.js";

// 1. Paste your actual config from the Firebase Console here
const firebaseConfig = {...
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);

const vertexAI = getVertexAI(app);

const model = getGenerativeModel(vertexAI, { model: "gemini-1.5-flash" });

// Export model for use in chatbot
export { model };

import { setupFileUpload } from "./fileHandler.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const chatBody = document.getElementById("chatBody");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const exportBtn = document.getElementById("exportChat");

let attachedFile = null;
let messages = [];

// REPLACING LEAKED KEY & INCORRECT MODEL STRING
const API_KEY = "PASTE_YOUR_NEW_KEY_HERE";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Corrected from 2.5
});

/* Send Logic */
function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  input.style.height = "auto";
  simulateAI(text);
}

function addMessage(text, type) {
  const msg = document.createElement("div");
  msg.classList.add("message", type);

  const content = document.createElement("div");
  // Use innerHTML for AI to render formatting, textContent for User for safety
  if (type === "ai") {
    content.innerHTML = text;
  } else {
    content.textContent = text;
  }

  const time = document.createElement("div");
  time.classList.add("timestamp");
  time.textContent = new Date().toLocaleTimeString([], {
    hour: "2-刻",
    minute: "2-digit",
  });

  msg.appendChild(content);
  msg.appendChild(time);
  chatBody.appendChild(msg);

  // Auto-scroll to bottom
  chatBody.scrollTop = chatBody.scrollHeight;

  messages.push({ type, text, time: time.textContent });
}

/* Clean Formatting Logic */
function formatAIResponse(text) {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>") // Bold
    .split(/\n\n+/) // Split by double newlines
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map((para) => {
      // Simple Check for lists
      if (para.includes("•") || para.match(/^\d+\./)) {
        return `<div style="margin-bottom:1rem">${para.replace(/\n/g, "<br>")}</div>`;
      }
      return `<p style="margin-bottom:1rem">${para}</p>`;
    })
    .join("");
}

async function simulateAI(userText) {
  typingIndicator.classList.remove("hidden");
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const prompt = `You are a helpful civic services assistant for CivicSewa in Nepal. User question: ${userText}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();

    typingIndicator.classList.add("hidden");
    addMessage(formatAIResponse(aiText), "ai");
  } catch (error) {
    console.error("AI Error:", error);
    typingIndicator.classList.add("hidden");
    addMessage(
      "I'm sorry, I'm having trouble connecting. Please check your API key status.",
      "ai",
    );
  }
}

/* Event Listeners */
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

attachBtn.addEventListener("click", () => fileInput.click());

exportBtn.addEventListener("click", () => {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(messages, null, 2));
  const dlAnchor = document.createElement("a");
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "chat_history.json");
  dlAnchor.click();
});

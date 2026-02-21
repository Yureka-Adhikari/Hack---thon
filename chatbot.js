
import { streamText } from "./streaming.js";
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

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI("");
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  generationConfig: {
    maxOutputTokens: 800,
    temperature: 0.9,
  }
});



/* Auto resize textarea */
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

/* Send button */
sendBtn.addEventListener("click", sendMessage);

/* Enter key send */
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

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
  content.textContent = text;

  const time = document.createElement("div");
  time.classList.add("timestamp");
  time.textContent = new Date().toLocaleTimeString();

  msg.appendChild(content);
  msg.appendChild(time);

  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;

  messages.push({ type, text, time: time.textContent });
}

/* Format AI response for better readability */
function formatAIResponse(text) {
  // Split into paragraphs and format
  let formatted = text
    // Add line breaks after periods followed by spaces
    .replace(/\. /g, '.\n\n')
    // Add line breaks after question marks
    .replace(/\? /g, '?\n\n')
    // Add line breaks after exclamation marks
    .replace(/\! /g, '!\n\n')
    // Convert numbered lists (1. 2. 3.) to proper format
    .replace(/(\d+)\.\s/g, '<br>• ')
    // Convert bullet points if they exist
    .replace(/•\s/g, '<br>• ')
    // Clean up excessive line breaks
    .replace(/\n\n\n+/g, '\n\n')
    // Convert to HTML paragraphs
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .map(paragraph => `<p>${paragraph}</p>`)
    .join('');

  return formatted;
}

/* AI Response using Google Generative AI */
async function simulateAI(userText) {
  typingIndicator.classList.remove("hidden");

  try {
    // Create a prompt for the civic services assistant
    const prompt = `You are a helpful civic services assistant for CivicSewa. Help users with their local government issues, complaints, and questions about municipal services. Be friendly, informative, and provide practical advice. 
    Remember that these questions are in the context of Nepal and may involve local government services, public utilities, transportation, waste management, and other civic issues. You can take reference of their location using the attached file if needed.

Keep your response clear and concise, but ensure it's complete and helpful. Aim for 250 words maximum and a minimum of 50 words.

User question: ${userText}

Please provide a helpful response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();

    console.log("AI Response length:", aiText.length);
    console.log("AI Response:", aiText);

    typingIndicator.classList.add("hidden");

    const msg = document.createElement("div");
    msg.classList.add("message", "ai");

    const content = document.createElement("div");
    msg.appendChild(content);

    const time = document.createElement("div");
    time.classList.add("timestamp");
    time.textContent = new Date().toLocaleTimeString();
    msg.appendChild(time);

    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Display the full response immediately instead of streaming
    // Format the response for better readability
    const formattedText = formatAIResponse(aiText);
    content.innerHTML = formattedText;

    messages.push({
      type: "ai",
      text: formattedText,
      time: time.textContent,
    });
  } catch (error) {
    console.error("Error generating AI response:", error);
    typingIndicator.classList.add("hidden");

    const msg = document.createElement("div");
    msg.classList.add("message", "ai");

    const content = document.createElement("div");

    if (error.message.includes("429") || error.message.includes("quota")) {
      const errorText = "I've reached my daily limit for AI responses. The quota resets at midnight UTC. Please try again tomorrow, or consider upgrading to a paid plan at https://ai.google.dev/gemini-api/docs/pricing";
      content.innerHTML = formatAIResponse(errorText);
    } else {
      const errorText = "Sorry, I'm having trouble connecting to the AI service right now. Please try again later.";
      content.innerHTML = formatAIResponse(errorText);
    }

    msg.appendChild(content);

    const time = document.createElement("div");
    time.classList.add("timestamp");
    time.textContent = new Date().toLocaleTimeString();
    msg.appendChild(time);

    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;

    messages.push({
      type: "ai",
      text: content.innerHTML,
      time: time.textContent,
    });
  }
}

/* File Upload */
attachBtn.addEventListener("click", () => {
  fileInput.click();
});

setupFileUpload(fileInput, (file) => {
  attachedFile = file;
  addMessage(`📎 Attached file: ${file.name}`, "user");
});

/* Export Chat */
exportBtn.addEventListener("click", () => {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(messages, null, 2));

  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "chat_export.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});
//API


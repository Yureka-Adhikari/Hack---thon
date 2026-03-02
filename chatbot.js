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
const API_KEY = "AIzaSyC2R-7E1XV9tJr-5FsVwnaJ4Q7PPlgZ9O8";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", // Corrected from 2.5
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
  if (type === "ai") {
    content.innerHTML = text;
  } else {
    content.textContent = text;
  }

  const time = document.createElement("div");
  time.classList.add("timestamp");
  time.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  msg.appendChild(content);
  msg.appendChild(time);
  chatBody.appendChild(msg);

  // Auto-scroll to latest message
  chatBody.scrollTop = chatBody.scrollHeight;

  messages.push({ type, text, time: time.textContent });
}

/* AI Formatting Logic */
function formatAIResponse(text) {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n\n+/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map((para) => {
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

/* Export Chat as PDF */
exportBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("CivicSewa Chat History", 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 30);

  const tableRows = messages.map(msg => [
    msg.time,
    msg.type.toUpperCase(),
    msg.text.replace(/<[^>]*>?/gm, '') // Remove HTML tags for PDF
  ]);

  doc.autoTable({
    startY: 35,
    head: [['Time', 'Sender', 'Message']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [42, 75, 121] }, // Fixed: RGB for #2A4B79
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 'auto' }
    },
    styles: { overflow: 'linebreak', cellPadding: 5 }
  });

  doc.save("CivicSewa_Chat_Export.pdf");
});

attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  const file = e.target.files;
  if (file) {
    attachedFile = file;
    addMessage(`📎 Attached file: ${file.name}`, "user");
  }
});
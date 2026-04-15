import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateText } from "../core/translator.js";

// ================= TRANSLATIONS =================
const translations = {
  en: {
    pageTitle: "AI Guidance Chatbot",
    pageSubtitle: "Ask questions about civic regulations, procedures, and municipal services.",
    assistantName: "CivicSewa Assistant",
    exportBtn: "Export PDF",
    inputPlaceholder: "Describe your issue or ask a question...",
    welcomeMsg: "Hello! I'm your CivicSewa AI assistant. How can I help you with your local municipal issues or Smart Sifarish today?",
    thinking: "AI is thinking",
    errorMsg: "I'm sorry, I'm having trouble connecting. Please check your API key status.",
    attachLabel: "Attach Document",
    searchPlaceholder: "Search...",
  },
  np: {
    pageTitle: "एआई मार्गदर्शन च्याटबोट",
    pageSubtitle: "नागरिक नियमहरू, प्रक्रियाहरू र नगरपालिका सेवाहरूबारे प्रश्न सोध्नुहोस्।",
    assistantName: "CivicSewa सहायक",
    exportBtn: "PDF निर्यात",
    inputPlaceholder: "आफ्नो समस्या वर्णन गर्नुहोस् वा प्रश्न सोध्नुहोस्...",
    welcomeMsg: "नमस्ते! म तपाईंको CivicSewa एआई सहायक हुँ। स्थानीय नगरपालिका समस्या वा Smart Sifarish बारे कसरी सहयोग गर्न सक्छु?",
    thinking: "एआई सोच्दैछ",
    errorMsg: "माफ गर्नुहोस्, जडान गर्न समस्या भयो। कृपया पुनः प्रयास गर्नुहोस्।",
    attachLabel: "कागजात संलग्न",
    searchPlaceholder: "खोज्नुहोस्...",
  }
};

function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    const data = snap.data();
    const nameEl   = document.getElementById("uNameTop");
    const wardEl   = document.getElementById("uWard");
    const avatarEl = document.getElementById("userAvatar");
    if (nameEl)   nameEl.innerText = data.fullName || "Citizen";
    if (wardEl)   wardEl.innerText = `Ward ${data.wardNumber || "--"}, ${data.municipality || "--"}`;
    if (avatarEl) avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName || "Citizen")}&background=random`;
  }
  applyLanguage(localStorage.getItem("lang") || "en");
});

// ================= LANGUAGE =================
function applyLanguage(lang) {
  // Static labels
  const el = (id) => document.getElementById(id);
  const set = (id, key) => { const e = el(id); if (e) e.innerText = t(key); };

  set("pageTitleEl",    "pageTitle");
  set("pageSubtitleEl", "pageSubtitle");
  set("assistantNameEl","assistantName");
  set("exportChat",     "exportBtn");

  const inp = el("chatInput");
  if (inp) inp.placeholder = t("inputPlaceholder");

  const search = document.querySelector('.search-container input');
  if (search) search.placeholder = t("searchPlaceholder");

  const thinking = el("thinkingText");
  if (thinking) thinking.innerText = t("thinking");

  // Update welcome message if it hasn't been overwritten
  const welcomeEl = document.getElementById("welcomeMsg");
  if (welcomeEl) welcomeEl.innerText = t("welcomeMsg");
}

const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  const stored = localStorage.getItem("lang") || "en";
  langSelect.value = stored;
  langSelect.addEventListener("change", () => {
    localStorage.setItem("lang", langSelect.value);
    applyLanguage(langSelect.value);
  });
}

// ================= AI SETUP =================
const API_KEY = "AIzaSyB3GD-gjGMdypbjCxE9adC-ZT00h88vn-E"; // Add your Gemini API key here
// Using fetch directly — avoids SDK version/API compatibility issues

const chatBody        = document.getElementById("chatBody");
const input           = document.getElementById("chatInput");
const sendBtn         = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const fileInput       = document.getElementById("fileInput");
const attachBtn       = document.getElementById("attachBtn");
const exportBtn       = document.getElementById("exportChat");

let attachedFile = null;
let messages = [];
// Conversation history for context
let conversationHistory = [];

// ================= SEND =================
function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, "user");
  input.value = "";
  input.style.height = "auto";
  simulateAI(text);
}

function addMessage(text, type) {
  const msg     = document.createElement("div");
  msg.classList.add("message", type);
  const content = document.createElement("div");
  content.classList.add("content");
  if (type === "ai") content.innerHTML = text;
  else content.textContent = text;
  const time = document.createElement("div");
  time.classList.add("timestamp");
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  msg.appendChild(content);
  msg.appendChild(time);
  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
  messages.push({ type, text, time: time.textContent });
}

// ================= FORMAT =================
function formatAIResponse(text) {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n\n+/)
    .map(para => para.trim())
    .filter(para => para.length > 0)
    .map(para => {
      if (para.includes("•") || para.match(/^\d+\./))
        return `<div style="margin-bottom:1rem">${para.replace(/\n/g, "<br>")}</div>`;
      return `<p style="margin-bottom:1rem">${para}</p>`;
    })
    .join("");
}

// ================= AI CALL =================
async function simulateAI(userText) {
  typingIndicator.classList.remove("d-none");
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const lang = localStorage.getItem("lang") || "en";
    const langInstruction = lang === "np"
      ? "Always respond in Nepali (Devanagari script)."
      : "Always respond in English.";

    // Build full conversation as a single prompt with history context
    const systemPrompt = `You are a helpful civic services assistant for CivicSewa, a digital governance platform for Nepal. You help citizens with municipal procedures, ward office processes, Smart Sifarish, issue reporting, and local government regulations. ${langInstruction} Keep responses concise and practical.`;

    // Build conversation context from history
    let historyContext = "";
    if (conversationHistory.length > 0) {
      historyContext = conversationHistory.slice(-10).map(m =>
        `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`
      ).join("") + "";
    }

    const fullPrompt = `${systemPrompt}

${historyContext}User: ${userText}
Assistant:`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || t("errorMsg");

    // Save to history
    conversationHistory.push({ role: "user",  text: userText });
    conversationHistory.push({ role: "model", text: aiText });
    if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

    typingIndicator.classList.add("d-none");
    addMessage(formatAIResponse(aiText), "ai");
  } catch (error) {
    console.error("AI Error:", error);
    typingIndicator.classList.add("d-none");
    addMessage(t("errorMsg"), "ai");
  }
}

// ================= EVENT LISTENERS =================
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ================= PDF EXPORT =================
exportBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("CivicSewa Chat History", 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 30);
  const tableRows = messages.map(msg => [
    msg.time, msg.type.toUpperCase(), msg.text.replace(/<[^>]*>?/gm, "")
  ]);
  doc.autoTable({
    startY: 35,
    head: [["Time", "Sender", "Message"]],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [42, 75, 121] },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 25 }, 2: { cellWidth: "auto" } },
    styles: { overflow: "linebreak", cellPadding: 5 },
  });
  doc.save("CivicSewa_Chat_Export.pdf");
});


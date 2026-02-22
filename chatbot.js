import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// ⚠️ WARNING: Hardcoding your API Key in frontend code is only for local prototyping.
// Anyone can see this key in your "Inspect Element" Network tab.
const API_KEY = "AIzaSyDz6qZI7UjccBpMvIZqQdpg0c7hPLe0zCY";

const genAI = new GoogleGenerativeAI(API_KEY);

// Use the base model (no vertexai wrapper needed)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export { model };
async function getAIResponse(text) {
  try {
    const result = await model.generateContent(text);
    const response = await result.response;
    return response.text();
  } catch (error) {
    // This will now catch specific error messages like "Safety Block"
    console.error("Gemini Error:", error);
    return "Sorry, I can't answer that right now. Please try again in a moment.";
  }
}
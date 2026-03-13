import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWU1yZufweSez51pQptnr6ZX_FJZ3LKxc",
  authDomain: "hack---a---thon-2026.firebaseapp.com",
  projectId: "hack---a---thon-2026",
  storageBucket: "hack---a---thon-2026.firebasestorage.app",
  messagingSenderId: "566869340021",
  appId: "1:566869340021:web:875343f6c99d165b602d3c",
  measurementId: "G-CVEDYTDJT6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);

try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics blocked by client, but app will continue to run.");
}

export { analytics };

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "dashboard.html";
});

// Login Logic
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    console.error("Login Error:", e);
    alert("Login Error: " + e.message);
  }
});

// Register Logic
document.getElementById("registerBtn").addEventListener("click", async () => {
  const email = document.getElementById("regEmail").value;
  const pass = document.getElementById("regPass").value;
  const name = document.getElementById("fullName").value;
  const ward = document.getElementById("ward").value;
  const muni = document.getElementById("muni").value;

  if (!email || !pass) return alert("Please provide email and password.");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    console.log("User created:", cred.user.uid);
    // Save user data to Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      fullName: name || "",
      wardNumber: ward || "",
      municipality: muni || "",
      email: email,
    });
    console.log("User document written for:", cred.user.uid);
    // Redirect to dashboard
    window.location.href = "dashboard.html";
  } catch (e) {
    console.error("Registration Error:", e);
    alert("Registration Error: " + e.message);
  }
});

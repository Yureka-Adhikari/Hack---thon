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

// Auto-redirect if already logged in
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

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // Save user data to Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      fullName: name,
      wardNumber: ward,
      municipality: muni,
      email: email,
    });
  } catch (e) {
    alert("Registration Error: " + e.message);
  }
});

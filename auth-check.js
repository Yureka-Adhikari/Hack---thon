import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Check if email is verified
    user.reload().then(() => {
      if (user.emailVerified) {
        window.location.href = "dashboard.html";
      } else {
        // Email not verified, show verification modal
        document.getElementById("verifyEmail").textContent = user.email;
        const verificationModal = new bootstrap.Modal(document.getElementById("verificationModal"));
        verificationModal.show();
      }
    });
  }
});

// Login Logic
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, pass);
      await userCred.user.reload();
      if (!userCred.user.emailVerified) {
        alert("Please verify your email before logging in.");
        auth.signOut();
        return;
      }
      window.location.href = "dashboard.html";
    } catch (e) {
      alert("Login Error: " + e.message);
    }
  });
}

// Register Logic
document.getElementById("registerBtn").addEventListener("click", async () => {
  const email = document.getElementById("regEmail").value;
  const pass = document.getElementById("regPass").value;
  const name = document.getElementById("fullName").value;
  const ward = document.getElementById("ward").value;
  const muni = document.getElementById("muni").value;

  if (!email || !pass) return alert("Please provide email and password.");

  try {
    // 1. Create the user
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    console.log("User created:", cred.user.uid);
    
    // 2. Send verification email immediately
    await sendEmailVerification(cred.user);
    
    // 3. Save user data to Firestore
    // We do this BEFORE showing the modal to ensure data integrity
    await setDoc(doc(db, "users", cred.user.uid), {
      fullName: name || "",
      wardNumber: ward || "",
      municipality: muni || "",
      email: email,
      emailVerified: false,
    });
    
    
    // 4. Trigger the UI feedback
    document.getElementById("verifyEmail").textContent = email;
    const verificationModal = new bootstrap.Modal(document.getElementById("verificationModal"));
    verificationModal.show();
    
    // 5. Reset the form
    document.querySelector("form").reset(); 

  } catch (e) {
    console.error("Registration Error:", e);
    alert("Registration Error: " + e.message);
  }
});
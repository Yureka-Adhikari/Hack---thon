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
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, pass);
    // Check if email is verified
    await userCred.user.reload();
    if (!userCred.user.emailVerified) {
      alert("Please verify your email before logging in. Check your inbox for the verification link.");
      auth.signOut();
      return;
    }
    // Email is verified, redirect to dashboard
    window.location.href = "dashboard.html";
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
    
    // Send email verification
    await sendEmailVerification(cred.user);
    console.log("Verification email sent to:", email);
    
    // Save user data to Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      fullName: name || "",
      wardNumber: ward || "",
      municipality: muni || "",
      email: email,
      emailVerified: false,
    });
    console.log("User document written for:", cred.user.uid);
    
    // Show verification modal
    document.getElementById("verifyEmail").textContent = email;
    const verificationModal = new bootstrap.Modal(document.getElementById("verificationModal"));
    verificationModal.show();
    
    // Clear form
    document.getElementById("fullName").value = "";
    document.getElementById("ward").value = "";
    document.getElementById("muni").value = "";
    document.getElementById("regEmail").value = "";
    document.getElementById("regPass").value = "";
  } catch (e) {
    console.error("Registration Error:", e);
    alert("Registration Error: " + e.message);
  }
});

// Resend verification email
document.getElementById("resendBtn").addEventListener("click", async () => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      await sendEmailVerification(currentUser);
      alert("Verification email resent successfully!");
    } catch (e) {
      console.error("Resend Error:", e);
      alert("Error: " + e.message);
    }
  }
});

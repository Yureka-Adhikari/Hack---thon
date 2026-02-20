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
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Check if email is verified
    user.reload().then(() => {
      if (user.emailVerified) {
        // fetch user role and redirect accordingly (with logging)
        getDoc(doc(db, "users", user.uid)).then((snap) => {
          if (!snap.exists()) {
            console.warn("User doc not found for uid:", user.uid);
            window.location.href = "dashboard.html";
            return;
          }
          const data = snap.data();
          console.log("User doc data (onAuthStateChanged):", data);
          const role = (data.role || "").toString().toLowerCase().trim();
          console.log("Resolved role:", role);
          if (role === "ward") {
            window.location.href = "ward-dashboard.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }).catch((e) => {
          console.error("Error fetching user data:", e);
          window.location.href = "dashboard.html";
        });
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
      // Fetch role and redirect accordingly (with logging)
      try {
        const snap = await getDoc(doc(db, "users", userCred.user.uid));
        if (!snap.exists()) {
          console.warn("User doc not found after login for uid:", userCred.user.uid);
          window.location.href = "dashboard.html";
        } else {
          const data = snap.data();
          console.log("User doc data (after login):", data);
          const role = (data.role || "").toString().toLowerCase().trim();
          console.log("Resolved role (after login):", role);
          if (role === "ward") {
            window.location.href = "ward-dashboard.html";
          } else {
            window.location.href = "dashboard.html";
          }
        }
      } catch (e) {
        console.error("Error fetching user role:", e);
        window.location.href = "dashboard.html";
      }
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
  let userTypeElem = document.getElementById("userType");
  let userType = userTypeElem ? userTypeElem.value.toString().toLowerCase() : "resident";
  if (userType !== "ward" && userType !== "resident") userType = "resident";
  console.log("Register: userType element:", userTypeElem, "value:", userType);

  if (!email || !pass) return alert("Please provide email and password.");

  try {
    // 1. Create the user
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    console.log("User created:", cred.user.uid);
    
    // 2. Send verification email immediately
    await sendEmailVerification(cred.user);
    
    // 3. Save user data to Firestore
    // We do this BEFORE showing the modal to ensure data integrity
    console.log("About to save user doc with role:", userType);
    await setDoc(doc(db, "users", cred.user.uid), {
      fullName: name || "",
      wardNumber: ward || "",
      municipality: muni || "",
      role: userType,
      email: email,
      emailVerified: false,
    });
    console.log("User doc saved successfully with role:", userType);
    
    
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
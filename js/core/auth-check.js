import { auth, db } from "../../js/core/firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

function getRoleAndRedirect(uid) {
  return getDoc(doc(db, "users", uid))
    .then((snap) => {
      if (!snap.exists()) {
        console.warn("User doc not found for uid:", uid);
        window.location.href = "../citizen/dashboard.html";
        return;
      }
      const data = snap.data();
      console.log("User doc data:", data);
      const role = (data.role || "").toString().toLowerCase().trim();
      console.log("Resolved role:", role);
      if (role === "ward") {
        window.location.href = "../ward/ward-dashboard.html";
      } else {
        window.location.href = "../citizen/dashboard.html";
      }
    })
    .catch((e) => {
      console.error("Error fetching user data:", e);
      window.location.href = "../citizen/dashboard.html";
    });
}

function showVerificationModal(email) {
  document.getElementById("verifyEmail").textContent = email;
  const verificationModal = new bootstrap.Modal(
    document.getElementById("verificationModal"),
  );
  verificationModal.show();
}

// No auto-redirect on page load — users must always log in explicitly

// Resend button (both pages)
const resendBtn = document.getElementById("resendBtn");
if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        alert("Verification email resent to " + auth.currentUser.email);
      }
    } catch (e) {
      alert("Error resending email: " + e.message);
    }
  });
}

// Login Logic (login.html only)
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
      await getRoleAndRedirect(userCred.user.uid);
    } catch (e) {
      alert("Login Error: " + e.message);
    }
  });
}

// Register Logic (signup.html only)
const registerBtn = document.getElementById("registerBtn");
if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPass").value;
    const name = document.getElementById("fullName").value;
    const ward = document.getElementById("ward").value;
    const phone = document.getElementById("phone")?.value || "";
    const muni = document.getElementById("muni").value;
    const userTypeElem = document.getElementById("userType");
    let userType = userTypeElem
      ? userTypeElem.value.toString().toLowerCase()
      : "resident";
    if (userType !== "ward" && userType !== "resident") userType = "resident";
    console.log(
      "Register: userType element:",
      userTypeElem,
      "value:",
      userType,
    );

    if (!email || !pass) return alert("Please provide email and password.");

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      console.log("User created:", cred.user.uid);

      await sendEmailVerification(cred.user);

      // Sign out immediately so onAuthStateChanged doesn't interfere
      await auth.signOut();

      console.log("About to save user doc with role:", userType);
      await setDoc(doc(db, "users", cred.user.uid), {
        fullName: name || "",
        phone: phone,
        wardNumber: ward || "",
        municipality: muni || "",
        role: userType,
        email: email,
        emailVerified: false,
      });
      console.log("User doc saved successfully with role:", userType);

      showVerificationModal(email);

      document.getElementById("regForm").reset();
    } catch (e) {
      console.error("Registration Error:", e);
      alert("Registration Error: " + e.message);
    }
  });
}

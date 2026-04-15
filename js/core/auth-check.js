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
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ================= REDIRECT =================
async function getRoleAndRedirect(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));

    // No Firestore doc at all — check login role selector
    if (!snap.exists()) {
      const roleSelector = document.getElementById("role");
      const selectedRole = roleSelector?.value || "citizen";
      if (selectedRole === "admin") {
        window.location.href = "../ward/ward-dashboard.html";
      } else {
        window.location.href = "../citizen/dashboard.html";
      }
      return;
    }

    const data = snap.data();
    const role = (data.role || "").toString().toLowerCase().trim();

    // If Firestore has no role, fall back to login selector
    if (!role) {
      const roleSelector = document.getElementById("role");
      const selectedRole = roleSelector?.value || "citizen";
      if (selectedRole === "admin") {
        window.location.href = "../ward/ward-dashboard.html";
      } else {
        window.location.href = "../citizen/dashboard.html";
      }
      return;
    }

    if (role === "ward") {
      window.location.href = "../ward/ward-dashboard.html";
    } else {
      window.location.href = "../citizen/dashboard.html";
    }
  } catch (e) {
    console.error("Redirect error:", e);
    window.location.href = "../citizen/dashboard.html";
  }
}

// ================= VERIFICATION MODAL =================
function showVerificationModal(email) {
  const emailEl = document.getElementById("verifyEmail");
  if (emailEl) emailEl.textContent = email;
  const modal = new bootstrap.Modal(
    document.getElementById("verificationModal"),
  );
  modal.show();
}

// ================= RESEND =================
const resendBtn = document.getElementById("resendBtn");
if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        alert("Verification email resent to " + auth.currentUser.email);
      }
    } catch (e) {
      alert("Error resending: " + e.message);
    }
  });
}

// ================= LOGIN =================
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPassword").value;
    const roleSelector = document.getElementById("role");
    const selectedRole = roleSelector?.value || "citizen"; // "citizen" or "admin"

    if (!email || !pass) {
      alert("Please enter email and password.");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerText = "Signing in...";

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, pass);
      loginBtn.innerText = "Verifying...";
      await userCred.user.reload();

      if (!userCred.user.emailVerified) {
        await auth.signOut();
        loginBtn.disabled = false;
        loginBtn.innerText = "Login";
        alert("Please verify your email first. Check your inbox.");
        return;
      }

      loginBtn.innerText = "Loading...";

      // If ward admin selected on login page, update/set role in Firestore
      // This ensures the role is correct even if it was saved wrong
      if (selectedRole === "admin") {
        try {
          const snap = await getDoc(doc(db, "users", userCred.user.uid));
          if (snap.exists()) {
            await updateDoc(doc(db, "users", userCred.user.uid), {
              role: "ward",
            });
          } else {
            await setDoc(doc(db, "users", userCred.user.uid), {
              role: "ward",
              email: email,
              emailVerified: true,
            });
          }
          window.location.href = "../ward/ward-dashboard.html";
        } catch (e) {
          // If Firestore update fails, still redirect based on selection
          window.location.href = "../ward/ward-dashboard.html";
        }
        return;
      }

      // Citizen — check Firestore role
      await getRoleAndRedirect(userCred.user.uid);
    } catch (e) {
      console.error("Login error:", e.code, e.message);
      loginBtn.disabled = false;
      loginBtn.innerText = "Login";
      if (
        e.code === "auth/invalid-credential" ||
        e.code === "auth/wrong-password" ||
        e.code === "auth/user-not-found"
      ) {
        alert("Incorrect email or password.");
      } else if (e.code === "auth/too-many-requests") {
        alert("Too many attempts. Please wait.");
      } else {
        alert("Login failed: " + e.message);
      }
    }
  });
}

// ================= REGISTER =================
const registerBtn = document.getElementById("registerBtn");
if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPass").value;
    const name = document.getElementById("fullName").value.trim();
    const ward = document.getElementById("ward")?.value || "";
    const phone = document.getElementById("phone")?.value || "";
    const muni = document.getElementById("muni")?.value || "";
    const userTypeElem = document.getElementById("userType");
    let userType = (userTypeElem?.value || "resident")
      .toString()
      .toLowerCase()
      .trim();
    if (userType !== "ward" && userType !== "resident") userType = "resident";

    if (!email || !pass) return alert("Please provide email and password.");

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(cred.user);
      await auth.signOut();

      await setDoc(doc(db, "users", cred.user.uid), {
        fullName: name,
        phone: phone,
        wardNumber: ward,
        municipality: muni,
        role: userType,
        email: email,
        emailVerified: false,
      });

      showVerificationModal(email);
      document.getElementById("regForm")?.reset();
    } catch (e) {
      console.error("Registration error:", e);
      alert("Registration Error: " + e.message);
    }
  });
}

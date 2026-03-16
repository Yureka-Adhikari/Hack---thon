/* =========================================
   CIVICSEWA CITIZEN: SETTINGS LOGIC
   Path: js/citizen/settings.js
========================================= */

import { auth, db } from "../core/firebase-config.js";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;

// Safe DOM injector
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value != null && value !== "" ? value : "—";
}

// ================= AUTH & LOAD PROFILE =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;

  // Load initial Auth details for perceived performance
  setText("uNameTop", user.displayName || user.email.split("@")[0]);
  setText("settingsEmail", user.email);

  // Fetch rich demographic data from Firestore
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();

      // Header
      setText("uNameTop", data.fullName || user.email.split("@")[0]);
      const wardTxt = data.wardNumber ? `Ward ${data.wardNumber}` : "Ward --";
      const muniTxt = data.municipality ? `, ${data.municipality}` : "";
      setText("uWard", wardTxt + muniTxt);

      // Profile Pane
      setText("settingsFullName", data.fullName || "Citizen");
      setText("settingsWard", data.wardNumber);
      setText("settingsMunicipality", data.municipality);

      // Update the large avatar initial
      const avatarInitial = document.getElementById("avatarInitial");
      if (avatarInitial && data.fullName) {
        avatarInitial.innerText = data.fullName.charAt(0).toUpperCase();
      }
    }
  } catch (err) {
    console.error("Error loading profile data:", err);
  }
});

// ================= NOTIFICATION PREFERENCES =================
const savedNotif = localStorage.getItem("civicsewa_notif_prefs");
if (savedNotif) {
  try {
    const prefs = JSON.parse(savedNotif);
    document.getElementById("notifComplaints").checked =
      prefs.complaints !== false;
    document.getElementById("notifBroadcast").checked =
      prefs.broadcast !== false;
    document.getElementById("notifEmergency").checked =
      prefs.emergency === true;
  } catch (_) {}
}

const saveNotifBtn = document.getElementById("saveNotifBtn");
if (saveNotifBtn) {
  saveNotifBtn.addEventListener("click", () => {
    const prefs = {
      complaints: document.getElementById("notifComplaints").checked,
      broadcast: document.getElementById("notifBroadcast").checked,
      emergency: document.getElementById("notifEmergency").checked,
    };
    localStorage.setItem("civicsewa_notif_prefs", JSON.stringify(prefs));

    // Premium UX Feedback
    const originalText = saveNotifBtn.innerHTML;
    saveNotifBtn.innerHTML =
      '<i class="bi bi-check-circle me-2"></i>Saved Successfully';
    saveNotifBtn.classList.replace("btn-gold", "btn-success");
    saveNotifBtn.style.background = "#198754";
    saveNotifBtn.style.color = "#fff";

    setTimeout(() => {
      saveNotifBtn.innerHTML = originalText;
      saveNotifBtn.classList.replace("btn-success", "btn-gold");
      saveNotifBtn.style.background = ""; // Reset to CSS gradient
      saveNotifBtn.style.color = "#000";
    }, 2500);
  });
}

// ================= ZERO-TRUST SECURITY: PASSWORD RESET =================
const resetPwdBtn = document.getElementById("resetPasswordBtn");
if (resetPwdBtn) {
  resetPwdBtn.addEventListener("click", async () => {
    if (!currentUser || !currentUser.email) return;

    // Confirmation dialog prevents accidental clicks
    if (
      confirm(
        `A secure password reset link will be sent to ${currentUser.email}. Continue?`,
      )
    ) {
      const originalHTML = resetPwdBtn.innerHTML;
      resetPwdBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Initiating...';
      resetPwdBtn.disabled = true;

      try {
        await sendPasswordResetEmail(auth, currentUser.email);

        resetPwdBtn.classList.replace(
          "btn-outline-warning",
          "btn-outline-success",
        );
        resetPwdBtn.innerHTML =
          '<i class="bi bi-shield-check me-2"></i>Link Sent to Inbox';

        // Allow resending after 60 seconds
        setTimeout(() => {
          resetPwdBtn.classList.replace(
            "btn-outline-success",
            "btn-outline-warning",
          );
          resetPwdBtn.innerHTML = originalHTML;
          resetPwdBtn.disabled = false;
        }, 60000);
      } catch (e) {
        console.error("Auth Error:", e);
        alert(
          "Error sending reset email. Please ensure your account is verified.",
        );
        resetPwdBtn.innerHTML = originalHTML;
        resetPwdBtn.disabled = false;
      }
    }
  });
}

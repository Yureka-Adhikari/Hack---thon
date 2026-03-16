import { auth, db } from "../core/firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUserId = null;
let currentUserEmail = null;

// ================= AUTH & LOAD PROFILE =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }

  currentUserId = user.uid;
  currentUserEmail = user.email;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();

      // Populate Top Nav
      if (document.getElementById("uWard"))
        document.getElementById("uWard").innerText =
          `Ward ${data.wardNumber || "--"}`;
      if (document.getElementById("uNameTop"))
        document.getElementById("uNameTop").innerText =
          data.fullName || "Official";

      // Populate Settings Form
      document.getElementById("profileName").value = data.fullName || "";
      document.getElementById("profileEmail").value = user.email || "";
      document.getElementById("profilePhone").value = data.phoneNumber || "";
      document.getElementById("profileWard").value = data.wardNumber || "N/A";
      document.getElementById("profileMuni").value = data.municipality || "N/A";
    }
  } catch (error) {
    console.error("Error loading profile:", error);
  }
});

// ================= UPDATE PROFILE =================
document
  .getElementById("profileForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent page reload

    if (!currentUserId) return;

    const btn = document.getElementById("saveProfileBtn");
    const newName = document.getElementById("profileName").value.trim();
    const newPhone = document.getElementById("profilePhone").value.trim();

    if (!newName) {
      alert("Name cannot be empty.");
      return;
    }

    btn.disabled = true;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
      await updateDoc(doc(db, "users", currentUserId), {
        fullName: newName,
        phoneNumber: newPhone,
      });

      // Update top nav instantly
      document.getElementById("uNameTop").innerText = newName;

      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Check console.");
    } finally {
      btn.disabled = false;
      btn.innerText = "Save Changes";
    }
  });

// ================= RESET PASSWORD =================
document
  .getElementById("resetPasswordBtn")
  ?.addEventListener("click", async () => {
    if (!currentUserEmail) {
      alert("No email associated with this account.");
      return;
    }

    const btn = document.getElementById("resetPasswordBtn");

    if (confirm(`Send a password reset email to ${currentUserEmail}?`)) {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

      try {
        await sendPasswordResetEmail(auth, currentUserEmail);
        alert("Password reset email sent! Please check your inbox.");
      } catch (error) {
        console.error("Error sending reset email:", error);
        alert("Failed to send reset email. " + error.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="bi bi-key me-2"></i>Send Password Reset Email';
      }
    }
  });

// ================= LANGUAGE & SOUND TOGGLE =================
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  langSelect.value = localStorage.getItem("lang") || "en";
  langSelect.addEventListener("change", () => {
    localStorage.setItem("lang", langSelect.value);
    // Refresh to apply lang changes if you add translations here later
    location.reload();
  });
}

// Visual only - You can wire this up to an actual notification sound function later!
document.getElementById("soundToggle")?.addEventListener("change", (e) => {
  if (e.target.checked) {
    console.log("Notification sounds enabled.");
  } else {
    console.log("Notification sounds muted.");
  }
});

// ================= LOGOUT =================
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "../../index.html"));
});

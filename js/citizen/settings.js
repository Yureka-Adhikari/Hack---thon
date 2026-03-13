import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value != null && value !== "" ? value : "—";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;

  setText("uNameTop", user.displayName || user.email || "User");
  setText("settingsEmail", user.email);
  setText("settingsFullName", user.displayName);

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      setText("uNameTop", data.fullName || user.displayName || user.email);
      setText(
        "uWard",
        `Ward ${data.wardNumber || "--"}, ${data.municipality || ""}`,
      );
      setText("settingsFullName", data.fullName);
      setText("settingsEmail", user.email);
      setText("settingsPhone", data.phone);
      setText("settingsWard", data.wardNumber);
      setText("settingsMunicipality", data.municipality);
    } else {
      setText("uWard", "—");
      setText("settingsPhone", "—");
      setText("settingsWard", "—");
      setText("settingsMunicipality", "—");
    }
  } catch (err) {
    console.error("Error loading profile:", err);
    setText("uWard", "—");
    setText("settingsPhone", "—");
    setText("settingsWard", "—");
    setText("settingsMunicipality", "—");
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

document.getElementById("saveNotifBtn").addEventListener("click", () => {
  const prefs = {
    complaints: document.getElementById("notifComplaints").checked,
    broadcast: document.getElementById("notifBroadcast").checked,
    emergency: document.getElementById("notifEmergency").checked,
    email: document.getElementById("notifEmail").checked,
  };
  localStorage.setItem("civicsewa_notif_prefs", JSON.stringify(prefs));
  alert("Notification preferences saved.");
});

document
  .getElementById("changePasswordBtn")
  .addEventListener("click", async () => {
    const newPwd = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    if (!newPwd || newPwd.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    if (newPwd !== confirm) {
      alert("Passwords do not match.");
      return;
    }
    if (!currentUser) return;
    try {
      await updatePassword(currentUser, newPwd);
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
      alert("Password updated.");
    } catch (e) {
      console.error(e);
      alert("Could not update password. You may need to re-login first.");
    }
  });

// Load saved notification preferences
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
    document.getElementById("notifEmail").checked = prefs.email !== false;
  } catch (_) {}
}

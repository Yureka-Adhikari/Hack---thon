import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

//Only allow ward users to access this dashboard

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";
// ================= AUTH LISTENER =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        const data = snap.data();
        if (data.role !== "ward") {
            alert("Access denied. This dashboard is only for ward users.");
            signOut(auth);
            return;
        }
        document.getElementById("uNameMain").innerText = data.fullName;
        document.getElementById("uNameTop").innerText = data.fullName;
        userWard = data.wardNumber || "N/A";
        userMunicipality = data.municipality || "N/A";
        document.getElementById("uWard").innerText =
            `Ward ${userWard}, ${userMunicipality}`;
    }
    // ===== LOAD LATEST COMPLAINT =====
    const q = query(
        collection(db, "complaints"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const latest = snapshot.docs[0].data();
        document.getElementById("latestTitle").innerText = latest.title;
        document.getElementById("latestStatus").innerText = latest.status;
        document.getElementById("latestCategory").innerText = latest.category;
    } else {
        document.getElementById("latestTitle").innerText = "No complaints yet.";
        document.getElementById("latestStatus").innerText = "-";
        document.getElementById("latestCategory").innerText = "-";
    }});

// LOGOUT
document.getElementById("logoutBtn").addEventListener("click", () => {
    signOut(auth);
    window.location.href = "login.html";
});


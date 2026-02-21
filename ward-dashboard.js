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
  }
  // Load all complaints on dashboard
  loadComplaints();
  // Setup alert button after auth is complete
  setupAlertButton();
});

// ================= SETUP ALERT BUTTON =================
function setupAlertButton() {
  const postBtn = document.getElementById("postBtn");
  if (postBtn) {
    postBtn.addEventListener("click", async () => {
      if (!currentUser) {
        alert("Please wait for authentication.");
        return;
      }
      const title = document.getElementById("alertTitle").value.trim();
      const category = document.getElementById("alertCategory").value;
      const description = document
        .getElementById("alertDescription")
        .value.trim();
      const emergency = document.getElementById("alertEmergency").checked;

      if (!title || !description) {
        alert("Please fill in all fields.");
        return;
      }

      try {
        await addDoc(collection(db, "ward-broadcasts"), {
          title,
          category,
          description,
          emergency,
          ward: userWard,
          municipality: userMunicipality,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        alert("Alert sent successfully!");
        // Clear form
        document.getElementById("alertTitle").value = "";
        document.getElementById("alertDescription").value = "";
        document.getElementById("alertEmergency").checked = false;
      } catch (error) {
        console.error("Error sending alert:", error);
        alert("Failed to send alert. Please try again.");
      }
    });
  } else {
    console.error("Post button not found!");
  }
}

// ================= LOAD COMPLAINTS =================
async function loadComplaints() {
  const container = document.getElementById("complaintsContainer");
  if (!container) return;
  container.innerHTML = "";
  const q = query(
    collection(db, "complaints"),
    where("userId", "==", currentUser.uid),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    container.innerHTML = "<p class='text-muted'>No complaints yet.</p>";
    return;
  }
  snapshot.forEach((docSnap) => {
    const complaint = docSnap.data();
    const statusBg =
      complaint.status === "Open"
        ? "status-open text-white"
        : complaint.status === "In Progress"
          ? "status-progress"
          : "status-resolved text-white";
    container.innerHTML += `
        <div class="d-flex justify-content-between">
            <div>
                <div class="fw-semibold">${complaint.title}</div>
                <small class="text-muted">${complaint.createdAt ? complaint.createdAt.toDate().toLocaleString() : ""}</small>
            </div>
            <span class="badge ${statusBg}">${complaint.status}</span>
        </div>
        <hr>
        `;
  });
}

// LOGOUT
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth);
  window.location.href = "login.html";
});

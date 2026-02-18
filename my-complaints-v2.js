import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  console.log("User logged in:", user.uid);

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById("uNameMain").innerText = data.fullName || "User";
      document.getElementById("uNameTop").innerText = data.fullName || "User";

      userWard = data.wardNumber || "N/A";
      userMunicipality = data.municipality || "N/A";

      document.getElementById("uWard").innerText =
        `Ward ${userWard}, ${userMunicipality}`;
    }

    // Load complaints AFTER user confirmed
    await loadComplaints();
  } catch (err) {
    console.error("User load error:", err);
  }
});

/* ================= LOGOUT ================= */

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

/* ================= SUBMIT COMPLAINT ================= */

window.addEventListener("load", () => {
  const submitBtn = document.getElementById("submitComplaintBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleSubmitComplaint);
  }
});

async function handleSubmitComplaint(e) {
  e.preventDefault();

  const title = document.getElementById("complaintTitle")?.value?.trim() || "";
  const category = document.getElementById("complaintCategory")?.value || "";
  const description =
    document.getElementById("complaintDescription")?.value?.trim() || "";
  const location =
    document.getElementById("complaintLocation")?.value?.trim() || "";

  if (!title || !category || !description || !location) {
    alert("Please fill all fields.");
    return;
  }

  if (!currentUser) {
    alert("Not logged in.");
    return;
  }

  try {
    await addDoc(collection(db, "complaints"), {
      title,
      category,
      description,
      location,
      userId: currentUser.uid,
      status: "Submitted",
      createdAt: serverTimestamp(),
      wardNumber: userWard,
      municipality: userMunicipality,
    });

    document.getElementById("complaintForm")?.reset();
    alert("Complaint submitted successfully!");

    await loadComplaints(); // reload immediately
  } catch (error) {
    console.error("Submit error:", error);
    alert(error.message);
  }
}

/* ================= LOAD COMPLAINTS ================= */

async function loadComplaints() {
  if (!currentUser) return;

  try {
    const q = query(
      collection(db, "complaints"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);

    const container = document.getElementById("complaintsList");
    if (!container) return;

    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = `
        <div class="alert alert-info">
          No complaints submitted yet.
        </div>
      `;
      return;
    }

    snapshot.forEach((document) => {
      const data = document.data();

      const createdDate = data.createdAt?.toDate?.() || new Date();
      const formattedDate =
        createdDate.toLocaleDateString() +
        " " +
        createdDate.toLocaleTimeString();

      container.innerHTML += `
        <div class="complaint-card">
          <h4>${data.title}</h4>
          <p class="text-muted mb-2">${data.description}</p>
          <p class="mb-1"><strong>Location:</strong> ${data.location}</p>
          <p class="text-muted small">Submitted: ${formattedDate}</p>
          <span class="status ${data.status.replace(" ", "")}">
            ${data.status}
          </span>
          <br><br>
          <button onclick="viewComplaint('${document.id}')">
            View Complaint
          </button>
        </div>
      `;
    });

    console.log("Complaints loaded:", snapshot.size);
  } catch (error) {
    console.error("Load error:", error);
  }
}

/* ================= VIEW COMPLAINT ================= */

window.viewComplaint = async function (id) {
  try {
    const snap = await getDoc(doc(db, "complaints", id));

    if (snap.exists()) {
      const data = snap.data();

      alert(
        `Title: ${data.title}
Category: ${data.category}
Status: ${data.status}
Location: ${data.location}
Municipality: ${data.municipality}
Ward: ${data.wardNumber}`,
      );
    }
  } catch (error) {
    console.error("View error:", error);
  }
};

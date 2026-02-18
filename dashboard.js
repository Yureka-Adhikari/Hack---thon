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
    document.getElementById("latestLocation").innerText = latest.location;
  }
});

// ================= LOGOUT =================
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

// ================= SIDEBAR ACTIVE LINK =================
const navLinks = document.querySelectorAll("#sidebar .nav-link");
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

// ================= SUBMIT COMPLAINT =================
async function submitComplaint(data) {
  const user = auth.currentUser;

  if (!user) {
    alert("Please login first.");
    return;
  }

  try {
    await addDoc(collection(db, "complaints"), {
      title: data.title,
      category: data.category,
      description: data.description,
      location: data.location,
      municipality: data.municipality,
      wardNumber: data.wardNumber,
      status: "Submitted",
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    alert("Complaint submitted successfully!");
    window.location.href = "my-complaints.html";
  } catch (error) {
    console.error(error);
    alert("Error submitting complaint.");
  }
}

// ================= MODAL SUBMIT =================
document.getElementById("submitComplaintBtn")?.addEventListener("click", () => {
  submitComplaint({
    title: document.getElementById("title").value,
    category: document.getElementById("category").value,
    description: document.getElementById("description").value,
    location: document.getElementById("location").value,
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});

// ================= QUICK ACTION BUTTONS =================
document.getElementById("quickRoad")?.addEventListener("click", () => {
  submitComplaint({
    title: "Road Damage",
    category: "Road",
    description: "There is a damaged road in my area.",
    location: "Near my area",
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});

document.getElementById("quickWater")?.addEventListener("click", () => {
  submitComplaint({
    title: "Water Issue",
    category: "Water",
    description: "No water supply in my area.",
    location: "Near my area",
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});

document.getElementById("quickElectric")?.addEventListener("click", () => {
  submitComplaint({
    title: "Electricity Issue",
    category: "Electricity",
    description: "Power outage in my area.",
    location: "Near my area",
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});

// ================= VIEW COMPLAINT BUTTON =================
document.getElementById("viewComplaintBtn")?.addEventListener("click", () => {
  window.location.href = "my-complaints.html";
});

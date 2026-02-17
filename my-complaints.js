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
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById("uNameMain").innerText = data.fullName;
      document.getElementById("uNameTop").innerText = data.fullName;
      document.getElementById("uWard").innerText =
        `Ward ${data.wardNumber}, ${data.municipality}`;
    }
    loadComplaints();
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

// Sidebar navigation
const navLinks = document.querySelectorAll("#sidebar .nav-link");
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

// Load user's complaints
async function loadComplaints() {
  if (!currentUser) return;

  try {
    const complaintsRef = collection(db, "complaints");
    const q = query(complaintsRef, where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);

    const container = document.getElementById("complaintsContainer");
    container.innerHTML = "";

    if (querySnapshot.empty) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            No complaints submitted yet. <a href="dashboard.html">Submit one now</a>
          </div>
        </div>
      `;
      return;
    }

    querySnapshot.forEach((doc) => {
      const complaint = doc.data();
      const statusColor = getStatusColor(complaint.status);
      const createdDate = complaint.createdAt?.toDate?.() || new Date();
      const formattedDate = createdDate.toLocaleDateString() + " " + createdDate.toLocaleTimeString();

      const complaintCard = `
        <div class="col-md-6 col-lg-4">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-light">
              <div class="d-flex justify-content-between align-items-start">
                <h5 class="card-title mb-2">${complaint.title}</h5>
                <span class="badge ${statusColor}">${complaint.status}</span>
              </div>
              <small class="text-muted">${complaint.category}</small>
            </div>
            <div class="card-body">
              <p class="card-text">${complaint.description}</p>
              <p class="mb-2"><small><strong>Location:</strong> ${complaint.location}</small></p>
              <p class="mb-0"><small class="text-muted"><strong>Submitted:</strong> ${formattedDate}</small></p>
            </div>
            <div class="card-footer bg-light">
              <button class="btn btn-sm btn-outline-primary" onclick="viewDetails('${doc.id}')">View Details</button>
            </div>
          </div>
        </div>
      `;

      container.innerHTML += complaintCard;
    });
  } catch (error) {
    console.error("Error loading complaints:", error);
    document.getElementById("complaintsContainer").innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">Error loading complaints. Please try again.</div>
      </div>
    `;
  }
}

function getStatusColor(status) {
  const colors = {
    "Submitted": "bg-primary",
    "In Progress": "bg-warning",
    "Resolved": "bg-success",
    "Rejected": "bg-danger"
  };
  return colors[status] || "bg-secondary";
}

window.viewDetails = function(complaintId) {
  alert("Details for complaint: " + complaintId);
  // Can be expanded to show a modal with more details
};

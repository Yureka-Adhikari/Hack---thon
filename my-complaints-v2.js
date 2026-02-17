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
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

// ============ AUTH ============
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    console.log("User logged in:", user.uid);
    
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById("uNameMain").innerText = data.fullName || "User";
      document.getElementById("uNameTop").innerText = data.fullName || "User";
      userWard = data.wardNumber || "N/A";
      userMunicipality = data.municipality || "N/A";
      document.getElementById("uWard").innerText = `Ward ${userWard}, ${userMunicipality}`;
    }
    
    // Load complaints after user is verified
    loadComplaints();
  }
});

// ============ LOGOUT ============
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

// ============ SIDEBAR ============
const navLinks = document.querySelectorAll("#sidebar .nav-link");
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

// ============ SUBMIT COMPLAINT ============
// Wait for DOM to be ready
window.addEventListener("load", function() {
  const submitBtn = document.getElementById("submitComplaintBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleSubmitComplaint);
    console.log("✓ Submit button ready");
  }
});

async function handleSubmitComplaint(e) {
  e.preventDefault();
  console.log("📝 Submitting complaint...");
  
  const title = document.getElementById("complaintTitle")?.value?.trim() || "";
  const category = document.getElementById("complaintCategory")?.value || "";
  const description = document.getElementById("complaintDescription")?.value?.trim() || "";
  const location = document.getElementById("complaintLocation")?.value?.trim() || "";

  console.log({ title, category, description, location });

  // Validate
  if (!title || !category || !description || !location) {
    alert("❌ Please fill ALL fields!");
    return;
  }

  if (!currentUser) {
    alert("❌ Not logged in!");
    return;
  }

  // Submit to Firebase
  try {
    const complaintData = {
      title,
      category,
      description,
      location,
      userId: currentUser.uid,
      status: "Submitted",
      createdAt: serverTimestamp(),
      wardNumber: userWard,
      municipality: userMunicipality,
    };

    console.log("📤 Saving...", complaintData);
    const docRef = await addDoc(collection(db, "complaints"), complaintData);
    console.log("✅ Saved! ID:", docRef.id);

    // Reset form
    document.getElementById("complaintForm")?.reset?.();
    
    alert("✅ Complaint submitted successfully!");
    
    // Reload list
    await loadComplaints();
  } catch (error) {
    console.error("❌ Save error:", error);
    alert("❌ Error: " + error.message);
  }
}

// ============ LOAD COMPLAINTS ============
async function loadComplaints() {
  if (!currentUser) {
    console.log("No user, skipping load");
    return;
  }

  try {
    console.log("📋 Loading complaints for user:", currentUser.uid);
    
    const complaintsRef = collection(db, "complaints");
    const q = query(complaintsRef, where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);

    const container = document.getElementById("complaintsList");
    if (!container) {
      console.error("❌ No complaintsList element found!");
      return;
    }

    container.innerHTML = "";
    console.log("Found complaints:", querySnapshot.size);

    if (querySnapshot.empty) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No complaints submitted yet.
        </div>
      `;
      return;
    }

    querySnapshot.forEach((doc) => {
      const complaint = doc.data();
      const statusColor = getStatusColor(complaint.status);
      const createdDate = complaint.createdAt?.toDate?.() || new Date();
      const formattedDate = createdDate.toLocaleDateString() + " " + createdDate.toLocaleTimeString();

      // Create main card
      const card = document.createElement("div");
      card.className = "card shadow-sm mb-3 border-0";

      // Create header
      const header = document.createElement("div");
      header.className = "card-header bg-light";

      // Header top section with title and badge
      const headerTop = document.createElement("div");
      headerTop.className = "d-flex justify-content-between align-items-start";

      const titleEl = document.createElement("h5");
      titleEl.className = "card-title mb-2";
      titleEl.textContent = complaint.title;

      const statusBadge = document.createElement("span");
      statusBadge.className = `badge ${statusColor}`;
      statusBadge.textContent = complaint.status;

      headerTop.appendChild(titleEl);
      headerTop.appendChild(statusBadge);

      // Category label
      const categoryEl = document.createElement("small");
      categoryEl.className = "text-muted d-block mt-2";
      categoryEl.textContent = complaint.category;

      header.appendChild(headerTop);
      header.appendChild(categoryEl);

      // Body
      const body = document.createElement("div");
      body.className = "card-body";

      const descEl = document.createElement("p");
      descEl.className = "card-text";
      descEl.textContent = complaint.description;

      const locEl = document.createElement("p");
      locEl.className = "mb-2";
      locEl.innerHTML = `<small><strong>Location:</strong> ${complaint.location}</small>`;

      const dateEl = document.createElement("p");
      dateEl.className = "mb-0";
      dateEl.innerHTML = `<small class="text-muted"><strong>Submitted:</strong> ${formattedDate}</small>`;

      body.appendChild(descEl);
      body.appendChild(locEl);
      body.appendChild(dateEl);

      // Assemble card
      card.appendChild(header);
      card.appendChild(body);

      // Add to container
      container.appendChild(card);

      console.log("✓ Complaint card added:", complaint.title);
    });
  } catch (error) {
    console.error("❌ Load error:", error);
    const container = document.getElementById("complaintsList");
    if (container) {
      container.innerHTML = `<div class="alert alert-danger">Error loading complaints: ${error.message}</div>`;
    }
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

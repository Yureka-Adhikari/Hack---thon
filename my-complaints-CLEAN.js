import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
 
let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

// AUTHENTICATION
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    console.log("✓ User authenticated:", user.uid);
    
    // Get user data
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      document.getElementById("uNameMain").textContent = data.fullName || "User";
      document.getElementById("uNameTop").textContent = data.fullName || "User";
      userWard = data.wardNumber || "N/A";
      userMunicipality = data.municipality || "N/A";
      document.getElementById("uWard").textContent = `Ward ${userWard}, ${userMunicipality}`;
    }
    
    // Load existing complaints
    loadComplaints();
  }
});onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    console.log("✓ User authenticated:", user.uid);

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        document.getElementById("uNameMain").textContent =
          data.fullName || "User";
        // ... rest of your UI updates
      }
    } catch (error) {
      console.error("Could not load profile:", error);
      // Even if profile fails, we still try to load complaints
    }

    // Move this outside the try/catch or ensure it's called
    loadComplaints();
  }
});

// LOGOUT
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
});

// SIDEBAR NAVIGATION
document.querySelectorAll("#sidebar .nav-link").forEach((link) => {
  link.addEventListener("click", function() {
    document.querySelectorAll("#sidebar .nav-link").forEach(l => l.classList.remove("active"));
    this.classList.add("active");
  });
});

// SUBMIT BUTTON
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("submitComplaintBtn");
  if (btn) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await submitComplaint();
    });
  }
});

// SUBMIT COMPLAINT FUNCTION
async function submitComplaint() {
  const title = document.getElementById("complaintTitle")?.value;
  const category = document.getElementById("complaintCategory")?.value;
  const location = document.getElementById("complaintLocation")?.value;
  const description = document.getElementById("complaintDescription")?.value;

  // Validate
  if (!title || !category || !location || !description) {
    alert("⚠️ Please fill all fields");
    return;
  }

  if (!currentUser) {
    alert("❌ Not logged in");
    return;
  }

  try {
    // Save to Firebase
    await addDoc(collection(db, "complaints"), {
      title,
      category,
      location,
      description,
      userId: currentUser.uid,
      status: "Submitted",
      createdAt: serverTimestamp(),
      wardNumber: userWard,
      municipality: userMunicipality,
    });

    console.log("✅ Complaint saved");
    alert("✅ Complaint submitted!");
    
    // Clear form
    document.getElementById("complaintForm")?.reset();
    
    // Reload complaints
    await loadComplaints();
  } catch (error) {
    console.error("Error:", error);
    alert("❌ Error: " + error.message);
  }
}

// LOAD COMPLAINTS
async function loadComplaints() {
  if (!currentUser) return;

  try {
    const query_ = query(collection(db, "complaints"), where("userId", "==", currentUser.uid));
    const snapshot = await getDocs(query_);

    const listDiv = document.getElementById("complaintsList");
    if (!listDiv) {
      console.error("❌ complaintsList div not found");
      return;
    }

    // Clear existing
    listDiv.innerHTML = "";

    if (snapshot.empty) {
      listDiv.innerHTML = '<div class="alert alert-info">📝 No complaints yet</div>';
      console.log("No complaints found");
      return;
    }

    console.log(`📋 Found ${snapshot.size} complaints`);

    // Add each complaint
    snapshot.forEach((doc) => {
      const data = doc.data();
      const date = data.createdAt?.toDate() || new Date();
      const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
      const badgeClass = data.status === "Submitted" ? "bg-primary" : data.status === "In Progress" ? "bg-warning" : data.status === "Resolved" ? "bg-success" : "bg-danger";

      // Create card HTML
      const html = `
        <div class="card shadow-sm mb-3 border-0">
          <div class="card-header bg-light d-flex justify-content-between align-items-start">
            <div>
              <h5 class="card-title mb-1">${data.title}</h5>
              <small class="text-muted">${data.category}</small>
            </div>
            <span class="badge ${badgeClass}">${data.status}</span>
          </div>
          <div class="card-body">
            <p class="mb-2">${data.description}</p>
            <p class="mb-1"><small><strong>Location:</strong> ${data.location}</small></p>
            <p class="mb-0"><small class="text-muted"><strong>Date:</strong> ${dateStr}</small></p>
          </div>
        </div>
      `;

      listDiv.innerHTML += html;
    });

    console.log("✅ Complaints rendered");
  } catch (error) {
    console.error("Load error:", error);
    const listDiv = document.getElementById("complaintsList");
    if (listDiv) {
      listDiv.innerHTML = `<div class="alert alert-danger">❌ Error: ${error.message}</div>`;
    }
  }
}

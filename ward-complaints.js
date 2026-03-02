import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUserWard = "N/A";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    const data = snap.data();
    currentUserWard = data.wardNumber || "N/A";
    console.log("Ward User Ward Number:", currentUserWard, "Type:", typeof currentUserWard);
    loadComplaints();
  } else {
    console.log("User document not found!");
  }
});

function loadComplaints() {
  const container = document.getElementById("complaintsContainer");
  if (!container) {
    console.log("Container not found!");
    return;
  }
  
  console.log("Loading complaints for ward:", currentUserWard);

  const q = query(
    collection(db, "complaints"),
    where("wardNumber", "==", currentUserWard)
  );

  onSnapshot(q, (snapshot) => {
    console.log("Snapshot received. Count:", snapshot.size);
    const docs = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    // Sort by createdAt descending on client-side
    docs.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    console.log("Snapshot docs:", docs.map(d => ({
      id: d.id,
      wardNumber: d.wardNumber,
      title: d.title
    })));
    
    container.innerHTML = "";
    docs.forEach((data) => {
      const complaintId = data.id;
      const date = data.createdAt?.toDate?.().toLocaleString() || "Syncing...";

      container.innerHTML += `
                <div class="col-md-6 mb-4">
                    <div class="card h-100 shadow-sm border-0" style="border-radius: 15px; border-left: 6px solid ${getStatusColor(data.status)} !important;">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h5 class="fw-bold text-primary">${data.title}</h5>
                                <button class="btn btn-sm btn-outline-danger")"><i class="bi bi-trash"></i></button>
                            </div>
                            <p class="text-muted small mb-2">From: ${data.userName || "Citizen"} | Ward: ${data.wardNumber}</p>
                            <p class="mb-1"><strong>Location:</strong> ${data.location}</p>
                            <p class="card-text">${data.description}</p>
                            <hr>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="badge ${getStatusClass(data.status)}">${data.status}</span>
                                <select class="form-select form-select-sm w-50" onchange="updateStatus('${complaintId}', this.value)">
                                    <option value="" disabled selected>Update Status</option>
                                    <option value="Submitted">Submitted</option>
                                    <option value="InProgress">In Progress</option>
                                    <option value="Resolved">Resolved</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            `;
    });
    
    if (snapshot.empty) {
      container.innerHTML = "<p class='text-muted'>No complaints for this ward yet.</p>";
    }
  }, (error) => {
    console.error("Query error:", error);
  });
}

window.updateStatus = async (id, newStatus) => {
  try {
    await updateDoc(doc(db, "complaints", id), { status: newStatus });
  } catch (e) {
    console.error(e);
  }
};


document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

function getStatusColor(s) {
  if (s === "Resolved") return "#198754";
  if (s === "InProgress") return "#ffc107";
  return "#0d6efd";
}

function getStatusClass(s) {
  if (s === "Resolved") return "bg-success";
  if (s === "InProgress") return "bg-warning text-dark";
  return "bg-primary";
}

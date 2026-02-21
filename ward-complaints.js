import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWU1yZufweSez51pQptnr6ZX_FJZ3LKxc",
  authDomain: "hack---a---thon-2026.firebaseapp.com",
  projectId: "hack---a---thon-2026",
  storageBucket: "hack---a---thon-2026.firebasestorage.app",
  messagingSenderId: "566869340021",
  appId: "1:566869340021:web:875343f6c99d165b602d3c",
  measurementId: "G-CVEDYTDJT6",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("complaintContainer");
  if (!container) return;

  const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const date = data.createdAt?.toDate?.().toLocaleString() || "Syncing...";

      container.innerHTML += `
                <div class="col-md-6 mb-4">
                    <div class="card h-100 shadow-sm border-0" style="border-radius: 15px; border-left: 6px solid ${getStatusColor(data.status)} !important;">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h5 class="fw-bold text-primary">${data.title}</h5>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteComplaint('${id}')"><i class="bi bi-trash"></i></button>
                            </div>
                            <p class="text-muted small mb-2">From: ${data.userName || "Citizen"} | Ward: ${data.wardNumber}</p>
                            <p class="mb-1"><strong>Location:</strong> ${data.location}</p>
                            <p class="card-text">${data.description}</p>
                            <hr>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="badge ${getStatusClass(data.status)}">${data.status}</span>
                                <select class="form-select form-select-sm w-50" onchange="updateStatus('${id}', this.value)">
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
  });
});

window.updateStatus = async (id, newStatus) => {
  try {
    await updateDoc(doc(db, "complaints", id), { status: newStatus });
  } catch (e) {
    console.error(e);
  }
};

window.deleteComplaint = async (id) => {
  if (confirm("Remove this record?"))
    await deleteDoc(doc(db, "complaints", id));
};

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

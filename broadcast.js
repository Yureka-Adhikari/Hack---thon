import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// !!! PASTE YOUR ACTUAL CONFIG HERE FROM FIREBASE CONSOLE !!!
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

const broadcastContainer = document.querySelector(".row.g-4");

// Listen for updates
const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  // 1. Clear container once
  broadcastContainer.innerHTML = "";

  if (snapshot.empty) {
    broadcastContainer.innerHTML =
      '<div class="col-12 text-center mt-5 text-muted">No broadcasts available.</div>';
    return;
  }

  snapshot.forEach((doc) => {
    const data = doc.data();

    // 2. Safely handle the Date
    const dateString = data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleString()
      : "Just now...";

    const cardHtml = `
            <div class="col-md-6 col-lg-4">
                <div class="card broadcast-card shadow-sm h-100 ${data.emergency ? "emergency" : ""}">
                    <div class="card-body">
                        <h5 class="card-title ${data.emergency ? "text-danger fw-bold" : ""}">
                            ${data.emergency ? '<i class="bi bi-exclamation-triangle-fill"></i> ' : ""}${data.title}
                        </h5>
                        <p class="text-muted small mb-2">${dateString}</p>
                        <p class="card-text">${data.content}</p>
                    </div>
                </div>
            </div>
        `;
    broadcastContainer.innerHTML += cardHtml;
  });
});

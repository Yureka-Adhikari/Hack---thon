// ===============================
// Firebase Imports
// ===============================

import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===============================
// WAIT FOR DOM TO LOAD
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("broadcastContainer");
  const postBtn = document.getElementById("postBtn");

  if (!container) {
    console.error("broadcastContainer not found in HTML.");
    return;
  }

  if (!postBtn) {
    console.error("postBtn not found in HTML.");
    return;
  }

  // ===============================
  // LOAD BROADCASTS
  // ===============================

  async function loadBroadcasts() {
    try {
      container.innerHTML = "";

      const q = query(
        collection(db, "ward-broadcasts"), // make sure this matches your collection name
        orderBy("date", "desc"),
      );

      const snapshot = await getDocs(q);

      snapshot.forEach((docSnap) => {
        const post = docSnap.data();

        container.innerHTML += `
          <div class="col-md-4 fade-in">
            <div class="broadcast-card ${post.emergency ? "emergency" : ""}">
              
              <button class="btn btn-sm btn-danger delete-btn"
                onclick="window.deleteBroadcast('${docSnap.id}')">
                <i class="bi bi-trash"></i>
              </button>

              ${
                post.emergency
                  ? `<span class="badge bg-danger mb-2">Emergency</span>`
                  : ""
              }

              <h5 class="fw-semibold mb-1">${post.title}</h5>

              <small class="text-muted d-block mb-2">
                <i class="bi bi-clock me-1"></i>
                ${post.date ? post.date.toDate().toLocaleString() : "Just now"}
              </small>

              <p class="mb-0">${post.content}</p>
            </div>
          </div>
        `;
      });
    } catch (error) {
      console.error("Error loading broadcasts:", error);
    }
  }

  // ===============================
  // CREATE BROADCAST
  // ===============================

  postBtn.addEventListener("click", async () => {
    try {
      const title = document.getElementById("title").value.trim();
      const content = document.getElementById("content").value.trim();
      const emergency = document.getElementById("emergency").checked;

      if (!title || !content) {
        alert("Please fill all fields.");
        return;
      }

      await addDoc(collection(db, "ward-broadcasts"), {
        title,
        content,
        emergency,
        date: serverTimestamp(),
      });

      // Reset form
      document.getElementById("title").value = "";
      document.getElementById("content").value = "";
      document.getElementById("emergency").checked = false;

      // Close modal safely
      const modalElement = document.getElementById("createModal");
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) modal.hide();

      loadBroadcasts();
    } catch (error) {
      console.error("Error creating broadcast:", error);
      alert("Failed to post broadcast.");
    }
  });

  // ===============================
  // DELETE BROADCAST
  // ===============================

  window.deleteBroadcast = async function (id) {
    try {
      await deleteDoc(doc(db, "ward-broadcasts", id));
      loadBroadcasts();
    } catch (error) {
      console.error("Error deleting broadcast:", error);
    }
  };

  // Initial load
  loadBroadcasts();
});

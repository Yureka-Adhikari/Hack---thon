// ward-broadcast.js

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
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("broadcastContainer");
  const postBtn = document.getElementById("postBtn");

  if (!container || !postBtn) {
    console.error("Required elements not found in HTML.");
    return;
  }

  // ================= LOAD =================
  async function loadBroadcasts() {
    try {
      container.innerHTML = "";

      const q = query(
        collection(db, "ward-broadcasts"),
        orderBy("date", "desc"),
      );

      const snapshot = await getDocs(q);

      snapshot.forEach((docSnap) => {
        const post = docSnap.data();

        container.innerHTML += `
          <div class="col-md-4 mb-4">
            <div class="broadcast-card ${post.emergency ? "emergency" : ""}">
              <button class="btn btn-sm btn-danger delete-btn"
                onclick="window.deleteBroadcast('${docSnap.id}')">
                Delete
              </button>

              ${post.emergency ? `<span class="badge bg-danger mb-2">Emergency</span>` : ""}

              <h5>${post.title}</h5>
              <small class="text-muted">
                ${post.date ? post.date.toDate().toLocaleString() : ""}
              </small>

              <p>${post.content}</p>
            </div>
          </div>
        `;
      });
    } catch (error) {
      console.error("Error loading broadcasts:", error);
    }
  }

  // ================= CREATE =================
  postBtn.addEventListener("click", async () => {
    try {
      const title = document.getElementById("title").value.trim();
      const content = document.getElementById("content").value.trim();
      const emergency = document.getElementById("emergency").checked;

      if (!title || !content) {
        alert("Please fill all fields");
        return;
      }

      await addDoc(collection(db, "ward-broadcasts"), {
        title,
        content,
        emergency,
        date: serverTimestamp(),
      });

      document.getElementById("title").value = "";
      document.getElementById("content").value = "";
      document.getElementById("emergency").checked = false;

      loadBroadcasts();
    } catch (error) {
      console.error("Error creating broadcast:", error);
    }
  });

  // ================= DELETE =================
  window.deleteBroadcast = async function (id) {
    try {
      await deleteDoc(doc(db, "ward-broadcasts", id));
      loadBroadcasts();
    } catch (error) {
      console.error("Error deleting broadcast:", error);
    }
  };

  loadBroadcasts();
});

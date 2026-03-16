import { auth, db } from "../core/firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  collection,
  doc,
  updateDoc,
  query,
  onSnapshot,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateComplaint } from "../core/translator.js";

let cachedDocs = [];

// ================= AUTH & INITIALIZATION =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../../login.html";
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();

      // Update UI Header (Top right profile area)
      if (document.getElementById("uWard"))
        document.getElementById("uWard").innerText = `Administrator`;
      if (document.getElementById("uNameTop"))
        document.getElementById("uNameTop").innerText =
          userData.fullName || "Official";

      // Load all complaints globally
      initAllComplaintsListener();
    }
  } catch (error) {
    console.error("Auth Init Error:", error);
  }
});

// ================= REAL-TIME DATA FETCHING =================
function initAllComplaintsListener() {
  // No "where" clause here ensures all complaints are fetched
  const q = query(collection(db, "complaints"));

  onSnapshot(
    q,
    (snapshot) => {
      cachedDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Sort by Date (Newest first) using Firestore Timestamps
      cachedDocs.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });

      renderComplaints();
    },
    (error) => {
      console.error("Snapshot Error:", error);
    },
  );
}

// ================= UI RENDERING =================
async function renderComplaints() {
  const container = document.getElementById("complaintsContainer");
  if (!container) return;

  const lang = localStorage.getItem("lang") || "en";

  if (cachedDocs.length === 0) {
    container.innerHTML = `<div class="col-12 text-center mt-5 text-muted"><h5>No complaints found in system.</h5></div>`;
    return;
  }

  if (lang === "np") {
    container.innerHTML = `<div class="col-12 text-center mt-5"><div class="spinner-border text-warning"></div><p class="mt-2">अनुवाद गरिँदै...</p></div>`;
  }

  let cardsHtml = "";

  for (const data of cachedDocs) {
    let display = { ...data };

    // Handle Translation if Nepali is selected
    if (lang === "np") {
      try {
        display = await translateComplaint(data, "np");
      } catch (e) {}
    }

    // Visual status indicator
    const statusClass =
      {
        Open: "bg-primary",
        "In Progress": "bg-warning text-dark",
        Resolved: "bg-success",
      }[data.status] || "bg-secondary";

    const dateStr = data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleDateString()
      : "Pending";

    // Photos Logic (Fixes the [object Object] 404 error)
    let photosHtml = "";
    if (
      data.photoUrls &&
      Array.isArray(data.photoUrls) &&
      data.photoUrls.length > 0
    ) {
      const imgs = data.photoUrls
        .map((photo) => {
          const imgUrl = typeof photo === "string" ? photo : photo.url || "";
          return imgUrl
            ? `<img src="${imgUrl}" class="photo-thumbnail" onclick="window.open('${imgUrl}', '_blank')">`
            : "";
        })
        .join("");

      if (imgs) {
        photosHtml = `<div class="d-flex flex-wrap gap-2 mt-3 p-2 rounded" style="background: rgba(0,0,0,0.2);">${imgs}</div>`;
      }
    }

    cardsHtml += `
            <div class="col-md-6 search-target">
                <div class="glass-box p-4 complaint-card shadow-sm ${data.isHighPriority ? "high-priority" : ""}">
                    
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="fw-bold text-light search-text mb-0">${display.title || "Untitled"}</h5>
                        <span class="badge ${statusClass}">${data.status || "Open"}</span>
                    </div>

                    <p class="text-muted small border-bottom border-secondary border-opacity-25 pb-2 mb-2 search-text">
                        <i class="bi bi-person me-1"></i>${data.userName || "Citizen"} • 
                        <i class="bi bi-geo-alt ms-2 me-1"></i>${display.location || "Unknown"} •
                        <i class="bi bi-clock ms-2 me-1"></i>${dateStr}
                    </p>

                    <p class="card-text text-light flex-grow-1 search-text" style="font-size: 0.9rem;">
                        ${display.description || "No description provided."}
                    </p>
                    
                    <div class="mt-3">
                        <p class="text-muted small mb-2 search-text">Photos:</p>
                        ${photosHtml}
                    </div>
                    
                    <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top border-secondary border-opacity-25">
                        <div class="form-check form-switch">
                            <input class="form-check-input priority-toggle" type="checkbox" data-id="${data.id}" ${data.isHighPriority ? "checked" : ""}>
                            <label class="form-check-label small fw-bold text-danger">High Priority</label>
                        </div>

                        <div class="d-flex align-items-center gap-2">
                            <select class="form-select form-select-sm admin-input status-select" data-id="${data.id}">
                                <option value="Submitted" ${data.status === "Submitted" ? "selected" : ""}>Submitted</option>
                                <option value="In Progress" ${data.status === "In Progress" ? "selected" : ""}>In Progress</option>
                                <option value="Resolved" ${data.status === "Resolved" ? "selected" : ""}>Resolved</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>`;
  }

  container.innerHTML = cardsHtml;
}

// ================= INTERACTION HANDLERS =================
document
  .getElementById("complaintsContainer")
  ?.addEventListener("change", async (e) => {
    const docId = e.target.getAttribute("data-id");
    if (!docId) return;

    try {
      if (e.target.classList.contains("status-select")) {
        await updateDoc(doc(db, "complaints", docId), {
          status: e.target.value,
        });
      }
      if (e.target.classList.contains("priority-toggle")) {
        await updateDoc(doc(db, "complaints", docId), {
          isHighPriority: e.target.checked,
        });
      }
    } catch (error) {
      console.error("Update Error:", error);
    }
  });

// Real-time Search Logic
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll(".search-target").forEach((card) => {
    const text = Array.from(card.querySelectorAll(".search-text"))
      .map((el) => el.innerText.toLowerCase())
      .join(" ");
    card.style.display = text.includes(term) ? "block" : "none";
  });
});

// Language Select Listener
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  langSelect.addEventListener("change", () => {
    localStorage.setItem("lang", langSelect.value);
    renderComplaints();
  });
}

// Sign Out Logic
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "../../index.html"));
});

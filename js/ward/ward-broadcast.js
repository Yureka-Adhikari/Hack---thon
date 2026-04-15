import { auth, db } from "../core/firebase-config.js";
import {
  translateText,
  translateBatch,
  translateComplaint,
  translateBroadcast,
} from "../core/translator.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../citizen/login.html";
    return;
  }
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    const data = snap.data();
    if (data.role !== "ward") {
      alert("Access denied. Ward officials only.");
      window.location.href = "../citizen/login.html";
      return;
    }
    userWard = data.wardNumber || "N/A";
    userMunicipality = data.municipality || "N/A";
    const nameEl = document.getElementById("uNameTop");
    const wardEl = document.getElementById("uWard");
    if (nameEl) nameEl.innerText = data.fullName || "Official";
    if (wardEl) wardEl.innerText = `Ward ${userWard}, ${userMunicipality}`;
  }

  initBroadcastLog();
});

// ================= MAP PICKER =================
let modalMap = null;
let selectionMarker = null;
let pickedLat = null;
let pickedLng = null;

function initMap() {
  if (modalMap) {
    modalMap.invalidateSize();
    return;
  }

  modalMap = L.map("modalMap").setView([27.7172, 85.324], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(modalMap);

  // Click to place pin
  modalMap.on("click", (e) => placePin(e.latlng.lat, e.latlng.lng));
}

function placePin(lat, lng) {
  if (selectionMarker) selectionMarker.setLatLng([lat, lng]);
  else selectionMarker = L.marker([lat, lng]).addTo(modalMap);
  pickedLat = lat;
  pickedLng = lng;
  document.getElementById("latInput").value = lat.toFixed(6);
  document.getElementById("lngInput").value = lng.toFixed(6);
  document.getElementById("locationCoords").textContent =
    `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  // Reverse geocode to suggest a name
  fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
  )
    .then((r) => r.json())
    .then((data) => {
      const addr = data.display_name?.split(",").slice(0, 3).join(", ") || "";
      const nameInput = document.getElementById("locationNameInput");
      if (nameInput && addr) nameInput.value = addr;
    })
    .catch(() => {});
}

// GPS button inside modal
document.getElementById("getLocationBtn")?.addEventListener("click", () => {
  const btn = document.getElementById("getLocationBtn");
  if (!navigator.geolocation) {
    alert("GPS not supported.");
    return;
  }
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  btn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (!modalMap) initMap();
      modalMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
      placePin(pos.coords.latitude, pos.coords.longitude);
      btn.innerHTML = '<i class="bi bi-geo-alt-fill text-success"></i> GPS';
      btn.disabled = false;
    },
    () => {
      btn.innerHTML = '<i class="bi bi-crosshair me-1"></i> Get GPS';
      btn.disabled = false;
      alert("GPS unavailable.");
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
});

// Search inside modal
function doMapSearch() {
  const q = document.getElementById("mapSearchInput")?.value.trim();
  const resultsEl = document.getElementById("mapSearchResults");
  if (!q || !resultsEl) return;
  resultsEl.innerHTML = '<div class="p-2 text-muted small">Searching...</div>';

  fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
  )
    .then((r) => r.json())
    .then((results) => {
      if (!results.length) {
        resultsEl.innerHTML =
          '<div class="p-2 text-muted small">No results found.</div>';
        return;
      }
      resultsEl.innerHTML = results
        .map(
          (r) =>
            `<div onclick="window._pickSearchResult(${r.lat},${r.lon})"
          style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.82rem;color:rgba(255,255,255,0.85);"
          onmouseover="this.style.background='rgba(255,215,0,0.1)'" onmouseout="this.style.background=''">
          <i class="bi bi-geo-alt me-1 text-warning"></i>${r.display_name.split(",").slice(0, 3).join(", ")}
        </div>`,
        )
        .join("");
    })
    .catch(() => {
      resultsEl.innerHTML =
        '<div class="p-2 text-danger small">Search failed.</div>';
    });
}

window._pickSearchResult = function (lat, lon) {
  if (!modalMap) initMap();
  modalMap.setView([lat, lon], 16);
  placePin(parseFloat(lat), parseFloat(lon));
  document.getElementById("mapSearchResults").innerHTML = "";
  document.getElementById("mapSearchInput").value = "";
};

document.getElementById("mapSearchBtn")?.addEventListener("click", doMapSearch);
document.getElementById("mapSearchInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doMapSearch();
});

// Init map when modal opens
document
  .getElementById("createModal")
  ?.addEventListener("shown.bs.modal", () => {
    initMap();
    setTimeout(() => modalMap?.invalidateSize(), 200);
  });

// ================= BROADCAST LOG =================
function initBroadcastLog() {
  const container = document.getElementById("broadcastContainer");
  if (!container) return;

  const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    if (snapshot.empty) {
      container.innerHTML =
        '<div class="col-12 text-center mt-5 text-muted"><h5>No active broadcasts.</h5></div>';
      return;
    }
    snapshot.forEach((docSnap) => {
      const post = docSnap.data();
      const docId = docSnap.id;
      const dateString = post.createdAt?.toDate
        ? post.createdAt.toDate().toLocaleString()
        : "Syncing...";
      const borderColor =
        post.emergency || post.isStrike ? "#dc3545" : "#2A4B79";
      const cardClass = post.emergency || post.isStrike ? "border-danger" : "";

      const div = document.createElement("div");
      div.className = "col-md-4 mb-4";
      div.innerHTML = `
        <div style="
          padding:16px; border-radius:12px;
          background:rgba(58, 58, 58, 0.9);
          border:1px solid rgba(255,255,255,0.08);
          border-left:4px solid ${borderColor};
          position:relative;
        ">
          <button class="btn btn-sm btn-outline-danger delete-btn"
            style="position:absolute;top:10px;right:10px;padding:2px 8px;">
            <i class="bi bi-trash"></i>
          </button>
          ${post.isStrike ? `<span class="badge bg-danger mb-2 me-1">Strike/Roadblock</span>` : ""}
          ${post.emergency ? `<span class="badge bg-warning text-dark mb-2">Emergency</span>` : ""}
          <h6 class="fw-bold text-light mb-1">${post.title}</h6>
          <p class="text-muted small mb-2">${dateString}</p>
          <p style="font-size:0.85rem;color:rgba(255,255,255,0.7);">${post.content}</p>
          ${post.location ? `<div class="small text-info mt-2"><i class="bi bi-geo-alt-fill me-1"></i>${post.location}</div>` : ""}
          ${post.lat ? `<div class="small text-muted mt-1" style="font-family:monospace;">${parseFloat(post.lat).toFixed(4)}, ${parseFloat(post.lng).toFixed(4)}</div>` : ""}
        </div>`;

      div.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm("Delete this broadcast for everyone?")) {
          await deleteDoc(doc(db, "broadcasts", docId)).catch(console.error);
        }
      });

      container.appendChild(div);
    });
  });
}

// ================= POST BROADCAST =================
document.getElementById("postBtn")?.addEventListener("click", async () => {
  const title = document.getElementById("title")?.value.trim() || "";
  const content = document.getElementById("content")?.value.trim() || "";
  const category =
    document.getElementById("broadcastCategory")?.value || "General";
  const emergency = document.getElementById("emergency")?.checked || false;
  const isStrike = document.getElementById("isStrike")?.checked || false;
  const location =
    document.getElementById("locationNameInput")?.value.trim() || "";
  const lat = pickedLat;
  const lng = pickedLng;

  if (!title || !content || !lat) {
    alert("Please fill in title, content, and pick a location on the map.");
    return;
  }

  const postBtn = document.getElementById("postBtn");
  postBtn.disabled = true;
  postBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm"></span> Posting...';

  try {
    await addDoc(collection(db, "broadcasts"), {
      title,
      content,
      category,
      emergency,
      isStrike,
      location,
      lat,
      lng,
      ward: userWard,
      municipality: userMunicipality,
      userId: currentUser.uid,
      createdAt: serverTimestamp(),
    });

    // Reset form
    [
      "title",
      "content",
      "latInput",
      "lngInput",
      "locationNameInput",
      "mapSearchInput",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    document.getElementById("emergency").checked = false;
    if (document.getElementById("isStrike"))
      document.getElementById("isStrike").checked = false;
    document.getElementById("locationCoords").textContent = "";
    pickedLat = null;
    pickedLng = null;
    if (selectionMarker && modalMap) {
      modalMap.removeLayer(selectionMarker);
      selectionMarker = null;
    }

    bootstrap.Modal.getInstance(document.getElementById("createModal"))?.hide();
  } catch (err) {
    console.error(err);
    alert("Failed to post. Check Firestore Rules.");
  } finally {
    postBtn.disabled = false;
    postBtn.innerText = "Post";
  }
});

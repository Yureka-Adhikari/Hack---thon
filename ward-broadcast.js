import { db, auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateBroadcast } from "./translator.js";

let cachedBroadcasts = [];
let currentUserWard = "N/A";

// 1. AUTH & USER INFO
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    const data = snap.data();
    currentUserWard = data.wardNumber || "N/A";
    if (document.getElementById("uWard"))
      document.getElementById("uWard").innerText = `Ward ${currentUserWard}`;
    if (document.getElementById("uNameTop"))
      document.getElementById("uNameTop").innerText = data.fullName || "User";
  }
  initListener();
});

// 2. REAL-TIME LISTENER
function initListener() {
  const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    cachedBroadcasts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderBroadcasts();
  });
}

// 3. RENDER LOGIC (Fixed Category & Translation)
async function renderBroadcasts() {
  const container = document.getElementById("broadcastContainer");
  if (!container) return;

  const lang = localStorage.getItem("lang") || "en";

  // Show loading state for Nepali (API delay)
  if (lang === "np") {
    container.innerHTML =
      '<div class="col-12 text-center mt-5"><div class="spinner-border text-light"></div><p class="text-white mt-2">Translating...</p></div>';
  }

  const categoryMap = {
    Water: "0d6efd",
    Road: "dc3545",
    Waste: "198754",
    General: "6f42c1",
    Electricity: "ffc107",
  };

  let tempHtml = "";

  for (const rawData of cachedBroadcasts) {
    let displayData = { ...rawData };

    // FIX: Always use the original category for the color/logic
    const waterCat = rawData.category === "Water" ? "Water" : null;
    const roadCat = rawData.category === "Road" ? "Road" : null;
    const wasteCat = rawData.category === "Waste" ? "Waste" : null;
    const electricityCat =
      rawData.category === "Electricity" ? "Electricity" : null;
    const generalCat = rawData.category === "General" ? "General" : null;
    const color = rawData.emergency
      ? "e0333d"
      : categoryMap[generalCat] ||
        "6f42c1" ||
        categoryMap[waterCat] ||
        "0d6efd" ||
        categoryMap[roadCat] ||
        "dc3545" ||
        categoryMap[wasteCat] ||
        "198754" ||
        categoryMap[electricityCat] ||
        "ffc107";

    if (lang === "np") {
      try {
        displayData = await translateBroadcast(rawData, "np");
      } catch (e) {
        console.error("Translation Error", e);
      }
    }

    const dateString = rawData.createdAt?.toDate
      ? rawData.createdAt.toDate().toLocaleString()
      : "Syncing...";

    tempHtml += `
      <div class="col-md-4 mb-4">
          <div class="broadcast-card shadow-sm ${rawData.emergency ? "emergency" : ""}" 
               style="border-left: 6px solid #${color}; background: white; border-radius: 20px; padding: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); position: relative; min-height: 180px;">
              
              <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${rawData.id}">
                  <i class="bi bi-trash"></i>
              </button>

              <h5 class="fw-bold mt-2">${displayData.title}</h5>
              <p class="text-muted small mb-2">${dateString}</p>
              <p class="card-text">${displayData.content}</p>
          </div>
      </div>`;
  }

  container.innerHTML =
    tempHtml ||
    '<div class="col-12 text-center mt-5 text-white"><h5>No active broadcasts.</h5></div>';

  // Attach Delete Events
  container.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.onclick = async () => {
      if (confirm("Delete this broadcast?"))
        await deleteDoc(doc(db, "broadcasts", btn.dataset.id));
    };
  });
}

// 4. CREATE BROADCAST
document.getElementById("postBtn")?.addEventListener("click", async () => {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const category = document.getElementById("category").value || "General";
  const emergency = document.getElementById("emergency").checked;

  if (!title || !content) return alert("Please fill all fields");

  const btn = document.getElementById("postBtn");
  btn.disabled = true;
  btn.innerText = "Posting...";

  try {
    await addDoc(collection(db, "broadcasts"), {
      title,
      content,
      category,
      emergency,
      wardNumber: currentUserWard,
      createdAt: serverTimestamp(),
    });
    bootstrap.Modal.getInstance(document.getElementById("createModal")).hide();
    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
  } catch (error) {
    alert("Error posting");
  } finally {
    btn.disabled = false;
    btn.innerText = "Post";
  }
});

// 5. LANGUAGE SWITCHER
document.getElementById("languageSelect")?.addEventListener("change", (e) => {
  localStorage.setItem("lang", e.target.value);
  renderBroadcasts();
});

// 6. LOGOUT
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

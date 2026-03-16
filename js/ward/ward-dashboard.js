import { auth, db } from "../core/firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ===== LINGVA TRANSLATION =====
const translateCache = {};
async function lingvaTranslate(text, targetLang) {
  if (!text || targetLang === "en") return text;
  const cacheKey = `${targetLang}:${text}`;
  if (translateCache[cacheKey]) return translateCache[cacheKey];
  try {
    const res = await fetch(
      `https://lingva.ml/api/v1/en/${targetLang}/${encodeURIComponent(text)}`,
    );
    const json = await res.json();
    const translated = json.translation || text;
    translateCache[cacheKey] = translated;
    return translated;
  } catch {
    return text;
  }
}

const translations = {
  en: {
    searchPlaceholder: "Search...",
    dashboardNav: "Dashboard",
    signOut: "Sign Out",
    statusSubmitted: "Submitted",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    noUpdates: "No updates available",
    noAlerts: "No alerts",
    emergencyTag: "EMERGENCY",
    justNow: "Just now",
    translating: "Translating...",
    updCatWater: "Water",
    updCatRoad: "Road",
    updCatWaste: "Waste",
    updCatGeneral: "General",
    updCatElectricity: "Electricity",
  },
  np: {
    searchPlaceholder: "खोज्नुहोस्...",
    dashboardNav: "मुख्य विवरण",
    signOut: "साइन आऊट",
    statusSubmitted: "पेश गरियो",
    statusInProgress: "प्रगति हुँदैछ",
    statusResolved: "समाधान भएको",
    noUpdates: "कुनै अपडेट उपलब्ध छैन",
    noAlerts: "कुनै सूचना छैन",
    emergencyTag: "आपत्कालीन",
    justNow: "भर्खरै",
    translating: "अनुवाद हुँदैछ...",
    updCatWater: "पानी",
    updCatRoad: "सडक",
    updCatWaste: "फोहोर",
    updCatGeneral: "सामान्य",
    updCatElectricity: "बिजुली",
  },
};

function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return translations[lang]?.[key] || translations.en[key] || key;
}

const categoryMap = {
  Water: { hex: "#0d6efd", badge: "primary", key: "updCatWater" },
  Road: { hex: "#dc3545", badge: "danger", key: "updCatRoad" },
  Waste: { hex: "#198754", badge: "success", key: "updCatWaste" },
  General: { hex: "#6f42c1", badge: "secondary", key: "updCatGeneral" },
  Electricity: { hex: "#ffc107", badge: "warning", key: "updCatElectricity" },
};

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";
let cachedBroadcasts = [];

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
      await signOut(auth);
      window.location.href = "../citizen/login.html";
      return;
    }
    const nameEl = document.getElementById("uNameMain");
    const nameTopEl = document.getElementById("uNameTop");
    const wardEl = document.getElementById("uWard");
    if (nameEl) nameEl.innerText = data.fullName || "Official";
    if (nameTopEl) nameTopEl.innerText = data.fullName || "Official";
    userWard = data.wardNumber || "N/A";
    userMunicipality = data.municipality || "N/A";
    if (wardEl) wardEl.innerText = `Ward ${userWard}, ${userMunicipality}`;
  }

  loadBroadcasts();
  await loadWardStats();
  await loadComplaints();
  setupAlertButton();
});

// ================= WARD STATS =================
async function loadWardStats() {
  if (userWard === "N/A") return;
  const q = query(
    collection(db, "complaints"),
    where("wardNumber", "==", userWard),
    where("municipality", "==", userMunicipality),
  );
  const snapshot = await getDocs(q);

  let open = 0,
    inProgress = 0,
    resolved = 0,
    highPriority = 0;
  snapshot.forEach((d) => {
    const s = d.data().status;
    if (s === "Submitted") open++;
    else if (s === "In Progress") inProgress++;
    else if (s === "Resolved") resolved++;
    if (d.data().isHighPriority === true) highPriority++;
  });

  const kpiOpenEl = document.getElementById("kpiOpen");
  const kpiProgEl = document.getElementById("kpiProg");
  const kpiResEl = document.getElementById("kpiRes");
  const kpiHighEl = document.getElementById("kpiHigh");
  if (kpiOpenEl) kpiOpenEl.textContent = open + inProgress;
  if (kpiProgEl) kpiProgEl.textContent = inProgress;
  if (kpiResEl) kpiResEl.textContent = resolved;
  if (kpiHighEl) kpiHighEl.textContent = highPriority;

  if (window.updateChart) window.updateChart(open, inProgress, resolved);
}

// ================= LOAD COMPLAINTS =================
async function loadComplaints() {
  const container = document.getElementById("complaintsContainer");
  if (!container || userWard === "N/A") return;
  container.innerHTML = "";

  const q = query(
    collection(db, "complaints"),
    where("wardNumber", "==", userWard),
    where("municipality", "==", userMunicipality),
  );
  const snapshot = await getDocs(q);
  const complaints = [];
  snapshot.forEach((d) => complaints.push(d.data()));
  complaints.sort(
    (a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0),
  );

  if (complaints.length === 0) {
    container.innerHTML = "<p class='text-muted small'>No complaints yet.</p>";
    return;
  }

  complaints.slice(0, 10).forEach((c) => {
    const badgeClass =
      c.status === "Submitted"
        ? "bg-primary"
        : c.status === "In Progress"
          ? "bg-warning text-dark"
          : "bg-success";
    container.innerHTML += `
      <div class="d-flex justify-content-between align-items-start mb-2 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <div class="fw-semibold text-light" style="font-size:0.9rem;">${c.title}</div>
          <small class="text-muted">${c.location || ""} · ${c.createdAt ? c.createdAt.toDate().toLocaleDateString() : ""}</small>
        </div>
        <span class="badge ${badgeClass} ms-2" style="white-space:nowrap;">${c.status}</span>
      </div>`;
  });
}

// ================= LOAD BROADCASTS =================
function loadBroadcasts() {
  const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));
  onSnapshot(q, async (snapshot) => {
    cachedBroadcasts = [];
    snapshot.forEach((d) => {
      const raw = d.data();
      cachedBroadcasts.push({
        title: raw.title || "",
        content: raw.content || "",
        category: raw.category || "General",
        emergency: raw.emergency || false,
        createdAt: raw.createdAt,
      });
    });
    await renderBroadcasts();
  });
}

// ================= RENDER BROADCASTS =================
async function renderBroadcasts() {
  const emergencyList = document.getElementById("emergencyList");
  if (!emergencyList) return;

  const lang = localStorage.getItem("lang") || "en";
  const titles = cachedBroadcasts.map((b) => b.title);
  const translatedTitles =
    lang === "np"
      ? await Promise.all(titles.map((t) => lingvaTranslate(t, lang)))
      : titles;

  const translated = cachedBroadcasts.map((b, i) => ({
    ...b,
    title: translatedTitles[i],
  }));
  const emergencies = translated.filter((b) => b.emergency);

  emergencyList.innerHTML =
    emergencies.length === 0
      ? `<p class="text-muted small">${t("noAlerts")}</p>`
      : emergencies
          .map((data) => {
            const cat = categoryMap[data.category] || categoryMap["General"];
            const dateStr = data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleDateString()
              : t("justNow");
            return `<div class="emergency-item mb-2">
          <span class="badge bg-danger me-1" style="font-size:0.65rem;">${t("emergencyTag")}</span>
          <span class="fw-bold text-light" style="font-size:0.85rem;">${data.title}</span>
          <small class="text-muted d-block mt-1">${dateStr}</small>
        </div>`;
          })
          .join("");
}

// ================= BROADCAST FORM =================
function setupAlertButton() {
  const postBtn = document.getElementById("postBtn");
  if (!postBtn) return;

  postBtn.addEventListener("click", async () => {
    const title = document.getElementById("alertTitle")?.value.trim() || "";
    const category =
      document.getElementById("alertCategory")?.value || "General";
    const content =
      document.getElementById("alertDescription")?.value.trim() || "";
    const emergency =
      document.getElementById("alertEmergency")?.checked || false;
    const locationEl = document.getElementById("alertLocation");
    const location = locationEl?.value.trim() || "";
    const gpsLat = locationEl?.dataset.lat
      ? parseFloat(locationEl.dataset.lat)
      : null;
    const gpsLng = locationEl?.dataset.lng
      ? parseFloat(locationEl.dataset.lng)
      : null;

    if (!title || !content) {
      alert("Please fill in the title and message.");
      return;
    }

    postBtn.disabled = true;
    postBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm"></span> Sending...';

    try {
      await addDoc(collection(db, "broadcasts"), {
        title,
        content,
        category,
        emergency,
        location,
        gpsLocation: gpsLat ? { latitude: gpsLat, longitude: gpsLng } : null,
        ward: userWard,
        municipality: userMunicipality,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      document.getElementById("alertTitle").value = "";
      document.getElementById("alertDescription").value = "";
      const locEl = document.getElementById("alertLocation");
      if (locEl) {
        locEl.value = "";
        delete locEl.dataset.lat;
        delete locEl.dataset.lng;
      }
      document.getElementById("alertEmergency").checked = false;
      const coordsDisplay = document.getElementById("alertLocationCoords");
      if (coordsDisplay) coordsDisplay.textContent = "";
      alert("Broadcast sent successfully!");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to send. Check Firestore Rules.");
    } finally {
      postBtn.disabled = false;
      postBtn.innerText = "Transmit Broadcast";
    }
  });
}

// ================= LOGOUT =================
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "../../index.html"));
});

// ================= LANGUAGE SELECTOR =================
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  const stored = localStorage.getItem("lang") || "en";
  langSelect.value = stored;
  langSelect.addEventListener("change", async () => {
    localStorage.setItem("lang", langSelect.value);
    await renderBroadcasts();
  });
}

import { auth, db } from "../core/firebase-config.js";
import {
  translateText,
  translateBatch,
  translateComplaint,
  translateBroadcast,
} from "../core/translator.js";
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
  console.log("Auth OK, uid:", user.uid);

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    console.log("User doc exists:", snap.exists());

    if (snap.exists()) {
      const data = snap.data();
      console.log("User doc data:", JSON.stringify(data));

      // Accept ward role OR allow if redirected from login with admin selector
      // (role may be missing for manually created ward accounts)
      const role = (data.role || "").toString().toLowerCase().trim();
      if (role && role !== "ward") {
        alert("Access denied. Ward officials only.");
        await signOut(auth);
        window.location.href = "../citizen/login.html";
        return;
      }

      const nameEl = document.getElementById("uNameMain");
      const nameTopEl = document.getElementById("uNameTop");
      const wardEl = document.getElementById("uWard");
      const name = data.fullName || user.email?.split("@")[0] || "Official";
      if (nameEl) nameEl.innerText = name;
      if (nameTopEl) nameTopEl.innerText = name;

      // Handle wardNumber as string or number
      userWard =
        data.wardNumber != null ? String(data.wardNumber).trim() : "N/A";
      userMunicipality =
        data.municipality != null ? String(data.municipality).trim() : "N/A";

      console.log("userWard:", userWard, "userMunicipality:", userMunicipality);

      if (wardEl) wardEl.innerText = `Ward ${userWard}, ${userMunicipality}`;
    } else {
      // No user doc — create a minimal one so dashboard works
      console.warn(
        "No user doc found for uid:",
        user.uid,
        "— using email fallback",
      );
      const nameTopEl = document.getElementById("uNameTop");
      const nameEl = document.getElementById("uNameMain");
      const name = user.email?.split("@")[0] || "Official";
      if (nameTopEl) nameTopEl.innerText = name;
      if (nameEl) nameEl.innerText = name;
      // userWard stays N/A — complaints won't filter but at least dashboard loads
    }
  } catch (e) {
    console.error("Error loading user doc:", e);
  }

  loadBroadcasts();
  loadComplaintsLive();
  setupAlertButton();
});

// ================= WARD STATS =================
async function loadWardStats() {
  if (userWard === "N/A") return;
  // Fetch all complaints, filter client-side — no composite index needed
  const snapshot = await getDocs(collection(db, "complaints"));
  const wardStr = String(userWard).trim().toLowerCase();
  const muniStr = String(userMunicipality).trim().toLowerCase();

  let open = 0,
    inProgress = 0,
    resolved = 0,
    highPriority = 0;
  snapshot.forEach((d) => {
    const data = d.data();
    const docWard = String(data.wardNumber || "")
      .trim()
      .toLowerCase();
    const docMuni = String(data.municipality || "")
      .trim()
      .toLowerCase();
    // Match ward — also accept if municipality matches when ward is blank
    if (docWard !== wardStr && docMuni !== muniStr) return;
    if (docWard !== wardStr) return;
    const s = data.status;
    if (s === "Submitted") open++;
    else if (s === "In Progress") inProgress++;
    else if (s === "Resolved") resolved++;
    if (data.isHighPriority === true) highPriority++;
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
  container.innerHTML = '<p class="text-muted small">Loading...</p>';

  // Fetch all, filter client-side — avoids composite index issues
  const snapshot = await getDocs(collection(db, "complaints"));
  const wardStr = String(userWard).trim().toLowerCase();
  const complaints = [];
  snapshot.forEach((d) => {
    const data = d.data();
    const docWard = String(data.wardNumber || "")
      .trim()
      .toLowerCase();
    if (docWard === wardStr) complaints.push({ id: d.id, ...data });
  });
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

// ================= LIVE COMPLAINTS (real-time) =================
function loadComplaintsLive() {
  const wardStr = String(userWard).trim();
  const filterByWard = wardStr && wardStr !== "N/A";
  console.log(
    "loadComplaintsLive — wardStr:",
    wardStr,
    "filtering:",
    filterByWard,
  );

  onSnapshot(collection(db, "complaints"), (snapshot) => {
    const complaints = [];
    let open = 0,
      inProgress = 0,
      resolved = 0,
      highPriority = 0;
    console.log("Total complaints in Firestore:", snapshot.size);

    snapshot.forEach((d) => {
      const data = d.data();
      if (filterByWard) {
        const docWard = String(data.wardNumber ?? "").trim();
        // Case-insensitive, handles "4" vs 4 vs "04"
        if (
          docWard.toLowerCase() !== wardStr.toLowerCase() &&
          docWard !== wardStr
        )
          return;
      }
      complaints.push({ id: d.id, ...data });
      const s = data.status;
      if (s === "Submitted") open++;
      else if (s === "In Progress") inProgress++;
      else if (s === "Resolved") resolved++;
      if (data.isHighPriority === true) highPriority++;
    });

    // Update KPIs
    const kpiOpenEl = document.getElementById("kpiOpen");
    const kpiProgEl = document.getElementById("kpiProg");
    const kpiResEl = document.getElementById("kpiRes");
    const kpiHighEl = document.getElementById("kpiHigh");
    if (kpiOpenEl) kpiOpenEl.textContent = open + inProgress;
    if (kpiProgEl) kpiProgEl.textContent = inProgress;
    if (kpiResEl) kpiResEl.textContent = resolved;
    if (kpiHighEl) kpiHighEl.textContent = highPriority;

    // Update chart
    if (window.updateChart) window.updateChart(open, inProgress, resolved);

    // Update complaints list
    const container = document.getElementById("complaintsContainer");
    if (!container) return;

    complaints.sort(
      (a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0),
    );

    if (complaints.length === 0) {
      container.innerHTML =
        "<p class='text-muted small'>No complaints for this ward yet.</p>";
      return;
    }

    container.innerHTML = "";
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
      ? await Promise.all(titles.map((t) => translateText(t, lang)))
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
        lat: gpsLat || null,
        lng: gpsLng || null,
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
  if (stored !== "en") renderBroadcasts();
  langSelect.addEventListener("change", async () => {
    localStorage.setItem("lang", langSelect.value);
    await renderBroadcasts();
  });
}

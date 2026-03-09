import { auth, db } from "./firebase-config.js";
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
import { translateComplaint, translateBroadcast } from "./translator.js";

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

// ===== In-memory caches (always raw English from Firestore) =====
let cachedLatestComplaint = null;
let cachedBroadcasts = [];

// ================= TRANSLATIONS (UI labels) =================
const translations = {
  en: {
    searchPlaceholder: "Search...",
    dashboardNav: "Dashboard",
    myComplaintsNav: "My Complaints",
    documentsNav: "Documents",
    broadcastNav: "Broadcast Channel",
    roadNav: "Road",
    chatbotNav: "Guidance Chatbot",
    settingsNav: "Settings",
    signOut: "Sign Out",
    welcome: "Welcome",
    submitComplaint: "Submit Complaint",
    reportIssues: "Report local issues!",
    createNew: "Create New",
    quickActions: "Quick Actions",
    noWater: "No Water",
    noElectricity: "No Electricity",
    roadDamage: "Road Damage",
    myComplaintsCard: "My Complaints",
    viewComplaint: "View Complaint",
    recentUpdates: "Recent Updates",
    emergencyAlerts: "Emergency Alerts",
    statusSubmitted: "Submitted",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    alertLogin: "Please login first.",
    alertSubmitSuccess: "Complaint submitted successfully!",
    alertSubmitError: "Error submitting complaint.",
    noComplaints: "No complaints yet",
    noUpdates: "No updates available",
    noAlerts: "No alerts",
    updCatWater: "Water",
    updCatRoad: "Road",
    updCatWaste: "Waste",
    updCatGeneral: "General",
    updCatElectricity: "Electricity",
    catWater: "Water",
    catElectricity: "Electricity",
    catRoad: "Road",
    catWaste: "Waste",
    catOther: "Other",
    emergencyTag: "EMERGENCY",
    justNow: "Just now",
    labelStatus: "Status",
    labelCategory: "Category",
    labelLocation: "Location",
    translating: "Translating...",
  },
  np: {
    searchPlaceholder: "खोज्नुहोस्...",
    dashboardNav: "मुख्य विवरण",
    myComplaintsNav: "मेरा गुनासोहरू",
    documentsNav: "कागजातहरू",
    broadcastNav: "चौतारी",
    roadNav: "नक्सा",
    chatbotNav: "मार्गदर्शन चैटबोट",
    settingsNav: "सेटिङहरू",
    signOut: "साइन आऊट",
    welcome: "स्वागत छ",
    submitComplaint: "गुनासो पेश गर्नुहोस्",
    reportIssues: "स्थानीय समस्या रिपोर्ट गर्नुहोस्!",
    createNew: "नयाँ गुनासो दर्ता गर्नुहोस्",
    quickActions: "छिटो क्रियाहरू",
    noWater: "पानी छैन",
    noElectricity: "बिजुली छैन",
    roadDamage: "सडक क्षति",
    myComplaintsCard: "मेरा गुनासोहरू",
    viewComplaint: "गुनासो हेर्नुहोस्",
    recentUpdates: "हालका सूचनाहरू",
    emergencyAlerts: "आपत्कालीन चेतावनीहरू",
    statusSubmitted: "पेश गरियो",
    statusInProgress: "प्रगति हुँदैछ",
    statusResolved: "समाधान भएको",
    alertLogin: "कृपया पहिले लगइन गर्नुहोस्।",
    alertSubmitSuccess: "गुनासो सफलतापूर्वक पेश गरियो!",
    alertSubmitError: "गुनासो पेश गर्दा त्रुटि भयो।",
    noComplaints: "अहिलेसम्म कुनै गुनासो छैन",
    noUpdates: "कुनै अपडेट उपलब्ध छैन",
    noAlerts: "कुनै सूचना छैन",
    updCatWater: "पानी",
    updCatRoad: "सडक",
    updCatWaste: "फोहोर",
    updCatGeneral: "सामान्य",
    updCatElectricity: "बिजुली",
    catWater: "पानी",
    catElectricity: "बिजुली",
    catRoad: "सडक",
    catWaste: "फोहोर",
    catOther: "अन्य",
    emergencyTag: "आपत्कालीन",
    justNow: "भर्खरै",
    labelStatus: "स्थिति",
    labelCategory: "श्रेणी",
    labelLocation: "स्थान",
    translating: "अनुवाद हुँदैछ...",
  },
};

// ================= HELPERS =================
function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return translations[lang]?.[key] || translations.en[key] || key;
}

function translateStatus(rawStatus) {
  const map = {
    Submitted: "statusSubmitted",
    "In Progress": "statusInProgress",
    Resolved: "statusResolved",
  };
  return t(map[rawStatus] || "statusSubmitted");
}

function translateCategory(rawCategory) {
  const map = {
    Water: "catWater",
    Electricity: "catElectricity",
    Road: "catRoad",
    Waste: "catWaste",
    Other: "catOther",
    General: "updCatGeneral",
  };
  return t(map[rawCategory] || "catOther");
}

const categoryMap = {
  Water: { color: "0d6efd", bgColor: "primary", key: "updCatWater" },
  Road: { color: "dc3545", bgColor: "danger", key: "updCatRoad" },
  Waste: { color: "198754", bgColor: "success", key: "updCatWaste" },
  General: { color: "6f42c1", bgColor: "secondary", key: "updCatGeneral" },
  Electricity: {
    color: "ffc107",
    bgColor: "warning",
    key: "updCatElectricity",
  },
};

// ================= AUTH LISTENER =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    const data = snap.data();
    document.getElementById("uNameMain").innerText = data.fullName;
    document.getElementById("uNameTop").innerText = data.fullName;
    userWard = data.wardNumber || "N/A";
    userMunicipality = data.municipality || "N/A";
    document.getElementById("uWard").innerText =
      `Ward ${userWard}, ${userMunicipality}`;
  }

  // Load latest complaint into cache, then render
  const q = query(
    collection(db, "complaints"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    cachedLatestComplaint = snapshot.docs[0].data();
  }
  await renderLatestComplaint();
});

// ================= RENDER LATEST COMPLAINT =================
// Reads from cache. User-written title is translated via API (cached after first call).
// Status, category use local lookup — no API needed.
async function renderLatestComplaint() {
  const lang = localStorage.getItem("lang") || "en";
  const titleEl = document.getElementById("latestTitle");
  const statusEl = document.getElementById("latestStatus");
  const catEl = document.getElementById("latestCategory");
  const locEl = document.getElementById("latestLocation");

  if (!cachedLatestComplaint) {
    if (titleEl) titleEl.innerText = t("noComplaints");
    if (statusEl) statusEl.innerText = "-";
    if (catEl) catEl.innerText = "-";
    if (locEl) locEl.innerText = "-";
    return;
  }

  const d = cachedLatestComplaint;

  // Show spinner while API call is in-flight (only first time per session)
  if (lang === "np" && titleEl) {
    titleEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${t("translating")}`;
  }

  // Translate the user-written title via MyMemory (cached after first call)
  let translatedTitle = d.title;
  if (lang === "np") {
    const result = await translateComplaint(
      { title: d.title, description: "" },
      lang,
    );
    translatedTitle = result.title;
  }

  if (titleEl) titleEl.innerText = translatedTitle;
  if (statusEl) {
    statusEl.dataset.raw = d.status; // keep raw English for progress bar
    statusEl.innerText = translateStatus(d.status);
  }
  if (catEl) catEl.innerText = translateCategory(d.category);
  if (locEl) locEl.innerText = d.location;

  // Translate the static "Status / Category / Location" bold labels
  document.querySelector('[data-label="status"]')?.innerText &&
    (document.querySelector('[data-label="status"]').innerText =
      t("labelStatus") + ":");
  document.querySelector('[data-label="category"]')?.innerText &&
    (document.querySelector('[data-label="category"]').innerText =
      t("labelCategory") + ":");
  document.querySelector('[data-label="location"]')?.innerText &&
    (document.querySelector('[data-label="location"]').innerText =
      t("labelLocation") + ":");

  updateProgress(d.status);
}

// ================= LOAD BROADCASTS (Firestore listener) =================
function loadBroadcasts() {
  const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));

  onSnapshot(q, async (snapshot) => {
    cachedBroadcasts = [];
    snapshot.forEach((docSnap) => {
      const raw = docSnap.data();
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

if (document.getElementById("updatesList")) {
  loadBroadcasts();
}

// ================= RENDER BROADCASTS =================
// Translates titles via API in parallel; badge labels via local lookup.
async function renderBroadcasts() {
  const updatesList = document.getElementById("updatesList");
  const emergencyList = document.getElementById("emergencyList");
  if (!updatesList || !emergencyList) return;

  const lang = localStorage.getItem("lang") || "en";
  updatesList.innerHTML = emergencyList.innerHTML = "";

  if (cachedBroadcasts.length === 0) {
    updatesList.innerHTML = `<li class="list-group-item text-muted small">${t("noUpdates")}</li>`;
    emergencyList.innerHTML = `<li class="list-group-item text-muted small">${t("noAlerts")}</li>`;
    return;
  }

  // Spinner while API calls are in-flight
  if (lang === "np") {
    updatesList.innerHTML = `
      <li class="list-group-item text-muted small">
        <span class="spinner-border spinner-border-sm me-1"></span>${t("translating")}
      </li>`;
  }

  // Translate all broadcast titles in parallel (cached after first call)
  const translatedList = await Promise.all(
    cachedBroadcasts.map(async (data) => {
      if (lang !== "np") return data;
      const { title } = await translateBroadcast(data, lang);
      return { ...data, title };
    }),
  );

  updatesList.innerHTML = emergencyList.innerHTML = "";
  let hasRegular = false,
    hasEmergency = false;

  translatedList.forEach((data) => {
    const catStyle = categoryMap[data.category] || categoryMap["General"];
    const dateString = data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleDateString()
      : t("justNow");

    const item = document.createElement("li");
    item.className = "list-group-item" + (data.emergency ? " emergency" : "");
    item.style.cssText = data.emergency
      ? "border: 1px solid #dc3545; border-left: 4px solid #dc3545;"
      : `border-left: 4px solid #${catStyle.color};`;

    item.innerHTML = `
      <span class="badge bg-${data.emergency ? "danger" : catStyle.bgColor} me-2">
        ${data.emergency ? t("emergencyTag") : t(catStyle.key)}
      </span>
      <span class="fw-bold">${data.title}</span><br>
      <small class="text-muted d-block mt-1">${dateString}</small>`;

    item.onclick = () => alert(data.title + "\n\n" + data.content);

    if (data.emergency) {
      emergencyList.appendChild(item);
      hasEmergency = true;
    } else {
      updatesList.appendChild(item);
      hasRegular = true;
    }
  });

  if (!hasRegular)
    updatesList.innerHTML = `<li class="list-group-item text-muted small">${t("noUpdates")}</li>`;
  if (!hasEmergency)
    emergencyList.innerHTML = `<li class="list-group-item text-muted small">${t("noAlerts")}</li>`;
}

// ================= UPDATE LANGUAGE =================
async function updateLanguage(lang) {
  // 1. Static [data-i18n] labels
  const data = translations[lang] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key || data[key] === undefined) return;
    if (el.tagName === "INPUT") el.placeholder = data[key];
    else el.innerText = data[key];
  });

  // 2. Re-render dynamic sections from cache (with live translation)
  await renderLatestComplaint();
  await renderBroadcasts();
}

// ================= PROGRESS BAR =================
function updateProgress(status) {
  if (!status) return;
  const norm = status.toString().trim().toLowerCase().replace(/\s+/g, "");
  const seg1 = document.getElementById("progressSegment1");
  const seg2 = document.getElementById("progressSegment2");
  const nodeSub = document.getElementById("nodeSubmitted");
  const nodeIn = document.getElementById("nodeInProgress");
  const nodeRes = document.getElementById("nodeResolved");
  if (!seg1 || !seg2 || !nodeSub || !nodeIn || !nodeRes) return;

  seg1.style.width = seg2.style.width = "0%";
  nodeSub.querySelector(".node-circle").style.background = "#0d47a1";
  nodeIn.querySelector(".node-circle").style.background =
    norm === "inprogress" || norm === "resolved" ? "#ffc107" : "#e0e0e0";
  nodeRes.querySelector(".node-circle").style.background =
    norm === "resolved" ? "#28a745" : "#e0e0e0";

  if (norm === "inprogress") {
    seg1.style.width = "50%";
  } else if (norm === "resolved") {
    seg1.style.width = "50%";
    seg2.style.width = "50%";
  }
}

// ================= LANGUAGE SELECTOR =================
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  const stored = localStorage.getItem("lang") || "en";
  langSelect.value = stored;
  updateLanguage(stored);
  langSelect.addEventListener("change", async () => {
    localStorage.setItem("lang", langSelect.value);
    await updateLanguage(langSelect.value);
  });
}

// ================= LOGOUT =================
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

// ================= SIDEBAR ACTIVE LINK =================
const navLinks = document.querySelectorAll("#sidebar .nav-link");
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});

// ================= SUBMIT COMPLAINT =================
async function submitComplaint(data) {
  const user = auth.currentUser;
  if (!user) {
    alert(t("alertLogin"));
    return;
  }
  try {
    await addDoc(collection(db, "complaints"), {
      title: data.title,
      category: data.category,
      description: data.description,
      location: data.location,
      municipality: data.municipality,
      wardNumber: data.wardNumber,
      status: "Submitted",
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    alert(t("alertSubmitSuccess"));
    window.location.href = "my-complaints.html";
  } catch (error) {
    console.error(error);
    alert(t("alertSubmitError"));
  }
}

// ================= MODAL SUBMIT =================
document.getElementById("submitComplaintBtn")?.addEventListener("click", () => {
  submitComplaint({
    title: document.getElementById("title").value,
    category: document.getElementById("category").value,
    description: document.getElementById("description").value,
    location: document.getElementById("location").value,
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});

// ================= QUICK ACTION BUTTONS =================
document.getElementById("quickRoad")?.addEventListener("click", () => {
  submitComplaint({
    title: "Road Damage",
    category: "Road",
    description: "There is a damaged road in my area.",
    location: "Near my area",
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});
document.getElementById("quickWater")?.addEventListener("click", () => {
  submitComplaint({
    title: "Water Issue",
    category: "Water",
    description: "No water supply in my area.",
    location: "Near my area",
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});
document.getElementById("quickElectric")?.addEventListener("click", () => {
  submitComplaint({
    title: "Electricity Issue",
    category: "Electricity",
    description: "Power outage in my area.",
    location: "Near my area",
    municipality: userMunicipality,
    wardNumber: userWard,
  });
});

// ================= VIEW COMPLAINT BUTTON =================
document.getElementById("viewComplaintBtn")?.addEventListener("click", () => {
  window.location.href = "my-complaints.html";
});

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

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";
let cachedLatestComplaint = null;
let cachedBroadcasts = [];

// ================= TRANSLATIONS =================
const translations = {
  en: {
    searchPlaceholder: "Search...",
    dashboardNav: "Dashboard",
    myComplaintsNav: "My Complaints",
    documentsNav: "Documents",
    broadcastNav: "Broadcast Channel",
    map: "Live Map",
    aiChatbot: "Guidance Chatbot",
    settingsNav: "Settings",
    signOut: "Sign Out",
    hi: "Hi",
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
    upcomingEvents: "Upcoming Events & Notices",
    latestBroadcast: "Latest Broadcast",
    latestReport: "Latest Report Status",
    statusSubmitted: "Submitted",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    alertLogin: "Please login first.",
    alertSubmitSuccess: "Complaint submitted successfully!",
    alertSubmitError: "Error submitting complaint.",
    noComplaints: "No complaints yet",
    noUpdates: "No updates available",
    noAlerts: "No alerts",
    noEvents: "No upcoming events",
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
    hotTopic: "Today's Hot Topic",
    readMore: "Read Full Article",
    emergencyContacts: "Emergency (Nepal)",
  },
  np: {
    searchPlaceholder: "खोज्नुहोस्...",
    dashboardNav: "मुख्य विवरण",
    myComplaintsNav: "मेरा गुनासोहरू",
    documentsNav: "कागजातहरू",
    broadcastNav: "चौतारी",
    map: "नक्सा",
    aiChatbot: "मार्गदर्शन चैटबोट",
    settingsNav: "सेटिङहरू",
    signOut: "साइन आऊट",
    hi: "नमस्ते",
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
    upcomingEvents: "आगामी कार्यक्रम र सूचनाहरू",
    latestBroadcast: "पछिल्लो प्रसारण",
    latestReport: "पछिल्लो रिपोर्ट स्थिति",
    statusSubmitted: "पेश गरियो",
    statusInProgress: "प्रगति हुँदैछ",
    statusResolved: "समाधान भएको",
    alertLogin: "कृपया पहिले लगइन गर्नुहोस्।",
    alertSubmitSuccess: "गुनासो सफलतापूर्वक पेश गरियो!",
    alertSubmitError: "गुनासो पेश गर्दा त्रुटि भयो।",
    noComplaints: "अहिलेसम्म कुनै गुनासो छैन",
    noUpdates: "कुनै अपडेट उपलब्ध छैन",
    noAlerts: "कुनै सूचना छैन",
    noEvents: "आगामी कार्यक्रमहरू छैनन्",
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
    hotTopic: "आजको मुख्य विषय",
    readMore: "पूरा लेख पढ्नुहोस्",
    emergencyContacts: "आपत्कालीन (नेपाल)",
  },
};

function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

function translateStatus(s) {
  const map = {
    Submitted: "statusSubmitted",
    "In Progress": "statusInProgress",
    Resolved: "statusResolved",
  };
  return t(map[s] || "statusSubmitted");
}

function translateCategory(c) {
  const map = {
    Water: "catWater",
    Electricity: "catElectricity",
    Road: "catRoad",
    Waste: "catWaste",
    Other: "catOther",
    General: "updCatGeneral",
  };
  return t(map[c] || "catOther");
}

const categoryMap = {
  Water: { hex: "#0d6efd", badge: "primary", key: "updCatWater" },
  Road: { hex: "#dc3545", badge: "danger", key: "updCatRoad" },
  Waste: { hex: "#198754", badge: "success", key: "updCatWaste" },
  General: { hex: "#6f42c1", badge: "secondary", key: "updCatGeneral" },
  Electricity: { hex: "#ffc107", badge: "warning", key: "updCatElectricity" },
  Other: { hex: "#6c757d", badge: "secondary", key: "catOther" },
};

// ================= LINGVA TRANSLATION (API) =================
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

async function lingvaTranslateAll(texts, targetLang) {
  if (targetLang === "en") return texts;
  return Promise.all(texts.map((txt) => lingvaTranslate(txt, targetLang)));
}

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
    const name = data.fullName || "Citizen";
    userWard = data.wardNumber || "N/A";
    userMunicipality = data.municipality || "N/A";

    document.getElementById("uNameMain").innerText = name;
    document.getElementById("uNameTop").innerText = name;
    document.getElementById("uWard").innerText =
      `Ward ${userWard}, ${userMunicipality}`;

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    const av1 = document.getElementById("userAvatar");
    if (av1) av1.src = avatarUrl;
  }

  const q = query(
    collection(db, "complaints"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) cachedLatestComplaint = snapshot.docs[0].data();
  await renderLatestComplaint();
});

// ================= RENDER LATEST COMPLAINT =================
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

  if (lang === "np" && titleEl) {
    titleEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${t("translating")}`;
  }
  const translatedTitle = await lingvaTranslate(d.title, lang);

  if (titleEl) titleEl.innerText = translatedTitle;
  if (statusEl) {
    statusEl.dataset.raw = d.status;
    statusEl.innerText = translateStatus(d.status);
  }
  if (catEl) catEl.innerText = translateCategory(d.category);
  if (locEl) locEl.innerText = d.location || "-";

  updateProgress(d.status);
}

// ================= LOAD BROADCASTS =================
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
        eventDate: raw.eventDate || null,
      });
    });
    await renderBroadcasts();
    await renderUpcomingEvents();
  });
}

// Gate on any of the three lists existing
if (
  document.getElementById("updatesList") ||
  document.getElementById("emergencyList") ||
  document.getElementById("upcomingEventsList")
) {
  loadBroadcasts();
}

// ================= RENDER BROADCASTS =================
async function renderBroadcasts() {
  const updatesList = document.getElementById("updatesList");
  const emergencyList = document.getElementById("emergencyList");
  if (!updatesList || !emergencyList) return;

  const lang = localStorage.getItem("lang") || "en";
  updatesList.innerHTML = emergencyList.innerHTML = "";

  if (cachedBroadcasts.length === 0) {
    updatesList.innerHTML = `<li class="text-muted small p-1">${t("noUpdates")}</li>`;
    emergencyList.innerHTML = `<li class="text-muted small p-1">${t("noAlerts")}</li>`;
    return;
  }

  if (lang === "np") {
    updatesList.innerHTML = `<li class="text-muted small p-1"><span class="spinner-border spinner-border-sm me-1"></span>${t("translating")}</li>`;
  }

  const titles = cachedBroadcasts.map((b) => b.title);
  const translatedTitles = await lingvaTranslateAll(titles, lang);
  const translatedList = cachedBroadcasts.map((b, i) => ({
    ...b,
    title: translatedTitles[i],
  }));

  updatesList.innerHTML = emergencyList.innerHTML = "";
  let hasRegular = false,
    hasEmergency = false;
  let regularCount = 0,
    emergencyCount = 0;
  const MAX_ITEMS = 5;

  translatedList.forEach((data) => {
    if (data.emergency && emergencyCount >= MAX_ITEMS) return;
    if (!data.emergency && regularCount >= MAX_ITEMS) return;
    const cat = categoryMap[data.category] || categoryMap["General"];
    const dateStr = data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleDateString()
      : t("justNow");

    const item = document.createElement("li");
    item.style.cssText = `
      padding: 8px 10px; margin-bottom: 6px; border-radius: 8px; cursor: pointer;
      background: rgba(255,255,255,0.04);
      border-left: 3px solid ${data.emergency ? "#dc3545" : cat.hex};`;
    item.innerHTML = `
      <span class="badge bg-${data.emergency ? "danger" : cat.badge} me-1" style="font-size:0.65rem;">
        ${data.emergency ? t("emergencyTag") : t(cat.key)}
      </span>
      <span class="fw-bold text-light" style="font-size:0.8rem;">${data.title}</span>
      <small class="text-muted d-block mt-1" style="font-size:0.7rem;">${dateStr}</small>`;
    item.onclick = () => alert(data.title + "\n\n" + data.content);

    if (data.emergency) {
      emergencyList.appendChild(item);
      hasEmergency = true;
      emergencyCount++;
    } else {
      updatesList.appendChild(item);
      hasRegular = true;
      regularCount++;
    }
  });

  if (!hasRegular)
    updatesList.innerHTML = `<li class="text-muted small p-1">${t("noUpdates")}</li>`;
  if (!hasEmergency)
    emergencyList.innerHTML = `<li class="text-muted small p-1">${t("noAlerts")}</li>`;
}

// ================= RENDER UPCOMING EVENTS =================
async function renderUpcomingEvents() {
  const list = document.getElementById("upcomingEventsList");
  if (!list) return;

  const lang = localStorage.getItem("lang") || "en";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = cachedBroadcasts
    .filter((b) => b.eventDate)
    .map((b) => ({ ...b, dateObj: new Date(b.eventDate) }))
    .filter((b) => b.dateObj >= today)
    .sort((a, b) => a.dateObj - b.dateObj)
    .slice(0, 8);

  if (upcoming.length === 0) {
    list.innerHTML = `<li class="text-muted small p-1">${t("noEvents")}</li>`;
    return;
  }

  const titles = upcoming.map((e) => e.title);
  const translated = await lingvaTranslateAll(titles, lang);

  list.innerHTML = "";
  upcoming.forEach((ev, i) => {
    const cat = categoryMap[ev.category] || categoryMap["General"];
    const dateStr = ev.dateObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const li = document.createElement("li");
    li.style.cssText = `
      padding: 7px 10px; margin-bottom: 5px; border-radius: 8px;
      background: rgba(255,255,255,0.04);
      border-left: 3px solid ${ev.emergency ? "#dc3545" : cat.hex};
      cursor: pointer;`;
    li.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold text-light" style="font-size:0.8rem;">${translated[i]}</span>
        <span class="badge bg-${ev.emergency ? "danger" : cat.badge} ms-1" style="font-size:0.65rem; white-space:nowrap;">${dateStr}</span>
      </div>`;
    li.onclick = () => alert(ev.title + "\n\n" + ev.content);
    list.appendChild(li);
  });
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
    norm === "inprogress" || norm === "resolved"
      ? "#ffc107"
      : "rgba(255,255,255,0.1)";
  nodeRes.querySelector(".node-circle").style.background =
    norm === "resolved" ? "#28a745" : "rgba(255,255,255,0.1)";

  if (norm === "inprogress") seg1.style.width = "50%";
  else if (norm === "resolved") {
    seg1.style.width = "50%";
    seg2.style.width = "50%";
  }
}

// ================= UPDATE LANGUAGE =================
async function updateLanguage(lang) {
  const data = translations[lang] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key || data[key] === undefined) return;
    if (el.tagName === "INPUT") el.placeholder = data[key];
    else el.innerText = data[key];
  });
  document.querySelectorAll("[data-i18n-em]").forEach((el) => {
    const key = el.getAttribute("data-i18n-em");
    if (data[key]) el.innerText = data[key];
  });

  await renderLatestComplaint();
  await renderBroadcasts();
  await renderUpcomingEvents();
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

// ================= SIDEBAR ACTIVE LINK =================
document.querySelectorAll("#sidebar .nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document
      .querySelectorAll("#sidebar .nav-link")
      .forEach((l) => l.classList.remove("active"));
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
  } catch (e) {
    console.error(e);
    alert(t("alertSubmitError"));
  }
}

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

document
  .getElementById("quickRoad")
  ?.addEventListener("click", () =>
    submitComplaint({
      title: "Road Damage",
      category: "Road",
      description: "Damaged road in my area.",
      location: "Near my area",
      municipality: userMunicipality,
      wardNumber: userWard,
    }),
  );
document
  .getElementById("quickWater")
  ?.addEventListener("click", () =>
    submitComplaint({
      title: "Water Issue",
      category: "Water",
      description: "No water supply.",
      location: "Near my area",
      municipality: userMunicipality,
      wardNumber: userWard,
    }),
  );
document
  .getElementById("quickElectric")
  ?.addEventListener("click", () =>
    submitComplaint({
      title: "Electricity Issue",
      category: "Electricity",
      description: "Power outage in my area.",
      location: "Near my area",
      municipality: userMunicipality,
      wardNumber: userWard,
    }),
  );

document.getElementById("viewComplaintBtn")?.addEventListener("click", () => {
  window.location.href = "my-complaints.html";
});

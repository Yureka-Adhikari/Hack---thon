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

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

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

  // ===== LOAD LATEST COMPLAINT =====
  const q = query(
    collection(db, "complaints"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const latest = snapshot.docs[0].data();

    document.getElementById("latestTitle").innerText = latest.title;
    const statusEl = document.getElementById("latestStatus");
    statusEl.innerText = latest.status;
    // store raw english value for progress bar
    statusEl.dataset.raw = latest.status;
    document.getElementById("latestCategory").innerText = latest.category;
    document.getElementById("latestLocation").innerText = latest.location;

    // update progress line based on raw status
    updateProgress(latest.status);

    // reapply language on dynamic elements (this will translate status too)
    const currentLang = localStorage.getItem("lang") || "en";
    updateLanguage(currentLang);
  }
});

// ================= LOAD BROADCASTS =================
function loadBroadcasts() {
  const q = query(
    collection(db, "broadcasts"),
    orderBy("createdAt", "desc"),
  );
  
  onSnapshot(q, (snapshot) => {
    const updatesList = document.getElementById("updatesList");
    const emergencyList = document.getElementById("emergencyList");
    
    if (updatesList) updatesList.innerHTML = "";
    if (emergencyList) emergencyList.innerHTML = "";
    
    if (snapshot.empty) {
      if (updatesList) updatesList.innerHTML = '<li class="list-group-item text-muted small">No updates available</li>';
      if (emergencyList) emergencyList.innerHTML = '<li class="list-group-item text-muted small">No alerts</li>';
      return;
    }
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const isEmergency = data.emergency || false;
      const category = data.category || "General";
      
      const dateString = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString()
        : "Just now";
      
      const categoryMap = {
        Water: { color: "0d6efd", bgColor: "primary", key: "updCatWater" },
        Road: { color: "dc3545", bgColor: "danger", key: "updCatRoad" },
        Waste: { color: "198754", bgColor: "success", key: "updCatWaste" },
        General: { color: "6f42c1", bgColor: "secondary", key: "updCatGeneral" },
        Electricity: { color: "ffc107", bgColor: "warning", key: "updCatElectricity" },
      };
      
      const catStyle = categoryMap[category] || categoryMap["General"];
      
      const item = document.createElement("li");
      item.className = "list-group-item" + (isEmergency ? " emergency" : "");
      
      if (isEmergency) {
        item.style.cssText = "border: 1px solid #dc3545; border-left: 4px solid #dc3545;";
      } else {
        item.style.cssText = `border-left: 4px solid #${catStyle.color};`;
      }
      
      const badgeClass = isEmergency ? "danger" : catStyle.bgColor;
      const badgeText = isEmergency ? t("emergencyTag") : t(catStyle.key);
      
      item.innerHTML = `
        <span class="badge bg-${badgeClass} me-2">${badgeText}</span>
        <span class="fw-bold">${data.title}</span><br>
        <small class="text-muted d-block mt-1">${dateString}</small>
      `;
      item.onclick = () => alert(data.title + "\n\n" + data.content);
      
      
      if (isEmergency && emergencyList) {
        emergencyList.appendChild(item);
      } else if (!isEmergency && updatesList) {
        updatesList.appendChild(item);
      }
    });
  });
}

// Load broadcasts when component is ready
if (document.getElementById("updatesList")) {
  loadBroadcasts();
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
// helper to get translation for current language
function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
}

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

// ================= LANGUAGE TOGGLE =================
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
    // update list categories
    updCatWater: "Water",
    updCatRoad: "Road",
    updCatWaste: "Waste",
    updCatGeneral: "General",
    updCatElectricity: "Electricity",
    statusSubmitted: "Submitted",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    catWater: "Water",
    catElectricity: "Electricity",
    catRoad: "Road",
    catWaste: "Waste",
    catOther: "Other",
    emergencyTag: "EMERGENCY",
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
    reportIssues: "",
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
    // update list categories
    updCatWater: "पानी",
    updCatRoad: "सडक",
    updCatWaste: "फोहोर",
    updCatGeneral: "सामान्य",
    updCatElectricity: "बिजुली",
    updCatEmergency: "आपत्कालीन",
    updCatOther: "अन्य",
    statusSubmitted: "पेश गरियो",
    statusInProgress: "प्रगति हुँदैछ",
    statusResolved: "समाधान भएको",
    catWater: "पानी",
    catElectricity: "बिजुली",
    catRoad: "सडक",
    catWaste: "फोहोर",
    catOther: "अन्य",
    emergencyTag: "आपत्कालीन",
    //updating status translations

    // more translations
  },
};

function updateLanguage(lang) {
  const data = translations[lang] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const text = data[key];
    if (text === undefined) return;
    if (el.placeholder !== undefined) {
      el.placeholder = text;
    } else {
      el.innerText = text;
    }
  });
  // translate dynamic status if present
  const stEl = document.getElementById("latestStatus");
  if (stEl) {
    const map = {
      en: { Submitted: "Submitted", "In Progress": "In Progress", Resolved: "Resolved" },
      np: { Submitted: "पेश गरियो", "In Progress": "प्रगति हुँदैछ", Resolved: "समाधान भएको" },
    };
    const current = stEl.innerText;
    if (map[lang] && map[lang][current]) {
      stEl.innerText = map[lang][current];
    }
    // refresh progress bar using raw value (unstyled)
    if (stEl.dataset.raw) {
      updateProgress(stEl.dataset.raw);
    }
  }
}

// ================= PROGRESS BAR =================
function updateProgress(status) {
  if (!status) return;
  // normalize status string (lowercase, no spaces)
  const norm = status.toString().trim().toLowerCase().replace(/\s+/g, "");

  const seg1 = document.getElementById("progressSegment1");
  const seg2 = document.getElementById("progressSegment2");
  const nodeSub = document.getElementById("nodeSubmitted");
  const nodeIn = document.getElementById("nodeInProgress");
  const nodeRes = document.getElementById("nodeResolved");

  if (!seg1 || !seg2 || !nodeSub || !nodeIn || !nodeRes) return;

  // initialize all segments to zero
  seg1.style.width = "0%";
  seg2.style.width = "0%";

  // set node colours based on normalized status
  nodeSub.querySelector(".node-circle").style.background = "#0d47a1";
  nodeIn.querySelector(".node-circle").style.background =
    norm === "inprogress" || norm === "resolved" ? "#ffc107" : "#e0e0e0";
  nodeRes.querySelector(".node-circle").style.background =
    norm === "resolved" ? "#28a745" : "#e0e0e0";

  // progress bar widths
  if (norm === "submitted") {
    // nothing filled yet
  } else if (norm === "inprogress") {
    seg1.style.width = "50%";
  } else if (norm === "resolved") {
    seg1.style.width = "50%";
    seg2.style.width = "50%";
  }
}


const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  // load stored preference
  const stored = localStorage.getItem("lang") || "en";
  langSelect.value = stored;
  updateLanguage(stored);
  langSelect.addEventListener("change", () => {
    const chosen = langSelect.value;
    localStorage.setItem("lang", chosen);
    updateLanguage(chosen);
    // reload broadcasts with new language
    loadBroadcasts();
  });
}


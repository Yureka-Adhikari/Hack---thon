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
    document.getElementById("latestStatus").innerText = latest.status;
    document.getElementById("latestCategory").innerText = latest.category;
    document.getElementById("latestLocation").innerText = latest.location;

    // reapply language on dynamic elements
    const currentLang = localStorage.getItem("lang") || "en";
    updateLanguage(currentLang);
  }
});

// ================= LOAD BROADCASTS =================
function loadBroadcasts() {
  const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"));
  
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
        Water: { color: "0d6efd", bgColor: "primary" },
        Road: { color: "dc3545", bgColor: "danger" },
        Waste: { color: "198754", bgColor: "success" },
        General: { color: "6f42c1", bgColor: "secondary" },
        Electricity: { color: "ffc107", bgColor: "warning" },
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
      const badgeText = isEmergency ? "Emergency" : category;
      
      item.innerHTML = `
        <span class="badge bg-${badgeClass} me-2">${badgeText}</span>
        <span>${data.content}</span>
        <small class="text-muted d-block mt-1">${dateString}</small>
      `;
      
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
    alertLogin: "Please login first.",
    alertSubmitSuccess: "Complaint submitted successfully!",
    alertSubmitError: "Error submitting complaint.",
    // update list categories
    updCatWater: "Water",
    updCatRoad: "Road",
    updCatWaste: "Waste",
    updCatGeneral: "General",
    updCatElectricity: "Electricity",
    upd1: "Water supply will be disrupted on 5th Aug.",
    upd2: "Road repair work starts from 10th Aug.",
    upd3: "New waste collection schedule announced.",
    upd4: "Community meeting on 15th Aug at 5 PM.",
    upd5: "Electricity maintenance on 20th Aug.",
    emergencyTag: "Emergency",
    alert1: "Road blocked due to landslide in Tole-3.",
    alert2: "Fire reported in local market, avoid the area.",
    // add more keys as needed
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
    alertLogin: "कृपया पहिले लगइन गर्नुहोस्।",
    alertSubmitSuccess: "गुनासो सफलतापूर्वक पेश गरियो!",
    alertSubmitError: "गुनासो पेश गर्दा त्रुटि भयो।",
    // update list categories
    updCatWater: "पानी",
    updCatRoad: "सडक",
    updCatWaste: "फोहोर",
    updCatGeneral: "सामान्य",
    updCatElectricity: "बिजुली",
    upd1: "५ अगस्तमा पानी आपूर्ति अवरुद्ध हुनेछ।",
    upd2: "१० अगस्तदेखि सडक मर्मतकार्य सुरु हुन्छ।",
    upd3: "नयाँ फोहोर संकलन तालिका घोषणा गरियो।",
    upd4: "१५ अगस्तमा साँझ ५ बजे सामुदायिक बैठक हुनेछ।",
    upd5: "२० अगस्तमा बिजुली मर्मतसम्भार हुनेछ।",
    emergencyTag: "आपतकाल",
    alert1: "टोले-३ मा पहिरोका कारण सडक अवरुद्ध।",
    alert2: "स्थानिय बजारमा आगलागी, त्यस क्षेत्रमा नगईदिनुहोला।",
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
  });
}


import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateComplaint } from "./translator.js";

let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";

let cachedComplaints = [];

// ===== TRANSLATIONS =====
// Covers: UI labels, form labels, form placeholders, category options,
// ward label, "Your Submitted Complaints" heading, status badges.
const translations = {
  en: {
    // Navbar
    wardLabel: "Ward",
    // Form headings
    formHeading: "Submit a New Complaint",
    submittedHeading: "Your Submitted Complaints",
    // Form labels
    formTitleLabel: "Title *",
    formCategoryLabel: "Category *",
    formLocationLabel: "Location *",
    formDescLabel: "Description *",
    // Form placeholders
    formTitlePlaceholder: "Brief title of the complaint",
    formLocationPlaceholder: "Where is the issue located?",
    formDescPlaceholder: "Describe the issue in detail...",
    // Form select options
    formCategorySelect: "Select Category",
    // Submit / clear buttons
    formSubmitBtn: "Submit Complaint",
    formClearBtn: "Clear Form",
    // Category values (used both in form options and complaint cards)
    catRoadDamage: "Road Damage",
    catWaterSupply: "Water Supply",
    catElectricity: "Electricity",
    catSanitation: "Sanitation",
    catOther: "Other",
    // Complaint card labels
    noComplaints: "No complaints submitted yet.",
    labelLocation: "Location",
    labelSubmitted: "Submitted on",
    labelViewComplaint: "View Complaint",
    // Status badges
    statusSubmitted: "Submitted",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    statusRejected: "Rejected",
    // Alert messages
    alertFillFields: "Please fill all fields.",
    alertNotLoggedIn: "Not logged in.",
    alertSubmitSuccess: "Complaint submitted successfully!",
    // View complaint popup labels
    alertViewTitle: "Title",
    alertViewCategory: "Category",
    alertViewStatus: "Status",
    alertViewLocation: "Location",
    alertViewMunicipality: "Municipality",
    alertViewWard: "Ward",
    // Loading
    translating: "Translating...",
  },
  np: {
    // Navbar
    wardLabel: "वार्ड",
    // Form headings
    formHeading: "नयाँ गुनासो पेश गर्नुहोस्",
    submittedHeading: "तपाईंका पेश गरिएका गुनासोहरू",
    // Form labels
    formTitleLabel: "शीर्षक *",
    formCategoryLabel: "श्रेणी *",
    formLocationLabel: "स्थान *",
    formDescLabel: "विवरण *",
    // Form placeholders
    formTitlePlaceholder: "गुनासोको संक्षिप्त शीर्षक",
    formLocationPlaceholder: "समस्या कहाँ छ?",
    formDescPlaceholder: "समस्याको विस्तृत विवरण लेख्नुहोस्...",
    // Form select options
    formCategorySelect: "श्रेणी छान्नुहोस्",
    // Submit / clear buttons
    formSubmitBtn: "गुनासो पेश गर्नुहोस्",
    formClearBtn: "फारम खाली गर्नुहोस्",
    // Category values
    catRoadDamage: "सडक क्षति",
    catWaterSupply: "पानी आपूर्ति",
    catElectricity: "बिजुली",
    catSanitation: "सरसफाई",
    catOther: "अन्य",
    // Complaint card labels
    noComplaints: "अहिलेसम्म कुनै गुनासो पेश गरिएको छैन।",
    labelLocation: "स्थान",
    labelSubmitted: "पेश गरिएको",
    labelViewComplaint: "गुनासो हेर्नुहोस्",
    // Status badges
    statusSubmitted: "पेश गरियो",
    statusInProgress: "प्रगति हुँदैछ",
    statusResolved: "समाधान भएको",
    statusRejected: "अस्वीकृत",
    // Alert messages
    alertFillFields: "कृपया सबै क्षेत्र भर्नुहोस्।",
    alertNotLoggedIn: "लगइन गरिएको छैन।",
    alertSubmitSuccess: "गुनासो सफलतापूर्वक पेश गरियो!",
    // View complaint popup labels
    alertViewTitle: "शीर्षक",
    alertViewCategory: "श्रेणी",
    alertViewStatus: "स्थिति",
    alertViewLocation: "स्थान",
    alertViewMunicipality: "नगरपालिका",
    alertViewWard: "वार्ड",
    // Loading
    translating: "अनुवाद हुँदैछ...",
  },
};

function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return translations[lang]?.[key] || translations.en[key] || key;
}

function translateStatus(rawStatus) {
  const map = {
    Submitted: "statusSubmitted",
    "In Progress": "statusInProgress",
    Resolved: "statusResolved",
    Rejected: "statusRejected",
  };
  return t(map[rawStatus] || "statusSubmitted");
}

function translateCategory(rawCategory) {
  const map = {
    "Road Damage": "catRoadDamage",
    "Water Supply": "catWaterSupply",
    Electricity: "catElectricity",
    Sanitation: "catSanitation",
    Other: "catOther",
  };
  return t(map[rawCategory] || "catOther");
}

// ===== UPDATE STATIC UI LABELS =====
// Translates every data-i18n element, every data-i18n-placeholder input/textarea,
// and the ward badge in the navbar.
function updateStaticLabels() {
  const lang = localStorage.getItem("lang") || "en";
  const data = translations[lang] || translations.en;

  // [data-i18n] elements — innerText
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const text = data[key];
    if (text !== undefined) el.innerText = text;
  });

  // [data-i18n-placeholder] inputs and textareas
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const text = data[key];
    if (text !== undefined) el.placeholder = text;
  });

  // Ward badge: "Ward 5, Kathmandu" → "वार्ड ५, Kathmandu"
  // We keep the number and municipality name as-is (proper nouns / numbers)
  // but translate the word "Ward" itself.
  const wardEl = document.getElementById("uWard");
  if (wardEl && userWard !== "N/A") {
    wardEl.innerText = `${t("wardLabel")} ${userWard}, ${userMunicipality}`;
  }
}

// ===== AUTH =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      const el = (id) => document.getElementById(id);
      if (el("uNameMain")) el("uNameMain").innerText = data.fullName || "User";
      if (el("uNameTop")) el("uNameTop").innerText = data.fullName || "User";
      userWard = data.wardNumber || "N/A";
      userMunicipality = data.municipality || "N/A";
      // Set ward badge with correct translated label
      updateStaticLabels();
    }
    await loadComplaints();
  } catch (err) {
    console.error("User load error:", err);
  }
});

// ===== LOGOUT =====
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

// ===== SUBMIT =====
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("submitComplaintBtn")
    ?.addEventListener("click", handleSubmitComplaint);
});

async function handleSubmitComplaint(e) {
  e.preventDefault();
  const title = document.getElementById("complaintTitle")?.value?.trim() || "";
  const category = document.getElementById("complaintCategory")?.value || "";
  const description =
    document.getElementById("complaintDescription")?.value?.trim() || "";
  const location =
    document.getElementById("complaintLocation")?.value?.trim() || "";

  if (!title || !category || !description || !location) {
    alert(t("alertFillFields"));
    return;
  }
  if (!currentUser) {
    alert(t("alertNotLoggedIn"));
    return;
  }

  try {
    await addDoc(collection(db, "complaints"), {
      title,
      category,
      description,
      location,
      userId: currentUser.uid,
      userName: document.getElementById("uNameMain")?.innerText || "Citizen",
      status: "Submitted",
      createdAt: serverTimestamp(),
      wardNumber: userWard,
      municipality: userMunicipality,
    });
    document.getElementById("complaintForm")?.reset();
    alert(t("alertSubmitSuccess"));
    await loadComplaints();
  } catch (error) {
    console.error("Submit error:", error);
    alert(error.message);
  }
}

// ===== LOAD =====
async function loadComplaints() {
  if (!currentUser) return;
  try {
    const q = query(
      collection(db, "complaints"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    cachedComplaints = [];
    snapshot.forEach((docSnap) =>
      cachedComplaints.push({ id: docSnap.id, ...docSnap.data() }),
    );
    await renderComplaints();
  } catch (error) {
    console.error("Load error:", error);
  }
}

// ===== RENDER =====
async function renderComplaints() {
  const container = document.getElementById("complaintsList");
  if (!container) return;
  const lang = localStorage.getItem("lang") || "en";

  if (cachedComplaints.length === 0) {
    container.innerHTML = `<div class="alert alert-info">${t("noComplaints")}</div>`;
    return;
  }

  if (lang === "np") {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <div class="spinner-border spinner-border-sm me-2"></div>${t("translating")}
      </div>`;
  }

  // Translate user-written title + description via Lingva (cached after first call)
  const translatedList = await Promise.all(
    cachedComplaints.map(async (data) => {
      if (lang !== "np") return data;
      const { title, description } = await translateComplaint(data, lang);
      return { ...data, title, description };
    }),
  );

  container.innerHTML = "";
  translatedList.forEach((data) => {
    const createdDate = data.createdAt?.toDate?.() || new Date();
    const formattedDate =
      createdDate.toLocaleDateString() + " " + createdDate.toLocaleTimeString();
    const statusClass = data.status.replace(/\s+/g, "");

    container.innerHTML += `
      <div class="complaint-card">
        <h4>${data.title}</h4>
        <p class="text-muted mb-2">${data.description}</p>
        <p class="mb-1"><strong>${t("labelLocation")}:</strong> ${data.location}</p>
        <p class="mb-1"><strong>${translateCategory(data.category)}</strong></p>
        <p class="text-muted small">${t("labelSubmitted")}: ${formattedDate}</p>
        <span class="status ${statusClass}">${translateStatus(data.status)}</span>
        <br><br>
        <button onclick="viewComplaint('${data.id}')">${t("labelViewComplaint")}</button>
      </div>`;
  });
}

// ===== VIEW COMPLAINT =====
window.viewComplaint = async function (id) {
  try {
    const snap = await getDoc(doc(db, "complaints", id));
    if (!snap.exists()) return;
    const data = snap.data();
    const lang = localStorage.getItem("lang") || "en";
    let { title, description } = data;
    if (lang === "np") {
      const translated = await translateComplaint(data, lang);
      title = translated.title;
      description = translated.description;
    }
    alert(
      `${t("alertViewTitle")}: ${title}\n` +
        `${t("alertViewCategory")}: ${translateCategory(data.category)}\n` +
        `${t("alertViewStatus")}: ${translateStatus(data.status)}\n` +
        `${t("alertViewLocation")}: ${data.location}\n` +
        `${t("alertViewMunicipality")}: ${data.municipality}\n` +
        `${t("alertViewWard")}: ${data.wardNumber}`,
    );
  } catch (error) {
    console.error("View error:", error);
  }
};

// ===== LANGUAGE SELECTOR =====
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  const stored = localStorage.getItem("lang") || "en";
  langSelect.value = stored;
  // Apply on first load
  updateStaticLabels();

  langSelect.addEventListener("change", async () => {
    localStorage.setItem("lang", langSelect.value);
    updateStaticLabels(); // instant — no API needed for form labels
    await renderComplaints(); // async — translates complaint text via API
  });
}

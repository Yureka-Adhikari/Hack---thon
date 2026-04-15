import { auth, db } from "../core/firebase-config.js";
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
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { translateComplaint, translateText } from "../core/translator.js";

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

// ===== ImgBB Upload =====
class ImgBBUploader {
  constructor(apiKey, albumId = null) {
    this.apiKey = apiKey;
    this.albumId = albumId;
    this.baseUrl = "https://api.imgbb.com/1/upload";
  }
  async uploadImage(file, complaintId = null) {
    const base64 = await this.fileToBase64(file);
    const formData = new FormData();
    formData.append("image", base64);
    formData.append("key", this.apiKey);
    if (this.albumId) formData.append("album", this.albumId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    formData.append(
      "name",
      complaintId
        ? `complaint_${complaintId}_${timestamp}`
        : `civicsewa_${timestamp}`,
    );
    formData.append("expiration", "");
    const response = await fetch(this.baseUrl, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (result.success) {
      return {
        url: result.data.url,
        thumbnailUrl: result.data.thumb?.url,
        filename: result.data.filename,
        size: result.data.size,
      };
    } else throw new Error(result.error?.message || "Upload failed");
  }
  async uploadMultipleImages(files, complaintId = null) {
    return Promise.all(
      Array.from(files).map((f) => this.uploadImage(f, complaintId)),
    );
  }
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

const IMG_BB_CONFIG = {
  API_KEY: "9518c1dc7b1699ec13712fa05379dd94",
  ALBUM_ID: "SRvypj",
};
const getImgBBUploader = () =>
  new ImgBBUploader(IMG_BB_CONFIG.API_KEY, IMG_BB_CONFIG.ALBUM_ID);

// ===== STATE =====
let currentUser = null;
let userWard = "N/A";
let userMunicipality = "N/A";
let capturedLocation = null;
let cachedComplaints = [];

// ===== TRANSLATIONS =====
const translations = {
  en: {
    wardLabel: "Ward",
    formHeading: "Submit a New Complaint",
    submittedHeading: "Your Submitted Complaints",
    formTitleLabel: "Title *",
    formCategoryLabel: "Category *",
    formLocationLabel: "Location *",
    formDescLabel: "Description *",
    formTitlePlaceholder: "Brief title of the complaint",
    formLocationPlaceholder: "Where is the issue located?",
    formDescPlaceholder: "Describe the issue in detail...",
    formCategorySelect: "Select Category",
    formSubmitBtn: "Submit Complaint",
    formClearBtn: "Clear Form",
    catRoadDamage: "Road Damage",
    catWaterSupply: "Water Supply",
    catElectricity: "Electricity",
    catSanitation: "Sanitation",
    catOther: "Other",
    noComplaints: "No complaints submitted yet.",
    labelLocation: "Location",
    labelSubmitted: "Submitted on",
    labelViewComplaint: "View Complaint",
    statusSubmitted: "Submitted",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    statusRejected: "Rejected",
    alertFillFields: "Please fill all fields.",
    alertNotLoggedIn: "Not logged in.",
    alertSubmitSuccess: "Complaint submitted successfully!",
    alertViewTitle: "Title",
    alertViewCategory: "Category",
    alertViewStatus: "Status",
    alertViewLocation: "Location",
    alertViewMunicipality: "Municipality",
    alertViewWard: "Ward",
    translating: "Translating...",
  },
  np: {
    wardLabel: "वार्ड",
    formHeading: "नयाँ गुनासो पेश गर्नुहोस्",
    submittedHeading: "तपाईंका पेश गरिएका गुनासोहरू",
    formTitleLabel: "शीर्षक *",
    formCategoryLabel: "श्रेणी *",
    formLocationLabel: "स्थान *",
    formDescLabel: "विवरण *",
    formTitlePlaceholder: "गुनासोको संक्षिप्त शीर्षक",
    formLocationPlaceholder: "समस्या कहाँ छ?",
    formDescPlaceholder: "समस्याको विस्तृत विवरण लेख्नुहोस्...",
    formCategorySelect: "श्रेणी छान्नुहोस्",
    formSubmitBtn: "गुनासो पेश गर्नुहोस्",
    formClearBtn: "फारम खाली गर्नुहोस्",
    catRoadDamage: "सडक क्षति",
    catWaterSupply: "पानी आपूर्ति",
    catElectricity: "बिजुली",
    catSanitation: "सरसफाई",
    catOther: "अन्य",
    noComplaints: "अहिलेसम्म कुनै गुनासो पेश गरिएको छैन।",
    labelLocation: "स्थान",
    labelSubmitted: "पेश गरिएको",
    labelViewComplaint: "गुनासो हेर्नुहोस्",
    statusSubmitted: "पेश गरियो",
    statusInProgress: "प्रगति हुँदैछ",
    statusResolved: "समाधान भएको",
    statusRejected: "अस्वीकृत",
    alertFillFields: "कृपया सबै क्षेत्र भर्नुहोस्।",
    alertNotLoggedIn: "लगइन गरिएको छैन।",
    alertSubmitSuccess: "गुनासो सफलतापूर्वक पेश गरियो!",
    alertViewTitle: "शीर्षक",
    alertViewCategory: "श्रेणी",
    alertViewStatus: "स्थिति",
    alertViewLocation: "स्थान",
    alertViewMunicipality: "नगरपालिका",
    alertViewWard: "वार्ड",
    translating: "अनुवाद हुँदैछ...",
  },
};

function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return translations[lang]?.[key] || translations.en[key] || key;
}
function translateStatus(s) {
  const map = {
    Submitted: "statusSubmitted",
    "In Progress": "statusInProgress",
    Resolved: "statusResolved",
    Rejected: "statusRejected",
  };
  return t(map[s] || "statusSubmitted");
}
function translateCategory(c) {
  const map = {
    "Road Damage": "catRoadDamage",
    "Water Supply": "catWaterSupply",
    Electricity: "catElectricity",
    Sanitation: "catSanitation",
    Other: "catOther",
    Road: "catRoadDamage",
    Water: "catWaterSupply",
    Waste: "catSanitation",
  };
  return t(map[c] || "catOther");
}

function updateStaticLabels() {
  const lang = localStorage.getItem("lang") || "en";
  const data = translations[lang] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (data[key] !== undefined) el.innerText = data[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (data[key] !== undefined) el.placeholder = data[key];
  });
  const wardEl = document.getElementById("uWard");
  if (wardEl && userWard !== "N/A")
    wardEl.innerText = `${t("wardLabel")} ${userWard}, ${userMunicipality}`;
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
      const nameEl = document.getElementById("uNameTop");
      if (nameEl) nameEl.innerText = data.fullName || "User";
      userWard = data.wardNumber || "N/A";
      userMunicipality = data.municipality || "N/A";
      updateStaticLabels();
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName || "User")}&background=random`;
      const av = document.getElementById("userAvatar");
      if (av) av.src = avatarUrl;
    }
    loadComplaints(user);
  } catch (err) {
    console.error("User load error:", err);
  }
});

// ===== GPS =====
function captureLocation() {
  const btn = document.getElementById("getLocationBtn");
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by this browser.");
    return;
  }
  if (btn) {
    btn.innerHTML = '<i class="bi bi-arrow-repeat"></i>';
    btn.disabled = true;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      capturedLocation = { latitude, longitude };
      const locationInput = document.getElementById("compLocation");
      const coordsDisplay = document.getElementById("locationCoords");
      if (locationInput)
        locationInput.value = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
      if (coordsDisplay)
        coordsDisplay.textContent = `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      if (btn) {
        btn.innerHTML = '<i class="bi bi-geo-alt-fill text-success"></i>';
        btn.disabled = false;
      }
    },
    (error) => {
      const msgs = {
        1: "Location access denied.",
        2: "Location unavailable.",
        3: "Request timed out.",
      };
      alert(msgs[error.code] || "Unable to get GPS location.");
      if (btn) {
        btn.innerHTML = '<i class="bi bi-geo-alt-fill"></i>';
        btn.disabled = false;
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
}

// ===== SUBMIT =====
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("complaintForm")
    ?.addEventListener("submit", handleSubmitComplaint);
  document
    .getElementById("getLocationBtn")
    ?.addEventListener("click", captureLocation);
});

async function handleSubmitComplaint(e) {
  e.preventDefault();
  const title = document.getElementById("compTitle")?.value?.trim() || "";
  const category = document.getElementById("compCategory")?.value || "";
  const description = document.getElementById("compDesc")?.value?.trim() || "";
  const location = document.getElementById("compLocation")?.value?.trim() || "";
  const photoFiles = document.getElementById("compPhoto")?.files || [];

  if (!title || !category || !description || !location) {
    alert(t("alertFillFields"));
    return;
  }

  const submitUser = auth.currentUser;
  if (!submitUser) {
    alert(t("alertNotLoggedIn"));
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm"></span> Submitting...';
  }

  try {
    const complaintId = `complaint_${Date.now()}_${submitUser.uid.substring(0, 8)}`;

    // Photo upload
    const photoUrls = [];
    if (photoFiles.length > 0) {
      try {
        const uploader = getImgBBUploader();
        const results = await uploader.uploadMultipleImages(
          photoFiles,
          complaintId,
        );
        results.forEach((r) =>
          photoUrls.push({
            url: r.url || "",
            thumbnailUrl: r.thumbnailUrl || r.url || "",
            filename: r.filename || "unknown",
            size: r.size || 0,
          }),
        );
      } catch (imgbbError) {
        console.warn("ImgBB upload failed, using base64 fallback:", imgbbError);
        for (const file of photoFiles) {
          try {
            const base64 = await new Promise((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.onerror = rej;
              reader.readAsDataURL(file);
            });
            photoUrls.push({
              url: base64,
              thumbnailUrl: base64,
              filename: file.name,
              size: file.size,
              isBase64: true,
            });
          } catch {}
        }
      }
    }

    await addDoc(collection(db, "complaints"), {
      title,
      category,
      description,
      location,
      photoUrls,
      gpsLocation: capturedLocation || null,
      userId: submitUser.uid,
      userName: document.getElementById("uNameTop")?.innerText || "Citizen",
      status: "Submitted",
      createdAt: serverTimestamp(),
      wardNumber: userWard,
      municipality: userMunicipality,
    });

    document.getElementById("complaintForm")?.reset();
    const coordsDisplay = document.getElementById("locationCoords");
    if (coordsDisplay) coordsDisplay.textContent = "";
    capturedLocation = null;

    let msg = t("alertSubmitSuccess");
    if (photoUrls.length > 0)
      msg += ` (${photoUrls.length} photo${photoUrls.length > 1 ? "s" : ""} uploaded)`;
    alert(msg);
  } catch (error) {
    console.error("Submit error:", error);
    alert("Error submitting complaint: " + error.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span data-i18n="submitComplaintBtn">${t("formSubmitBtn")}</span>`;
    }
  }
}

// ===== LOAD =====
function loadComplaints(user) {
  const uid = user?.uid || currentUser?.uid;
  if (!uid) return;
  const q = query(collection(db, "complaints"), where("userId", "==", uid));
  onSnapshot(
    q,
    async (snapshot) => {
      cachedComplaints = [];
      snapshot.forEach((docSnap) =>
        cachedComplaints.push({ id: docSnap.id, ...docSnap.data() }),
      );
      cachedComplaints.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      console.log(
        "Complaints loaded:",
        cachedComplaints.length,
        cachedComplaints.map((c) => ({
          id: c.id,
          status: c.status,
          title: c.title,
        })),
      );
      await renderComplaints();
    },
    (error) => {
      console.error("Load error:", error);
    },
  );
}

// ===== RENDER =====
async function renderComplaints() {
  const container = document.getElementById("complaintsListContainer");
  if (!container) return;

  const lang = localStorage.getItem("lang") || "en";

  if (cachedComplaints.length === 0) {
    container.innerHTML = `<div class="col-12 text-center mt-5 text-muted"><h5>No complaints found.</h5></div>`;
    return;
  }

  if (lang === "np") {
    container.innerHTML = `<div class="col-12 text-center mt-5"><div class="spinner-border text-warning"></div><p class="mt-2">अनुवाद गरिँदै...</p></div>`;
  }

  let cardsHtml = "";

  for (const data of cachedComplaints) {
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
        Submitted: "bg-primary",
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
            <div class="col-12 search-target">
                <div class="glass-box p-4 complaint-card shadow-sm ${data.isHighPriority ? "high-priority" : ""}">
                    
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="fw-bold text-light search-text mb-0">${display.title || "Untitled"}</h5>
                        <span class="badge ${statusClass}">${data.status || "Submitted"}</span>
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
                </div>
            </div>`;
  }

  container.innerHTML = cardsHtml;
}

// ===== VIEW COMPLAINT =====
window.viewComplaint = async function (id) {
  try {
    const snap = await getDoc(doc(db, "complaints", id));
    if (!snap.exists()) return;
    const data = snap.data();
    const lang = localStorage.getItem("lang") || "en";
    let display = { ...data };

    // Handle Translation if Nepali is selected
    if (lang === "np") {
      try {
        const translated = await translateComplaint(data, "np");
        display = { ...data, ...translated };
      } catch (e) {}
    }

    alert(
      `${t("alertViewTitle")}: ${display.title}\n${t("alertViewCategory")}: ${translateCategory(display.category)}\n${t("alertViewStatus")}: ${translateStatus(display.status)}\n${t("alertViewLocation")}: ${display.location}\n${t("alertViewMunicipality")}: ${display.municipality}\n${t("alertViewWard")}: ${display.wardNumber}`,
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
  updateStaticLabels();
  langSelect.addEventListener("change", async () => {
    localStorage.setItem("lang", langSelect.value);
    updateStaticLabels();
    await renderComplaints();
  });
}

// ===== INTERACTION HANDLERS =====
document
  .getElementById("complaintsListContainer")
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

// ===== SEARCH FILTER =====
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const cards = document.querySelectorAll(".complaint-card");
  cards.forEach((card) => {
    const text = card.querySelector(".search-text").textContent.toLowerCase();
    card.style.display = text.includes(query) ? "" : "none";
  });
});

// ===== STATUS FILTER =====
document.getElementById("statusFilter")?.addEventListener("change", (e) => {
  const status = e.target.value;
  const cards = document.querySelectorAll(".complaint-card");
  cards.forEach((card) => {
    const cardStatus = card.querySelector(".badge").textContent;
    card.style.display =
      status === "all" || cardStatus === status ? "" : "none";
  });
});

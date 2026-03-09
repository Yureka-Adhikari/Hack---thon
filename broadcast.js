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
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateBroadcast } from "./translator.js";

let cachedBroadcasts = [];
let userWard = "N/A";
let userMunicipality = "N/A";

const translations = {
  en: {
    wardLabel: "Ward",
    noBroadcasts: "No broadcasts available.",
    catWater: "Water",
    catRoad: "Road",
    catWaste: "Waste",
    catGeneral: "General",
    catElectricity: "Electricity",
    emergencyTag: "EMERGENCY",
    justNow: "Just now",
    translating: "Translating...",
  },
  np: {
    wardLabel: "वार्ड",
    noBroadcasts: "कुनै प्रसारण उपलब्ध छैन।",
    catWater: "पानी",
    catRoad: "सडक",
    catWaste: "फोहोर",
    catGeneral: "सामान्य",
    catElectricity: "बिजुली",
    emergencyTag: "आपत्कालीन",
    justNow: "भर्खरै",
    translating: "अनुवाद हुँदैछ...",
  },
};

function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  return translations[lang]?.[key] || translations.en[key] || key;
}

const categoryMap = {
  Water: { color: "0d6efd", key: "catWater" },
  Road: { color: "dc3545", key: "catRoad" },
  Waste: { color: "198754", key: "catWaste" },
  General: { color: "6f42c1", key: "catGeneral" },
  Electricity: { color: "ffc107", key: "catElectricity" },
};

function updateStaticLabels() {
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
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    const data = snap.data();
    const nameEl = document.getElementById("uNameTop");
    if (nameEl) nameEl.innerText = data.fullName || "";
    userWard = data.wardNumber || "N/A";
    userMunicipality = data.municipality || "N/A";
    updateStaticLabels();
  }
});

// ===== RENDER =====
async function renderBroadcasts() {
  const container = document.querySelector(".row.g-4");
  if (!container) return;
  const lang = localStorage.getItem("lang") || "en";

  if (cachedBroadcasts.length === 0) {
    container.innerHTML = `<div class="col-12 text-center mt-5 text-muted">${t("noBroadcasts")}</div>`;
    return;
  }

  if (lang === "np") {
    container.innerHTML = `
      <div class="col-12 text-center py-4 text-muted">
        <div class="spinner-border spinner-border-sm me-2"></div>${t("translating")}
      </div>`;
  }

  const translatedList = await Promise.all(
    cachedBroadcasts.map(async (data) => {
      if (lang !== "np") return data;
      const { title, content } = await translateBroadcast(data, lang);
      return { ...data, title, content };
    }),
  );

  container.innerHTML = "";
  translatedList.forEach((data) => {
    const catStyle = categoryMap[data.category] || categoryMap["General"];
    const dateString = data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleString()
      : t("justNow");
    const borderColor = data.emergency ? "#dc3545" : `#${catStyle.color}`;
    const badgeText = data.emergency ? t("emergencyTag") : t(catStyle.key);
    const badgeBg = data.emergency ? "#dc3545" : `#${catStyle.color}`;

    container.innerHTML += `
      <div class="col-md-6 col-lg-4">
        <div class="card broadcast-card shadow-sm h-100 ${data.emergency ? "emergency" : ""}"
             style="border-left:5px solid ${borderColor}; border-radius:12px;">
          <div class="card-body">
            <span class="badge mb-2" style="background-color:${badgeBg}; color:white;">${badgeText}</span>
            <h5 class="card-title ${data.emergency ? "text-danger fw-bold" : ""}">
              ${data.emergency ? '<i class="bi bi-exclamation-triangle-fill me-1"></i>' : ""}${data.title}
            </h5>
            <p class="text-muted small mb-2">${dateString}</p>
            <p class="card-text">${data.content}</p>
          </div>
        </div>
      </div>`;
  });
}

// ===== FIRESTORE LISTENER =====
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

// ===== LANGUAGE SELECTOR =====
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  const stored = localStorage.getItem("lang") || "en";
  langSelect.value = stored;
  updateStaticLabels();
  langSelect.addEventListener("change", async () => {
    localStorage.setItem("lang", langSelect.value);
    updateStaticLabels();
    await renderBroadcasts();
  });
}

// ===== LOGOUT =====
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

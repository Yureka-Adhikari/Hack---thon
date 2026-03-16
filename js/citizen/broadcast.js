import { auth, db } from "../core/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
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
window._renderBroadcasts = renderBroadcasts;

async function renderBroadcasts() {
  const container = document.getElementById("broadcastContainer");
  if (!container) return;
  const lang = localStorage.getItem("lang") || "en";
  const filter = window._broadcastFilter || "all";

  const filtered =
    filter === "emergency"
      ? cachedBroadcasts.filter((b) => b.emergency)
      : cachedBroadcasts;

  if (filtered.length === 0) {
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
    filtered.map(async (data) => {
      if (lang !== "np") return data;
      const [title, content] = await Promise.all([
        lingvaTranslate(data.title, lang),
        lingvaTranslate(data.content, lang),
      ]);
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
      <div class="glass-box col-md-6 col-lg-4 mb-3">
        <div style="
          padding: 14px 16px;
          border-radius: 12px;
          background: rgb(15, 151, 255);
          border: 1px solid rgb(62, 126, 178);
          border-left: 4px solid ${borderColor};
          cursor: pointer;
          transition: 0.2s ease;
          height: 100%;
        " onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.3)'"
           onmouseout="this.style.transform='';this.style.boxShadow=''">
          <div class="mb-2">
            <span class="badge me-1" style="background:${badgeBg}; color:${data.emergency ? "#fff" : data.category === "Electricity" ? "#000" : "#fff"}; font-size:0.65rem;">
              ${badgeText}
            </span>
            <span class="text-muted" style="font-size:0.7rem;">${dateString}</span>
          </div>
          <div class="fw-bold text-light mb-1" style="font-size:0.95rem;">
            ${data.emergency ? '<i class="bi bi-exclamation-triangle-fill text-danger me-1"></i>' : ""}${data.title}
          </div>
          <div style="font-size:0.82rem; color: rgba(255,255,255,0.6); line-height:1.4;">${data.content}</div>
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

// Logout handled by confirmSignOutBtn modal in HTML

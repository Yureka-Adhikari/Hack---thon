import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { translateComplaint } from "./translator.js";

let currentUserWard = "N/A";
let cachedComplaints = [];

const translations = {
  en: {
    wardLabel: "Ward",
    noComplaints: "No complaints for this ward yet.",
    fromLabel: "From",
    locationLabel: "Location",
    updateStatusPlaceholder: "Update Status",
    statusSubmitted: "Submitted",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    translating: "Translating...",
  },
  np: {
    wardLabel: "वार्ड",
    noComplaints: "यस वार्डका लागि अहिलेसम्म कुनै गुनासो छैन।",
    fromLabel: "बाट",
    locationLabel: "स्थान",
    updateStatusPlaceholder: "स्थिति अद्यावधिक गर्नुहोस्",
    statusSubmitted: "पेश गरियो",
    statusInProgress: "प्रगति हुँदैछ",
    statusResolved: "समाधान भएको",
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
  };
  return t(map[rawStatus] || "statusSubmitted");
}

function getStatusColor(s) {
  if (s === "Resolved") return "#198754";
  if (s === "In Progress") return "#ffc107";
  return "#0d6efd";
}

function getStatusBadgeClass(s) {
  if (s === "Resolved") return "bg-success";
  if (s === "In Progress") return "bg-warning text-dark";
  return "bg-primary";
}

// ===== AUTH =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    currentUserWard = snap.data().wardNumber || "N/A";
    loadComplaints();
  }
});

// ===== LOAD =====
function loadComplaints() {
  const container = document.getElementById("complaintsContainer");
  if (!container) return;

  const q = query(
    collection(db, "complaints"),
    where("wardNumber", "==", currentUserWard),
  );

  onSnapshot(
    q,
    async (snapshot) => {
      cachedComplaints = [];
      snapshot.forEach((docSnap) =>
        cachedComplaints.push({ id: docSnap.id, ...docSnap.data() }),
      );
      cachedComplaints.sort(
        (a, b) =>
          (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0),
      );
      await renderComplaints();
    },
    (error) => console.error("Query error:", error),
  );
}

// ===== RENDER =====
async function renderComplaints() {
  const container = document.getElementById("complaintsContainer");
  if (!container) return;
  const lang = localStorage.getItem("lang") || "en";

  if (cachedComplaints.length === 0) {
    container.innerHTML = `<p class="text-muted p-3">${t("noComplaints")}</p>`;
    return;
  }

  if (lang === "np") {
    container.innerHTML = `
      <div class="col-12 text-center py-4 text-muted">
        <div class="spinner-border spinner-border-sm me-2"></div>${t("translating")}
      </div>`;
  }

  const translatedList = await Promise.all(
    cachedComplaints.map(async (data) => {
      if (lang !== "np") return data;
      const { title, description } = await translateComplaint(data, lang);
      return { ...data, title, description };
    }),
  );

  container.innerHTML = "";
  translatedList.forEach((data) => {
    const date = data.createdAt?.toDate?.().toLocaleString() || "Syncing...";
    const statusLabel = translateStatus(data.status);
    const borderColor = getStatusColor(data.status);
    const badgeClass = getStatusBadgeClass(data.status);

    const card = document.createElement("div");
    card.className = "col-md-6 mb-4";
    card.innerHTML = `
      <div class="card h-100 shadow-sm border-0"
           style="border-radius:15px; border-left:6px solid ${borderColor} !important;">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <h5 class="fw-bold text-primary mb-1">${data.title}</h5>
            <button class="btn btn-sm btn-outline-danger delete-btn">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <p class="text-muted small mb-2">
            ${t("fromLabel")}: ${data.userName || "Citizen"} |
            ${t("wardLabel")}: ${data.wardNumber}
          </p>
          <p class="mb-1"><strong>${t("locationLabel")}:</strong> ${data.location}</p>
          <p class="card-text text-muted">${data.description}</p>
          <small class="text-muted">${date}</small>
          <hr>
          <div class="d-flex justify-content-between align-items-center">
            <span class="badge ${badgeClass}">${statusLabel}</span>
            <select class="form-select form-select-sm w-50 status-select">
              <option value="" disabled selected>${t("updateStatusPlaceholder")}</option>
              <option value="Submitted">${t("statusSubmitted")}</option>
              <option value="In Progress">${t("statusInProgress")}</option>
              <option value="Resolved">${t("statusResolved")}</option>
            </select>
          </div>
        </div>
      </div>`;

    card.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Delete this complaint?")) {
        try {
          await deleteDoc(doc(db, "complaints", data.id));
        } catch (e) {
          console.error("Delete error:", e);
        }
      }
    });

    card
      .querySelector(".status-select")
      .addEventListener("change", async (e) => {
        try {
          await updateDoc(doc(db, "complaints", data.id), {
            status: e.target.value,
          });
        } catch (e) {
          console.error("Status update error:", e);
        }
      });

    container.appendChild(card);
  });
}

// ===== SEARCH =====
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  document
    .querySelectorAll("#complaintsContainer .col-md-6")
    .forEach((card) => {
      card.style.display = card.innerText.toLowerCase().includes(term)
        ? ""
        : "none";
    });
});

// ===== LANGUAGE SELECTOR =====
const langSelect = document.getElementById("languageSelect");
if (langSelect) {
  const stored = localStorage.getItem("lang") || "en";
  langSelect.value = stored;
  langSelect.addEventListener("change", async () => {
    localStorage.setItem("lang", langSelect.value);
    await renderComplaints();
  });
}

// ===== LOGOUT =====
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

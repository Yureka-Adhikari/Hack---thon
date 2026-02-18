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
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";


 async function loadUserProfile(user) {
   // Reference the 'users' collection using the UID
   const docRef = doc(db, "users", user.uid);
   const docSnap = await getDoc(docRef);

   if (docSnap.exists()) {
     const data = docSnap.data();
     // Update your HTML elements with the data
     if (document.getElementById("userName")) {
       document.getElementById("userName").innerText = data.fullName;
     }
     console.log("User Data:", data);
   } else {
     console.log("No such document in Firestore!");
   }
 }

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById("uNameMain").innerText = data.fullName;
      document.getElementById("uNameTop").innerText = data.fullName;
      document.getElementById("uWard").innerText =
        `Ward ${data.wardNumber}, ${data.municipality}`;
    }
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
});

// Sidebar navigation
const navLinks = document.querySelectorAll("#sidebar .nav-link");
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  });
});


// ---------- SUBMIT COMPLAINT ----------
async function submitComplaint(data) {
  const user = auth.currentUser;

  if (!user) {
    alert("Please login first.");
    return;
  }

  try {
    await addDoc(collection(db, "complaints"), {
      title: data.title,
      category: data.category,
      description: data.description,
      location: data.location,
      municipality: data.municipality || "N/A",
      wardNumber: data.wardNumber || "N/A",
      status: "Submitted",
      userId: user.uid,
      createdAt: serverTimestamp(),
    });

    alert("Complaint submitted successfully!");
    window.location.href = "my-complaints.html";
  } catch (error) {
    console.error(error);
    alert("Error submitting complaint.");
  }
}

// ---------- QUICK BUTTONS ----------
document.getElementById("quickRoad")?.addEventListener("click", () => {
  submitComplaint({
    title: "Road Damage",
    category: "Road Damage",
    description: "There is a damaged road",
    location: "Near my area",
    municipality: "N/A",
    wardNumber: "N/A",
  });
});

document.getElementById("quickWater")?.addEventListener("click", () => {
  submitComplaint({
    title: "Water Issue",
    category: "Water",
    description: "No water supply in my area",
    location: "Near my area",
    municipality: "N/A",
    wardNumber: "N/A",
  });
});

document.getElementById("quickElectric")?.addEventListener("click", () => {
  submitComplaint({
    title: "Electricity Issue",
    category: "Electricity",
    description: "Power outage in my area",
    location: "Near my area",
    municipality: data.municipality,
    wardNumber: data.wardNumber,
  });
});

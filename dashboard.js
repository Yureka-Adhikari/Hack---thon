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

// Submit Complaint Functionality
document.getElementById("submitComplaintBtn").addEventListener("click", async () => {
  if (!currentUser) {
    alert("Please log in first");
    return;
  }

  const category = document.getElementById("category").value;
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const location = document.getElementById("location").value;

  if (!category || !title || !description || !location) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.data();

    // Add complaint to Firestore
    const complaintsRef = collection(db, "complaints");
    await addDoc(complaintsRef, {
      userId: currentUser.uid,
      userName: userData.fullName,
      wardNumber: userData.wardNumber,
      municipality: userData.municipality,
      category: category,
      title: title,
      description: description,
      location: location,
      status: "Submitted",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Clear form and close modal
    document.getElementById("complaintForm").reset();
    const modal = bootstrap.Modal.getInstance(document.getElementById("complaintModal"));
    modal.hide();

    alert("Complaint submitted successfully!");
  } catch (error) {
    console.error("Error submitting complaint:", error);
    alert("Error submitting complaint. Please try again.");
  }
});

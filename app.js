console.log("🔥 app.js loaded");

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDbR2Mg6HyDp9gB5dA-u2efd4Iv2DVCxVU",
  authDomain: "cloud-message-scheduler-new.firebaseapp.com",
  projectId: "cloud-message-scheduler-new",
  storageBucket: "cloud-message-scheduler-new.appspot.com",
  messagingSenderId: "643457105077",
  appId: "1:643457105077:web:61034a7f2d12c53127d2fc",
  measurementId: "G-3XRHMP1CCR"
};

// Initialize Firebase once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Submit handler
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("messageForm").addEventListener("submit", function (e) {
    e.preventDefault();
    console.log("✅ Form submitted");

    const recipient = document.getElementById("recipient").value.trim();
    const message = document.getElementById("message").value.trim();
    const schedule = document.getElementById("schedule").value;

    console.log("📩 Data:", { recipient, message, schedule });

    if (!recipient || !message || !schedule) {
      alert("Please fill out all fields.");
      return;
    }

    // Save to Firestore
    db.collection("scheduledMessages").add({
      to: recipient,
      text: message,
      scheduledAt: new Date(schedule),
      subject: "Scheduled Message",
      sent: false
    }).then(() => {
      console.log("📦 Message saved to Firestore");

      // Add to table
      const tbody = document.getElementById("messageTableBody");
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${recipient}</td>
        <td>${message}</td>
        <td>${new Date(schedule).toLocaleString()}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteRow(this)">Delete</button></td>
      `;

      tbody.appendChild(row);
      this.reset();
    }).catch((error) => {
      console.error("❌ Firestore Error:", error);
    });
  });
});

function deleteRow(button) {
  const row = button.closest("tr");
  row.remove();
}

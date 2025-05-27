// 🔥 Firebase Initialization ===================================
const firebaseConfig = {
  apiKey: "AIzaSyDbR2Mg6HyDp9gB5dA-u2efd4Iv2DVCxVU",
  authDomain: "cloud-message-scheduler-new.firebaseapp.com",
  projectId: "cloud-message-scheduler-new",
  storageBucket: "cloud-message-scheduler-new.appspot.com",
  messagingSenderId: "643457105077",
  appId: "1:643457105077:web:61034a7f2d12c53127d2fc",
  measurementId: "G-3XRHMP1CCR"
};

// Initialize Firebase with persistence
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  firebase.firestore().enablePersistence()
    .catch(err => console.warn("Persistence failed:", err));
}
const db = firebase.firestore();

// 🚀 DOM Ready Handler ========================================
document.addEventListener("DOMContentLoaded", () => {
  initMessageTable();
  setupFormListener();
});

// 📋 Table Initialization =====================================
function initMessageTable() {
  const tbody = document.getElementById("messageTableBody");
  tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading messages...</td></tr>';

  db.collection("scheduledMessages")
    .where("sent", "==", false)
    .orderBy("scheduledAt", "asc")
    .onSnapshot((querySnapshot) => {
      if (querySnapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No pending messages</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const row = createTableRow(doc.id, data);
        tbody.appendChild(row);
      });
    }, (error) => {
      console.error("Error listening to messages:", error);
      tbody.innerHTML = `<tr><td colspan="4" class="text-center error">Error loading messages</td></tr>`;
    });
}

// ✉️ Form Handling ===========================================
function setupFormListener() {
  const form = document.getElementById("messageForm");
  const submitBtn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Sending...';

    try {
      const { recipient, message, schedule } = getFormData();
      validateForm(recipient, message, schedule);

      await db.collection("scheduledMessages").add({
        to: recipient,
        text: message,
        htmlContent: `<p>${message}</p>`,
        scheduledAt: firebase.firestore.Timestamp.fromDate(new Date(schedule)),
        subject: "Scheduled Message",
        sent: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "pending"
      });

      showAlert('success', 'Message scheduled successfully!');
      form.reset();
    } catch (error) {
      console.error("Submission error:", error);
      showAlert('danger', error.message || 'Failed to schedule message');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Schedule Message';
    }
  });
}

// 🛠 Utility Functions ========================================
function getFormData() {
  return {
    recipient: document.getElementById("recipient").value.trim(),
    message: document.getElementById("message").value.trim(),
    schedule: document.getElementById("schedule").value
  };
}

function validateForm(recipient, message, schedule) {
  if (!recipient || !message || !schedule) {
    throw new Error("Please fill all fields");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Please enter a valid email address");
  }
  if (new Date(schedule) < new Date()) {
    throw new Error("Scheduled time must be in the future");
  }
}

function createTableRow(docId, data) {
  const row = document.createElement("tr");
  row.dataset.id = docId;
  
  const scheduledDate = data.scheduledAt?.toDate 
    ? data.scheduledAt.toDate() 
    : new Date(data.scheduledAt);

  row.innerHTML = `
    <td>${data.to}</td>
    <td>${data.text}</td>
    <td>${scheduledDate.toLocaleString()}</td>
    <td>
      <button class="btn btn-sm btn-danger" onclick="deleteMessage('${docId}', this)">
        <i class="bi bi-trash"></i> Delete
      </button>
    </td>
  `;
  return row;
}

function showAlert(type, message) {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.getElementById("alertsContainer").prepend(alertDiv);
  setTimeout(() => alertDiv.remove(), 5000);
}

// 🗑 Delete Function ==========================================
window.deleteMessage = async function(docId, button) {
  if (!confirm("Are you sure you want to delete this message?")) return;
  
  const row = button.closest("tr");
  row.classList.add("deleting");

  try {
    await db.collection("scheduledMessages").doc(docId).delete();
    row.remove();
    showAlert('success', 'Message deleted successfully');
  } catch (error) {
    console.error("Delete error:", error);
    row.classList.remove("deleting");
    showAlert('danger', 'Failed to delete message');
  }
};

const admin = require("firebase-admin");
const Brevo = require("@getbrevo/brevo"); // Updated package name

// 1. ENVIRONMENT VALIDATION ====================================
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("❌ Missing FIREBASE_SERVICE_ACCOUNT environment variable");
}
if (!process.env.BREVO_API_KEY) {
  throw new Error("❌ Missing BREVO_API_KEY environment variable");
}

// 2. FIREBASE INITIALIZATION ===================================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com` // Added for Firestore
});

const db = admin.firestore();

// 3. BREVO CLIENT SETUP ========================================
const brevoClient = Brevo.ApiClient.instance;
brevoClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const emailApi = new Brevo.TransactionalEmailsApi();

// 4. CORE FUNCTION =============================================
async function sendScheduledMessages() {
  const now = admin.firestore.Timestamp.now();
  
  try {
    // 4.1 Query optimization
    const snapshot = await db.collection("scheduledMessages")
      .where("sent", "==", false)
      .where("scheduledAt", "<=", now)
      .get();

    if (snapshot.empty) {
      console.log("⏳ No pending messages to send");
      return { success: true, sentCount: 0 };
    }

    // 4.2 Batch processing with status updates
    const batch = db.batch();
    let sentCount = 0;

    for (const doc of snapshot.docs) {
      const msg = doc.data();
      
      try {
        // 4.3 Email sending
        await emailApi.sendTransacEmail({
          sender: { 
            name: msg.senderName || "Scheduled Messages",
            email: msg.senderEmail || "noreply@yourdomain.com" // Should be verified in Brevo
          },
          to: [{ email: msg.to }],
          subject: msg.subject || "Scheduled Message",
          htmlContent: msg.htmlContent || `<p>${msg.text}</p>`,
          textContent: msg.textContent || msg.text.replace(/<[^>]*>/g, "")
        });

        // 4.4 Mark as sent in Firestore
        const msgRef = db.collection("scheduledMessages").doc(doc.id);
        batch.update(msgRef, {
          sent: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "delivered"
        });
        
        sentCount++;
        console.log(`📤 Sent to ${msg.to} (ID: ${doc.id})`);

      } catch (err) {
        console.error(`❌ Failed to send to ${msg.to}:`, err.response?.body || err.message);
        
        // Mark as failed with error details
        const msgRef = db.collection("scheduledMessages").doc(doc.id);
        batch.update(msgRef, {
          status: "failed",
          error: err.response?.body?.message || err.message,
          lastAttempt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // 4.5 Commit all Firestore updates
    await batch.commit();
    return { success: true, sentCount };

  } catch (err) {
    console.error("🔥 Critical scheduler error:", err);
    return { success: false, error: err.message };
  }
}

// 5. EXECUTION WITH ERROR HANDLING =============================
sendScheduledMessages()
  .then(result => {
    if (result.success) {
      console.log(`✅ Successfully processed ${result.sentCount || 0} messages`);
    } else {
      console.error("❌ Scheduler failed:", result.error);
    }
    process.exit(result.success ? 0 : 1); // Proper exit code for CI/CD
  })
  .catch(err => {
    console.error("💥 Unhandled scheduler error:", err);
    process.exit(1);
  });

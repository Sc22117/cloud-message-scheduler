const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Brevo = require("@getbrevo/brevo"); // Updated package

// 1. INITIALIZATION ===========================================
admin.initializeApp();

// 2. BREVO CONFIGURATION ======================================
const brevoClient = Brevo.ApiClient.instance;
brevoClient.authentications["api-key"].apiKey = functions.config().brevo.key;
const emailApi = new Brevo.TransactionalEmailsApi();

// 3. CLOUD FUNCTION ===========================================
exports.sendScheduledMessages = functions
  .region("asia-south1") // Set your preferred region
  .pubsub.schedule("every 5 minutes") // Reduced frequency
  .timeZone("Asia/Kolkata") // Set your timezone
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    let successCount = 0;
    let failureCount = 0;

    try {
      // 3.1 Query Optimization
      const snapshot = await db.collection("scheduledMessages")
        .where("scheduledAt", "<=", now)
        .where("sent", "==", false)
        .limit(500) // Prevent timeout with large datasets
        .get();

      if (snapshot.empty) {
        functions.logger.log("No pending messages found");
        return { status: "success", message: "No messages to send" };
      }

      // 3.2 Parallel Processing with Error Handling
      const promises = snapshot.docs.map(async (doc) => {
        const msg = doc.data();
        const docRef = doc.ref;

        try {
          await emailApi.sendTransacEmail({
            sender: {
              name: msg.senderName || "System Sender",
              email: msg.senderEmail || "noreply@yourdomain.com" // Should be verified
            },
            to: [{ email: msg.to }],
            subject: msg.subject || "Scheduled Message",
            htmlContent: msg.htmlContent || `<p>${msg.text}</p>`,
            textContent: msg.textContent || msg.text.replace(/<[^>]*>/g, "")
          });

          batch.update(docRef, {
            sent: true,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "delivered"
          });
          successCount++;
          functions.logger.log(`Sent to ${msg.to} (ID: ${doc.id})`);
        } catch (error) {
          const errorData = error?.response?.body || error.message;
          functions.logger.error(`Failed to send to ${msg.to}:`, errorData);

          batch.update(docRef, {
            lastError: errorData,
            status: "failed",
            attemptCount: admin.firestore.FieldValue.increment(1),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp()
          });
          failureCount++;
        }
      });

      await Promise.all(promises);
      await batch.commit();

      return {
        status: "completed",
        successCount,
        failureCount,
        timestamp: now.toDate().toISOString()
      };

    } catch (error) {
      functions.logger.error("Scheduler failed:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Message processing failed",
        error
      );
    }
  });

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Brevo = require("sib-api-v3-sdk");

admin.initializeApp();
const db = admin.firestore();

// 🔐 Load Brevo API key from Firebase config
const brevoClient = Brevo.ApiClient.instance;
brevoClient.authentications["api-key"].apiKey = functions.config().brevo.key;
const emailApi = new Brevo.TransactionalEmailsApi();

// 🕐 Scheduled function to run every 1 minute
exports.sendScheduledMessages = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
  const now = admin.firestore.Timestamp.now();

  const snapshot = await db.collection("scheduledMessages")
    .where("scheduledAt", "<=", now)
    .where("sent", "==", false)
    .get();

  if (snapshot.empty) {
    console.log("⏳ No messages to send.");
    return null;
  }

  const tasks = snapshot.docs.map(async (doc) => {
    const msg = doc.data();
    const docRef = doc.ref;

    const email = {
      sender: { name: "Shraddha Chauhan", email: "shraddhachauhan637@gmail.com" }, // Verified Brevo sender
      to: [{ email: msg.to }],
      subject: msg.subject || "Scheduled Message",
      htmlContent: `<p>${msg.text}</p>`
    };

    try {
      await emailApi.sendTransacEmail(email);
      console.log(`📤 Sent to ${msg.to}`);
      await docRef.update({ sent: true });
    } catch (error) {
      console.error(`❌ Failed to send to ${msg.to}:`, error?.response?.body || error);
    }
  });

  await Promise.all(tasks);
  return null;
});

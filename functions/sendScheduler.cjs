
const admin = require("firebase-admin");
const Brevo = require("sib-api-v3-sdk");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const brevoClient = Brevo.ApiClient.instance;
const apiKey = process.env.BREVO_API_KEY;
brevoClient.authentications['api-key'].apiKey = apiKey;

const emailApi = new Brevo.TransactionalEmailsApi();

async function sendScheduledMessages() {
  const now = new Date();
  const snapshot = await db.collection("scheduledMessages")
    .where("sent", "==", false)
    .where("scheduledAt", "<=", now)
    .get();

  if (snapshot.empty) {
    console.log("⏳ No scheduled messages.");
    return;
  }

  for (const doc of snapshot.docs) {
    const msg = doc.data();
    const docId = doc.id;

    const email = {
      sender: { name: "Shraddha Chauhan", email: "shraddhachauhan637@gmail.com" }, // ✅ Must be verified in Brevo
      to: [{ email: msg.to }],
      subject: msg.subject || "Scheduled Message",
      htmlContent: `<p>${msg.text}</p>`
    };

    try {
      await emailApi.sendTransacEmail(email);
      console.log(`📤 Sent to ${msg.to}`);

      await db.collection("scheduledMessages").doc(docId).update({ sent: true });
      console.log(`✅ Marked as sent in Firestore`);
    } catch (err) {
      console.error(`❌ Failed to send to ${msg.to}`, err.response?.text || err);
    }
  }
}

sendScheduledMessages();

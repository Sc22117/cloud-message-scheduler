
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
  const now = admin.firestore.Timestamp.now();
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
      htmlContent: `<p>${msg.text}</p>`,
      textContent: msg.text
    };

    try {
  await emailApi.sendTransacEmail({
    sender: { name: "Shraddha Chauhan", email: "shraddhachauhan637@gmail.com" },
    to: [{ email: msg.to }],
    subject: msg.subject || "Scheduled Message",
    htmlContent: msg.text,
    textContent: msg.text.replace(/<[^>]*>/g, ""), // Plain text fallback
  });
  console.log(`📤 Email sent to ${msg.to}`);
} catch (err) {
  console.error("Brevo API Error:", err.response?.body || err.message);
}
  }
}

sendScheduledMessages();

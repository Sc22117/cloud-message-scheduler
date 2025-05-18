const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();
const db = admin.firestore();

// Replace with your actual SendGrid API Key
sgMail.setApiKey(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);

// Cloud Function: Scheduled Message Sender
exports.sendScheduledMessages = functions.pubsub.schedule("every 1 minutes").onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  
  const snapshot = await db.collection("messages")
    .where("scheduledAt", "<=", now)
    .where("sent", "==", false)
    .get();

  const updates = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const msg = {
      to: data.to,
      from: "gdg.geu.shraddhachauhan.05062005@gmail.com", // Your verified sender
      subject: data.subject,
      text: data.text,
    };

    updates.push(
      sgMail.send(msg).then(() => {
        return doc.ref.update({ sent: true });
      })
    );
  });

  await Promise.all(updates);
  console.log("Checked and sent scheduled messages");
});

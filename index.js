// index.js

// ===== Dependencies =====
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
require("dotenv").config();

// ===== Timezone =====
const TIMEZONE = "Asia/Kolkata";

// ===== Startup Marker =====
console.log(`🚀 Bot starting up at ${new Date().toLocaleString("en-IN", { timeZone: TIMEZONE })}`);

// ===== Keep-Alive Express Server =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("✅ WhatsApp bot is alive!");
});
app.listen(PORT, () => {
    console.log(`🌐 Keep-alive server running on port ${PORT}`);
});

// ===== Heartbeat Logger =====
setInterval(() => {
    console.log(`💓 Bot alive at ${new Date().toLocaleString("en-IN", { timeZone: TIMEZONE })}`);
}, 5 * 60 * 1000); // every 5 minutes

// ===== WhatsApp Client =====
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
});

client.on("qr", qr => {
    console.log("📸 QR RECEIVED — scan in WhatsApp Web to login");
});

client.on("ready", () => {
    console.log("✅ WhatsApp Bot is ready!");
});

client.on("disconnected", (reason) => {
    console.log(`⚠️ WhatsApp disconnected: ${reason}. Attempting to reconnect...`);
    client.initialize(); // auto-reconnect
});

// ===== Example Scheduled Message =====
function scheduleMessage(hour, minute, chatId, message) {
    setInterval(() => {
        const now = new Date(new Date().toLocaleString("en-IN", { timeZone: TIMEZONE }));
        if (now.getHours() === hour && now.getMinutes() === minute) {
            client.sendMessage(chatId, message)
                .then(() => console.log(`📤 Sent message to ${chatId} at ${now}`))
                .catch(err => console.error("❌ Error sending message:", err));
        }
    }, 60 * 1000); // check every minute
}

// Example usage: send at 10:00 AM
scheduleMessage(10, 0, "91XXXXXXXXXX@c.us", "Good morning! 🌞");

// ===== Start WhatsApp Client =====
client.initialize();

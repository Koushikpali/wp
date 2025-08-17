// index.js
const { Client, LocalAuth } = require("whatsapp-web.js");
const cron = require("node-cron");
const qrcode = require("qrcode-terminal");

console.log("🚀 Starting WhatsApp Bot...");

// ================== CREATE CLIENT ==================
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./whatsapp-session", // safer local dir
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--mute-audio",
      "--disable-notifications",
      "--window-size=1920,1080",
    ],
  },
});

// ================== EVENT HANDLERS ==================
client.on("qr", (qr) => {
  console.log("⚡ Scan this QR code in WhatsApp:");
  qrcode.generate(qr, { small: true }); // nicer QR in terminal
});

client.on("ready", () => {
  console.log("✅ WhatsApp client is ready!");
});

client.on("authenticated", () => {
  console.log("🔑 Authenticated with WhatsApp");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Authentication failed:", msg);
});

client.on("disconnected", (reason) => {
  console.error("❌ Client disconnected:", reason);
  console.log("♻ Restarting client in 10s...");
  setTimeout(() => client.initialize(), 10000);
});

// ================== SAFE SEND FUNCTION ==================
async function safeSend(to, message) {
  try {
    if (!client.info || !client.info.wid) {
      console.error("⚠ Client not ready, skipping send.");
      return;
    }
    await client.sendMessage(to, message);
    console.log(`✅ Sent message to ${to}: ${message}`);
  } catch (err) {
    console.error("❌ Failed to send message:", err.message);
  }
}

// ================== CRON JOB (Every 15 mins) ==================
cron.schedule("*/15 * * * *", async () => {
  const now = new Date();
  console.log(`📤 Cron triggered at: ${now.toLocaleString()}`);

  const to = "917869495473@c.us"; // change to your number
  const message = "Hello! This is an automated cron message 🚀";

  await safeSend(to, message);
});

// ================== START CLIENT ==================
client.initialize();

// index.js
const { Client, LocalAuth } = require("whatsapp-web.js");
const cron = require("node-cron");

console.log("🚀 Starting WhatsApp Bot...");

// ================== CREATE CLIENT ==================
console.log("DEBUG: Creating WhatsApp client...");

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "/mnt/whatsapp-session", // persistent session
  }),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/google-chrome-stable",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--single-process",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--mute-audio",
      "--disable-notifications",
      "--window-size=1920,1080",
      "--user-data-dir=/tmp/puppeteer_profile", // Chrome profile dir
    ],
  },
});

// ================== EVENT HANDLERS ==================
client.on("qr", (qr) => {
  console.log("⚡ Scan this QR code in WhatsApp:");
  console.log(qr);
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
  console.log("♻ Restarting client in 5s...");
  setTimeout(() => client.initialize(), 5000);
});

// ================== SAFE SEND FUNCTION ==================
async function safeSend(to, message) {
  try {
    if (!client.pupPage || client.pupPage.isClosed()) {
      console.error("⚠ Puppeteer page closed, reinitializing...");
      await client.initialize();
      return;
    }
    await client.sendMessage(to, message);
    console.log(`✅ Sent message to ${to}:`, message);
  } catch (err) {
    console.error("❌ Failed to send message:", err);
  }
}

// ================== CRON JOB (Every 15 mins) ==================
cron.schedule("*/15 * * * *", async () => {
  const now = new Date();
  console.log(`📤 Cron triggered at: ${now.toLocaleString()}`);

  if (!client.info || !client.info.wid) {
    console.log("⚠ WhatsApp client not connected, skipping send.");
    return;
  }

  const to = "917869495473@c.us";  // Replace with your target number
  const message = "Hello! This is an automated cron message 🚀";

  await safeSend(to, message);
});

// ================== START CLIENT ==================
client.initialize();

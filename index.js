const { Client, LocalAuth } = require("whatsapp-web.js");
const puppeteer = require("puppeteer");
const cron = require("node-cron");

console.log("🚀 Starting WhatsApp Bot...");

// ================== CREATE CLIENT ==================
console.log("DEBUG: Creating WhatsApp client...");
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/mnt/whatsapp-session'   // persistent session
    }),
    puppeteer: {
        headless: true,
        product: 'chrome',
        executablePath:'/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process',
            '--disable-software-rasterizer',
            '--window-size=1920,1080',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ],
    }
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
    console.log("♻ Restarting client...");
    client.initialize();
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

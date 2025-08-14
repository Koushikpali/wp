// ======== DEPENDENCIES ========
require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const cron = require('node-cron');
const puppeteer = require('puppeteer');
const path = require('path');

// ======== CONFIG ========
const railwayTime = process.env.RAILWAY_TIME || '09:00';
const [hour, minute] = railwayTime.split(':').map(Number);
const TIMEZONE = 'Asia/Kolkata';

// ======== STARTUP LOG ========
console.log(`🚀 Bot starting at ${new Date().toLocaleString('en-IN', { timeZone: TIMEZONE })}`);

// ======== KEEP-ALIVE SERVER ========
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Bot is alive!'));
app.listen(PORT, () => console.log(`🌐 Keep-alive server running on port ${PORT}`));

// ======== LINK ROTATION ========
const linksFilePath = path.join(__dirname, 'link.txt');
const indexFilePath = path.join(__dirname, 'linkIndex.json');

function getLinks() {
    try {
        const links = fs.readFileSync(linksFilePath, 'utf-8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        console.log(`DEBUG: Loaded ${links.length} links.`);
        return links;
    } catch (err) {
        console.error('❌ Error reading links file:', err);
        return [];
    }
}

function getLastIndex() {
    try {
        if (fs.existsSync(indexFilePath)) {
            const json = JSON.parse(fs.readFileSync(indexFilePath, 'utf-8'));
            return json.lastIndex || 0;
        }
    } catch (err) {
        console.error('❌ Error reading index file:', err);
    }
    return 0;
}

function saveLastIndex(index) {
    try {
        fs.writeFileSync(indexFilePath, JSON.stringify({ lastIndex: index }, null, 2));
    } catch (err) {
        console.error('❌ Error saving index file:', err);
    }
}

function getNextLink() {
    const links = getLinks();
    if (links.length === 0) return null;
    let lastIndex = getLastIndex();
    let nextIndex = lastIndex % links.length;
    const linkToSend = links[nextIndex];
    console.log(`DEBUG: lastIndex=${lastIndex}, nextIndex=${nextIndex}, chosen link=${linkToSend}`);
    saveLastIndex(nextIndex + 1);
    return linkToSend;
}

// ======== SEND MESSAGE WITH TIMEOUT ========
async function sendWithTimeout(chatId, message, timeoutMs = 10000) {
    return Promise.race([
        client.sendMessage(chatId, message),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Send timeout")), timeoutMs))
    ]);
}

// ======== WHATSAPP CLIENT ========
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/mnt/whatsapp-session'
    }),
    puppeteer: {
        product: 'chrome',
        executablePath: puppeteer.executablePath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

// ======== QR CODE HANDLING ========
client.on('qr', async (qr) => {
    console.log('📸 Scan this QR code with WhatsApp Linked Devices:');
    qrcode.generate(qr, { small: true });

    await QRCode.toFile('qr.png', qr);
    console.log('✅ QR code saved as qr.png');

    const pngBuffer = fs.readFileSync('qr.png');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const { width, height } = pngImage.scale(0.5);
    page.drawImage(pngImage, { x: 50, y: 400, width, height });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('qr.pdf', pdfBytes);
    console.log('✅ QR code saved as qr.pdf');

    const base64Pdf = pdfBytes.toString('base64');
    console.log(`🔗 Open in browser: data:application/pdf;base64,${base64Pdf}`);
});

// ======== CLIENT READY ========
client.on('ready', async () => {
    console.log('✅ WhatsApp Bot is ready!');
});

// ======== CRON JOB ========
cron.schedule(`${minute} ${hour} * * *`, async () => {
    console.log('📤 Sending daily scheduled message...');

    // Connection check
    if (!client.info || !client.info.wid) {
        console.log("⚠ WhatsApp client not connected, skipping send.");
        return;
    }

    try {
        // Get latest group ID each time
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name === process.env.WHATSAPP_GROUP_NAME);
        if (!group) {
            console.error(`❌ Group "${process.env.WHATSAPP_GROUP_NAME}" not found.`);
            return;
        }
        const groupId = group.id._serialized;

        // Get link
        let link = getNextLink();
        if (!link) {
            console.log('⚠ No links found to send.');
            return;
        }

        console.log("DEBUG: About to send message...");
        await sendWithTimeout(groupId, `
this is an automated bot msg. Testing is on. If you receive this msg at ${railwayTime} IST, it's working fine 🚀 📌 Today’s DSA problem: ${link}`);
        console.log(`✅ Sent: ${link}`);

    } catch (err) {
        console.error('❌ Failed to send link:', err);
    }
}, {
    timezone: TIMEZONE
});

// ======== ERROR HANDLING ========
client.on('error', (err) => {
    console.error('❌ Client error:', err);
});

client.on('disconnected', (reason) => {
    console.error("❌ WhatsApp disconnected:", reason);
    console.log("🔄 Reconnecting...");
    client.initialize();
});

client.on('auth_failure', (msg) => {
    console.error("❌ Authentication failed:", msg);
});

// ======== INITIALIZE CLIENT ========
client.initialize();

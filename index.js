// ======== DEPENDENCIES ========
console.log("DEBUG: Loading dependencies...");
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
console.log("DEBUG: Reading environment variables...");
const railwayTime = process.env.RAILWAY_TIME || '09:00';
const [hour, minute] = railwayTime.split(':').map(Number);
const TIMEZONE = 'Asia/Kolkata';
console.log(`🚀 Bot starting at ${new Date().toLocaleString('en-IN', { timeZone: TIMEZONE })}`);
console.log(`DEBUG: railwayTime=${railwayTime}, hour=${hour}, minute=${minute}, timezone=${TIMEZONE}`);

// ======== KEEP-ALIVE SERVER ========
console.log("DEBUG: Starting express server...");
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    console.log("DEBUG: Received GET / request");
    res.send('✅ Bot is alive!');
});
app.listen(PORT, () => console.log(`🌐 Keep-alive server running on port ${PORT}`));

// ======== LINK ROTATION ========
const linksFilePath = path.join(__dirname, 'link.txt');
const indexFilePath = path.join(__dirname, 'linkIndex.json');
console.log(`DEBUG: linksFilePath=${linksFilePath}, indexFilePath=${indexFilePath}`);

function getLinks() {
    console.log("DEBUG: Entered getLinks()");
    try {
        const data = fs.readFileSync(linksFilePath, 'utf-8');
        console.log("DEBUG: Raw file data =", data);
        const links = data
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        console.log(`DEBUG: Parsed ${links.length} links =`, links);
        return links;
    } catch (err) {
        console.error('❌ Error reading links file:', err);
        return [];
    }
}

function getLastIndex() {
    console.log("DEBUG: Entered getLastIndex()");
    try {
        if (fs.existsSync(indexFilePath)) {
            console.log("DEBUG: indexFile exists");
            const raw = fs.readFileSync(indexFilePath, 'utf-8');
            console.log("DEBUG: indexFile raw content =", raw);
            const json = JSON.parse(raw);
            console.log("DEBUG: Parsed lastIndex =", json.lastIndex);
            return json.lastIndex || 0;
        }
    } catch (err) {
        console.error('❌ Error reading index file:', err);
    }
    console.log("DEBUG: indexFile not found or empty, returning 0");
    return 0;
}

function saveLastIndex(index) {
    console.log("DEBUG: Entered saveLastIndex() with index =", index);
    try {
        fs.writeFileSync(indexFilePath, JSON.stringify({ lastIndex: index }, null, 2));
        console.log("DEBUG: Successfully wrote index file");
    } catch (err) {
        console.error('❌ Error saving index file:', err);
    }
}

function getNextLink() {
    console.log("DEBUG: Entered getNextLink()");
    const links = getLinks();
    if (links.length === 0) {
        console.log("DEBUG: No links found, returning null");
        return null;
    }
    let lastIndex = getLastIndex();
    let nextIndex = lastIndex % links.length;
    const linkToSend = links[nextIndex];
    console.log(`DEBUG: lastIndex=${lastIndex}, nextIndex=${nextIndex}, chosen link=${linkToSend}`);
    saveLastIndex(nextIndex + 1);
    return linkToSend;
}

// ======== SEND MESSAGE WITH TIMEOUT ========
async function sendWithTimeout(chatId, message, timeoutMs = 10000) {
    console.log(`DEBUG: Entered sendWithTimeout() chatId=${chatId}, timeoutMs=${timeoutMs}`);
    console.log("DEBUG: Message content =", message);
    return Promise.race([
        client.sendMessage(chatId, message).then(res => {
            console.log("DEBUG: sendMessage resolved =", res);
            return res;
        }),
        new Promise((_, reject) => {
            setTimeout(() => {
                console.error("❌ Send timeout after", timeoutMs, "ms");
                reject(new Error("Send timeout"));
            }, timeoutMs);
        })
    ]);
}

// ======== WHATSAPP CLIENT ========
console.log("DEBUG: Creating WhatsApp client...");
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
    console.log("DEBUG: QR event triggered");
    qrcode.generate(qr, { small: true });
    console.log("DEBUG: Generated terminal QR");

    await QRCode.toFile('qr.png', qr);
    console.log('✅ QR code saved as qr.png');

    const pngBuffer = fs.readFileSync('qr.png');
    console.log("DEBUG: Read qr.png buffer length =", pngBuffer.length);

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
    console.log("DEBUG: client.info =", client.info);
});

// ======== CRON JOB ========
cron.schedule(`${minute} ${hour} * * *`, async () => {
    console.log('📤 Cron triggered at:', new Date().toLocaleString('en-IN', { timeZone: TIMEZONE }));

    if (!client.info || !client.info.wid) {
        console.log("⚠ WhatsApp client not connected, skipping send.");
        return;
    }
    console.log("✅ Client connected:", client.info.wid);

    try {
        const chats = await client.getChats();
        console.log(`DEBUG: Total chats found = ${chats.length}`);
        chats.forEach((c, i) => console.log(`DEBUG: Chat[${i}] name=${c.name}, isGroup=${c.isGroup}`));

        const group = chats.find(chat => chat.isGroup && chat.name === process.env.WHATSAPP_GROUP_NAME);
        if (!group) {
            console.error(`❌ Group "${process.env.WHATSAPP_GROUP_NAME}" not found`);
            return;
        }
        console.log(`✅ Found group: ${group.name} (${group.id._serialized})`);

        let link = getNextLink();
        console.log("DEBUG: Selected link =", link);
        if (!link) {
            console.log('⚠ No links found to send.');
            return;
        }

        console.log("DEBUG: Sending message now...");
        await sendWithTimeout(group.id._serialized, `
🚀 Automated bot test
⏰ Time: ${railwayTime} IST
📌 Today’s DSA problem: ${link}`);
        console.log(`✅ Sent successfully: ${link}`);

    } catch (err) {
        console.error('❌ Failed to send link:', err);
    }
}, { timezone: TIMEZONE });

// ======== ERROR HANDLING ========
client.on('error', (err) => console.error('❌ Client error:', err));
client.on('disconnected', (reason) => {
    console.error("❌ WhatsApp disconnected:", reason);
    console.log("🔄 Reconnecting...");
    client.initialize();
});
client.on('auth_failure', (msg) => console.error("❌ Authentication failed:", msg));
client.on('message', (msg) => console.log(`💬 Incoming message from ${msg.from}: ${msg.body}`));
client.on('authenticated', () => console.log("DEBUG: Client authenticated"));
client.on('loading_screen', (percent, msg) => console.log(`DEBUG: Loading screen ${percent}% - ${msg}`));
client.on('change_state', state => console.log("DEBUG: Client state changed:", state));

// ======== INITIALIZE CLIENT ========
console.log("DEBUG: Initializing WhatsApp client...");
client.initialize();

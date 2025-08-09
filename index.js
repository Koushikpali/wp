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
        return fs.readFileSync(linksFilePath, 'utf-8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
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
    fs.writeFileSync(indexFilePath, JSON.stringify({ lastIndex: index }, null, 2));
}

function getNextLink() {
    const links = getLinks();
    if (links.length === 0) return null;
    let lastIndex = getLastIndex();
    let nextIndex = lastIndex % links.length;
    const linkToSend = links[nextIndex];
    saveLastIndex(nextIndex + 1);
    return linkToSend;
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

// ======== WHEN CLIENT IS READY ========
client.on('ready', async () => {
    console.log('✅ WhatsApp Bot is ready!');

    const groupName = process.env.WHATSAPP_GROUP_NAME;
    const chats = await client.getChats();
    const group = chats.find(chat => chat.isGroup && chat.name === groupName);

    if (!group) {
        console.error(`❌ Group "${groupName}" not found.`);
        return;
    }

    const groupId = group.id._serialized;

    // ======== DAILY MESSAGE ========
    cron.schedule(`${minute} ${hour} * * *`, async () => {
        console.log('📤 Sending daily scheduled message...');
        try {
            let link = getNextLink();
            if (link) {
                await client.sendMessage(groupId, `
this is an automated bot msg. Testing is on. If you receive this msg at ${railwayTime} IST, it's working fine 🚀 📌 Today’s DSA problem: ${link}`);
                console.log(`✅ Sent: ${link}`);
            } else {
                console.log('⚠ No links found to send.');
            }
        } catch (err) {
            console.error('❌ Failed to send link:', err);
        }
    }, {
        timezone: TIMEZONE
    });
});

// ======== ERROR HANDLING ========
client.on('error', (err) => {
    console.error('❌ Client error:', err);
});

// ======== INITIALIZE CLIENT ========
client.initialize();

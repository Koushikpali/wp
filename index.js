require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const cron = require('node-cron');

// Create WhatsApp client with persistent login
const puppeteer = require('puppeteer');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/mnt/whatsapp-session'
    }),
    puppeteer: {
        product: 'chrome',
        executablePath: puppeteer.executablePath(), // ✅ Forces Puppeteer's bundled Chromium
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


// Show QR code in terminal, save PNG & PDF, and log Base64 link
client.on('qr', async (qr) => {
    console.log('📸 Scan this QR code with WhatsApp Linked Devices (expires in ~60 seconds):');
    qrcode.generate(qr, { small: true });

    // Save as PNG
    await QRCode.toFile('qr.png', qr);
    console.log('✅ QR code saved as qr.png');

    // Save as PDF
    const pngBuffer = fs.readFileSync('qr.png');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const { width, height } = pngImage.scale(0.5);
    page.drawImage(pngImage, { x: 50, y: 400, width, height });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('qr.pdf', pdfBytes);
    console.log('✅ QR code also saved as qr.pdf');

    // Log Base64 link for browser viewing
    const base64Pdf = pdfBytes.toString('base64');
    console.log(`🔗 Open this link in your browser to view QR:\n data:application/pdf;base64,${base64Pdf}`);
});

// Once logged in and client is ready
client.on('ready', async () => {
    console.log('✅ WhatsApp Bot is ready!');

    const groupName = process.env.WHATSAPP_GROUP_NAME;
    const message = process.env.DAILY_MESSAGE;

    // Find the group ID by name
    const chats = await client.getChats();
    const group = chats.find(chat => chat.isGroup && chat.name === groupName);

    if (!group) {
        console.error(`❌ Group "${groupName}" not found.`);
        return;
    }

    const groupId = group.id._serialized;

    // 🚀 Send a test message immediately after bot is ready
    try {
        await client.sendMessage(groupId, "🚀 Test message from Railway bot — we are live!");
        console.log("✅ Test message sent!");
    } catch (err) {
        console.error("❌ Failed to send test message:", err);
    }

    // Schedule a daily message at 9:00 AM IST
    cron.schedule('0 9 * * *', async () => {
        console.log('📤 Sending daily scheduled message...');
        try {
            await client.sendMessage(groupId, message);
            console.log('✅ Message sent successfully!');
        } catch (err) {
            console.error('❌ Failed to send message:', err);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });
});

// Handle client errors
client.on('error', (err) => {
    console.error('❌ Client error:', err);
});

client.initialize();

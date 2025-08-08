require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const cron = require('node-cron');

// Create WhatsApp client with persistent login
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/mnt/whatsapp-session' // Must match the mount path of your Railway volume
    }),
    puppeteer: {
        product: 'chrome',
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

// Show QR code in terminal, save as PNG/PDF, and print direct link
client.on('qr', async (qr) => {
    console.log('📸 Scan this QR code with WhatsApp Linked Devices (expires in ~60 seconds):');
    qrcode.generate(qr, { small: true });

    // Save PNG
    const pngPath = 'qr.png';
    await QRCode.toFile(pngPath, qr);
    console.log(`✅ QR code saved as ${pngPath}`);

    // Save PDF
    const pdfPath = 'qr.pdf';
    const pdfDoc = await PDFDocument.create();
    const pngImageBytes = fs.readFileSync(pngPath);
    const pngImage = await pdfDoc.embedPng(pngImageBytes);
    const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
    page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height,
    });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(pdfPath, pdfBytes);
    console.log(`✅ QR code also saved as ${pdfPath}`);

    // Print Base64 link for instant browser view
    const base64QR = pngImageBytes.toString('base64');
    console.log(`🌐 Open this link in your browser to view the QR instantly:\n`);
    console.log(`data:image/png;base64,${base64QR}\n`);
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

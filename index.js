require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const { PDFDocument, rgb } = require('pdf-lib');
const cron = require('node-cron');

// Create WhatsApp client with persistent login
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/mnt/whatsapp-session' // Must match your Railway volume path
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

// Show QR code in terminal + save PNG + PDF
client.on('qr', async (qr) => {
    console.log('📸 Scan this QR code with WhatsApp Linked Devices (expires in ~60 seconds):');
    qrcode.generate(qr, { small: true });

    // Save QR as PNG
    await QRCode.toFile('qr.png', qr);
    console.log('✅ QR code saved as qr.png');

    // Save QR as PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([300, 300]);
    const pngImageBytes = fs.readFileSync('qr.png');
    const pngImage = await pdfDoc.embedPng(pngImageBytes);
    page.drawImage(pngImage, { x: 0, y: 0, width: 300, height: 300 });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('qr.pdf', pdfBytes);
    console.log('✅ QR code also saved as qr.pdf');
});

// When bot is ready
client.on('ready', async () => {
    console.log('✅ WhatsApp Bot is ready!');

    const targetType = process.env.TARGET_TYPE; // "group" or "individual"
    const targetValue = process.env.TARGET_VALUE; // group name or phone number
    const message = process.env.DAILY_MESSAGE;

    let chatId = null;

    if (targetType === 'group') {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name === targetValue);
        if (!group) {
            console.error(`❌ Group "${targetValue}" not found.`);
            return;
        }
        chatId = group.id._serialized;
    } 
    else if (targetType === 'individual') {
        // Ensure phone number is in full international format, without "+" or spaces
        chatId = `${targetValue}@c.us`;
    } 
    else {
        console.error("❌ TARGET_TYPE must be either 'group' or 'individual'");
        return;
    }

    // Send immediate test message
    try {
        await client.sendMessage(chatId, `🤖 Bot connected! Test message: ${message}`);
        console.log('✅ Test message sent successfully!');
    } catch (err) {
        console.error('❌ Failed to send test message:', err);
    }

    // Schedule daily message at 9:00 AM IST
    cron.schedule('0 9 * * *', async () => {
        console.log('📤 Sending daily scheduled message...');
        try {
            await client.sendMessage(chatId, message);
            console.log('✅ Daily message sent successfully!');
        } catch (err) {
            console.error('❌ Failed to send daily message:', err);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });
});

// Error handler
client.on('error', (err) => {
    console.error('❌ Client error:', err);
});

client.initialize();

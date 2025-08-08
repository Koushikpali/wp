require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const cron = require('node-cron');
const open = require('open'); // npm install open

// Create WhatsApp client with persistent login
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/mnt/whatsapp-session' // Must match your Railway volume mount path
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

// Function to handle QR generation and auto-refresh
client.on('qr', (qr) => {
    console.clear();
    console.log('📸 Scan this QR code with WhatsApp Linked Devices (expires in ~60 seconds):');

    // Show ASCII QR in terminal
    qrcode.generate(qr, { small: true });

    // Save QR as PNG instantly
    QRCode.toFile('qr.png', qr, (err) => {
        if (err) {
            console.error('❌ Error saving QR:', err);
        } else {
            console.log('✅ QR code saved as qr.png — scan NOW!');
            open('qr.png'); // Auto-open so you can scan immediately
        }
    });
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

// Start the client
client.initialize();

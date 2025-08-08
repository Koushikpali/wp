require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib'); // npm install pdf-lib
const cron = require('node-cron');

let open;
if (process.env.LOCAL_DEV === 'true') {
    import('open').then(module => { open = module.default; });
}

// Create WhatsApp client with persistent login
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/mnt/whatsapp-session' // Must match Railway volume path
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

// Show QR code in terminal, save as PNG & PDF, keep regenerating until scanned
client.on('qr', async (qr) => {
    console.clear();
    console.log('📸 Scan this QR code with WhatsApp Linked Devices (expires in ~60 seconds):');
    qrcode.generate(qr, { small: true });

    // Save PNG
    QRCode.toFile('qr.png', qr, async (err) => {
        if (err) {
            console.error('❌ Error saving QR as PNG:', err);
        } else {
            console.log('✅ QR code saved as qr.png');

            // Save PDF
            try {
                const pdfDoc = await PDFDocument.create();
                const page = pdfDoc.addPage([300, 300]);
                const pngImageBytes = fs.readFileSync('qr.png');
                const pngImage = await pdfDoc.embedPng(pngImageBytes);
                const { width, height } = pngImage.scale(1);
                page.drawImage(pngImage, { x: 0, y: 0, width, height });
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync('qr.pdf', pdfBytes);
                console.log('✅ QR code also saved as qr.pdf');
            } catch (pdfErr) {
                console.error('❌ Error saving QR as PDF:', pdfErr);
            }

            // Auto-open locally
            if (process.env.LOCAL_DEV === 'true' && open) {
                open('qr.png');
            }
        }
    });
});

// Once logged in and client is ready
client.on('ready', async () => {
    console.log('✅ WhatsApp Bot is ready!');

    const groupName = process.env.WHATSAPP_GROUP_NAME;
    const message = process.env.DAILY_MESSAGE;

    const chats = await client.getChats();
    const group = chats.find(chat => chat.isGroup && chat.name === groupName);

    if (!group) {
        console.error(`❌ Group "${groupName}" not found.`);
        return;
    }

    const groupId = group.id._serialized;

    // Schedule daily message
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

// Error handling
client.on('error', (err) => {
    console.error('❌ Client error:', err);
});

client.initialize();

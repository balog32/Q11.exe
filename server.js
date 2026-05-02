const WebSocket = require('ws');
const { NFC } = require('nfc-pcsc');

const wss = new WebSocket.Server({ port: 8080 });
console.log('✅ WebSocket Server pe port 8080');

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('✅ Client conectat');
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
});

function broadcastCardUID(uid) {
    console.log('📡 Card:', uid);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(uid);
    });
}

const nfc = new NFC();
nfc.on('reader', reader => {
    console.log('✅ Reader:', reader.name);
    reader.on('card', card => broadcastCardUID(card.uid.toLowerCase().substring(0, 8)));
});

console.log('🔄 Astept carduri NFC...');
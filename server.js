const WebSocket = require('ws');
const { NFC } = require('nfc-pcsc');

// Server WebSocket
const wss = new WebSocket.Server({ port: 8080 });
console.log('✅ WebSocket Server pe port 8080');

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('✅ Client conectat la WebSocket');
    clients.add(ws);
    
    ws.on('close', () => {
        console.log('❌ Client deconectat');
        clients.delete(ws);
    });
});

// Trimite UID la toți clienții
function broadcastCardUID(uid) {
    console.log(`📡 Card: ${uid}`);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(uid);
        }
    });
}

// Cititor NFC
const nfc = new NFC();

nfc.on('reader', reader => {
    console.log(`✅ Reader detectat: ${reader.name}`);
    
    reader.on('card', card => {
        const uid = card.uid.toLowerCase();
        console.log(`🔖 Card detectat: ${uid}`);
        broadcastCardUID(uid);
    });
    
    reader.on('error', err => {
        console.error(`❌ Eroare reader: ${err}`);
    });
});

console.log('🔄 Așteptăm carduri NFC...');
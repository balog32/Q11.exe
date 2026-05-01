const pcsclite = require('pcsclite');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
const pcsc = pcsclite();

console.log("NFC Server pornit...");

pcsc.on('reader', reader => {
    console.log('Reader detectat:', reader.name);

    reader.on('card', card => {
        if (!card || !card.uid) return;

        const uid = card.uid.toUpperCase();

        console.log("TAG CITIT:", uid);

        // trimite UID către browser
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(uid);
            }
        });
    });

    reader.on('error', err => {
        console.error('Reader error:', err);
    });

    reader.on('end', () => {
        console.log('Reader deconectat');
    });
});

pcsc.on('error', err => {
    console.error('PCSC error:', err);
});
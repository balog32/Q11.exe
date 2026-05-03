const WebSocket = require('ws');
const { NFC } = require('nfc-pcsc');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Server HTTP pentru fișiere statice
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.css': contentType = 'text/css'; break;
        case '.js': contentType = 'text/javascript'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpg'; break;
    }
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// WebSocket pe același server
const wss = new WebSocket.Server({ server });
console.log('✅ Server pe http://localhost:8080');

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('✅ Client conectat');
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
});


function broadcastCardUID(uid) {
    console.log(`📡 Card: ${uid}`);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(uid);
    });
}


const nfc = new NFC();

nfc.on('reader', reader => {
    console.log(`✅ Reader: ${reader.name}`);
    reader.on('card', card => broadcastCardUID(card.uid.toLowerCase()));
});

server.listen(8080, () => {
    console.log('🔄 Aplicația rulează pe http://localhost:8080');
});
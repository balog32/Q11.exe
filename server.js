const pcsclite = require('pcsclite');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
const pcsc = pcsclite();

console.log("NFC Server pornit...");

pcsc.on('reader', reader => {
    console.log('Reader detectat:', reader.name);

    reader.on('status', status => {
        const changes = reader.state ^ status.state;

        if (changes & reader.SCARD_STATE_PRESENT) {
            if (status.state & reader.SCARD_STATE_PRESENT) {

                reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (err, protocol) => {
                    if (err) return;

                    const command = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]);

                    reader.transmit(command, 40, protocol, (err, data) => {
                        if (err) return;

                        const uid = data.toString('hex').toUpperCase();

                        console.log("Tag citit:", uid);

                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                               client.send(JSON.stringify({
    type: "nfc_tag",
    uid: uid
}));
                            }
                        });

                        reader.disconnect(reader.SCARD_LEAVE_CARD, () => {});
                    });
                });
            }
        }
    });
});
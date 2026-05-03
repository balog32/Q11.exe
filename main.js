const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: false
        }
    });

    mainWindow.loadURL('http://localhost:8080');
}

app.whenReady().then(() => {

    // 🔥 PORNEȘTE server.js automat
    serverProcess = spawn('node', ['server.js'], {
        shell: true
    });

    serverProcess.stdout.on('data', data => {
        console.log(`SERVER: ${data}`);
    });

    serverProcess.stderr.on('data', data => {
        console.error(`EROARE SERVER: ${data}`);
    });

    // mic delay să pornească serverul
    setTimeout(createWindow, 2000);
});

// când închizi aplicația → oprește serverul
app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    app.quit();
});
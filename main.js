const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 18080;

function requestServer(endpoint, method = 'GET') {
    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: SERVER_HOST,
                port: SERVER_PORT,
                path: endpoint,
                method
            },
            response => {
                let body = '';

                response.setEncoding('utf8');
                response.on('data', chunk => {
                    body += chunk;
                });

                response.on('end', () => {
                    let parsedBody = body;

                    try {
                        parsedBody = body ? JSON.parse(body) : null;
                    }
                    catch {
                        // Server errors may be plain text.
                    }

                    resolve({
                        ok: response.statusCode >= 200 && response.statusCode < 300,
                        status: response.statusCode,
                        statusText: response.statusMessage,
                        body: parsedBody
                    });
                });
            }
        );

        request.on('error', reject);
        request.end();
    });
}

ipcMain.handle('server-request', async (_event, { endpoint, method }) => {
    return await requestServer(endpoint, method);
});

function createWindow() {
    const window = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    window.loadFile(
        path.join(__dirname, 'renderer', 'index.html')
    );
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

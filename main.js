const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 18080;

function requestServer(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const requestBody = body === null || body === undefined
            ? null
            : JSON.stringify(body);

        const options = {
            hostname: SERVER_HOST,
            port: SERVER_PORT,
            path: endpoint,
            method
        };

        if (requestBody !== null) {
            options.headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            };
        }

        const request = http.request(
            options,
            response => {
                let responseBody = '';

                response.setEncoding('utf8');
                response.on('data', chunk => {
                    responseBody += chunk;
                });

                response.on('end', () => {
                    let parsedBody = responseBody;

                    try {
                        parsedBody = responseBody
                            ? JSON.parse(responseBody)
                            : null;
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

        if (requestBody !== null) {
            request.write(requestBody);
        }

        request.end();
    });
}

ipcMain.handle(
    'server-request',
    async (_event, { endpoint, method, body }) => {
        return await requestServer(endpoint, method, body);
    }
);

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

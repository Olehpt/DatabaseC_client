const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 18080;

function requestServer(endpoint, method = 'GET', body = null, binaryResponse = false) {
    return new Promise((resolve, reject) => {
        const requestBody = body === null || body === undefined
            ? null
            : Buffer.isBuffer(body) ? body : JSON.stringify(body);

        const options = {
            hostname: SERVER_HOST,
            port: SERVER_PORT,
            path: endpoint,
            method
        };

        if (requestBody !== null) {
            options.headers = {
                'Content-Type': Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            };
        }

        const request = http.request(
            options,
            response => {
                const chunks = [];
                response.on('error', reject);
                response.on('data', chunk => {
                    chunks.push(chunk);
                });

                response.on('end', () => {
                    const bytes = Buffer.concat(chunks);
                    const responseBody = bytes.toString('utf8');
                    let parsedBody = binaryResponse && response.statusCode < 300 ? bytes : responseBody;

                    try {
                        if (!binaryResponse || response.statusCode >= 300) parsedBody = responseBody
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
        request.setTimeout(30000, () => request.destroy(new Error('Server request timed out')));

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

function fileError(error) { return { ok: false, message: error.message }; }
function checkResult(result) {
    if (!result.ok) throw new Error(`${result.status}: ${result.body?.message || result.body || result.statusText}`);
}
ipcMain.handle('database-export', async (event, name) => {
    try {
        const target = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
            title: 'Export database', buttonLabel: 'Save', defaultPath: `${name}.bin`, filters: [{ name: 'DatabaseC', extensions: ['bin'] }]
        });
        if (target.canceled) return { canceled: true };
        const result = await requestServer(`/databases/${encodeURIComponent(name)}/export`, 'GET', null, true);
        checkResult(result);
        await fs.writeFile(target.filePath, result.body);
        return { ok: true };
    } catch (error) { return fileError(error); }
});
ipcMain.handle('database-import', async (event, name, replace = false) => {
    try {
        const source = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
            title: 'Import database', buttonLabel: 'Open', properties: ['openFile'], filters: [{ name: 'DatabaseC', extensions: ['bin'] }]
        });
        if (source.canceled) return { canceled: true };
        const filePath = source.filePaths[0];
        if ((await fs.stat(filePath)).size > 64 * 1024 * 1024) throw new Error('The database exceeds 64 MiB.');
        const result = await requestServer(`/databases/${encodeURIComponent(name)}/import`, replace ? 'PUT' : 'POST', await fs.readFile(filePath));
        checkResult(result);
        return { ok: true };
    } catch (error) { return fileError(error); }
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

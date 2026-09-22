const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('databaseClient', {
    request: (endpoint, method = 'GET') =>
        ipcRenderer.invoke('server-request', { endpoint, method })
});

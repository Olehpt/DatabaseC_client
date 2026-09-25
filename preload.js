const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('databaseClient', {
    request: (endpoint, method = 'GET', body = null) =>
        ipcRenderer.invoke(
            'server-request',
            { endpoint, method, body }
        )
});

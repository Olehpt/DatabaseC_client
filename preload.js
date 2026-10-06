const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('databaseClient', {
    exportDatabase: name => ipcRenderer.invoke('database-export', name),
    importDatabase: (name, replace = false) => ipcRenderer.invoke('database-import', name, replace),
    request: (endpoint, method = 'GET', body = null) =>
        ipcRenderer.invoke(
            'server-request',
            { endpoint, method, body }
        )
});

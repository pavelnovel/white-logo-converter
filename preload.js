const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  convertImages: (filePaths) => ipcRenderer.invoke('convert-images', filePaths)
});

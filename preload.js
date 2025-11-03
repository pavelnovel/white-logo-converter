const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  convertImages: (filePaths, settings) => ipcRenderer.invoke('convert-images', filePaths, settings)
});

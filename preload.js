const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  convertImages: (filePaths, settings) => ipcRenderer.invoke('convert-images', filePaths, settings),
  startDrag: (filePath) => ipcRenderer.send('start-drag', filePath)
});

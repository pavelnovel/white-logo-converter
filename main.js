const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle image conversion
ipcMain.handle('convert-images', async (event, filePaths) => {
  const outputDir = path.join(__dirname, 'output');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];

  for (const filePath of filePaths) {
    try {
      const fileName = path.basename(filePath);

      // Convert all files to PNG format
      const baseName = path.basename(fileName, path.extname(fileName));
      const outputFileName = `${baseName}.png`;
      const outputPath = path.join(outputDir, outputFileName);

      // Robust ImageMagick command for macOS/Linux
      const command = `magick \\( "${filePath}" -fill white -draw "color 0,0 reset" \\) \\( "${filePath}" -alpha extract \\) -compose Copy_Alpha -composite -define png:color-type=6 -strip "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      results.push({ success: true, file: fileName, output: outputPath });
    } catch (error) {
      results.push({ success: false, file: path.basename(filePath), error: error.message });
    }
  }

  return results;
});

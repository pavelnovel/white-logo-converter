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
ipcMain.handle('convert-images', async (event, filePaths, settings = {}) => {
  const outputDir = path.join(__dirname, 'output');
  const tempDir = path.join(__dirname, 'temp');

  // Ensure output and temp directories exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fuzz = settings.fuzz || 8;
  const threshold = settings.threshold || 80;

  const results = [];

  for (const filePath of filePaths) {
    const tempFiles = [];

    try {
      const fileName = path.basename(filePath);
      const baseName = path.basename(fileName, path.extname(fileName));
      const outputFileName = `${baseName}.png`;
      const outputPath = path.join(outputDir, outputFileName);

      // Temp file paths
      const temp1 = path.join(tempDir, `${baseName}_temp1.png`);
      const temp2 = path.join(tempDir, `${baseName}_temp2.png`);
      tempFiles.push(temp1, temp2);

      // Step 1: Remove white everywhere (including inside letters)
      const cmd1 = `magick "${filePath}" -alpha set -fuzz ${fuzz}% -fill none -opaque white "${temp1}"`;

      await new Promise((resolve, reject) => {
        exec(cmd1, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Step 2: Harden the mask for crisp edges
      const cmd2 = `magick "${temp1}" \\( +clone -alpha extract -threshold ${threshold}% \\) -compose Copy_Opacity -composite "${temp2}"`;

      await new Promise((resolve, reject) => {
        exec(cmd2, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Step 3: Force visible pixels to pure white, keep transparency
      const cmd3 = `magick \\( "${temp2}" -fill white -draw "color 0,0 reset" \\) \\( "${temp2}" -alpha extract \\) -compose Copy_Alpha -composite -define png:color-type=6 -strip "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(cmd3, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Clean up temp files
      tempFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      results.push({ success: true, file: fileName, output: outputPath });
    } catch (error) {
      // Clean up temp files on error
      tempFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      results.push({ success: false, file: path.basename(filePath), error: error.message });
    }
  }

  return results;
});

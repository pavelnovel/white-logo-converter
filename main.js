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

// Get writable directories (works both in dev and packaged app)
function getOutputDir() {
  // Always use the project's output folder
  return '/Users/pk/Desktop/nb/cs/white-logo-converter/output';
}

function getTempDir() {
  if (app.isPackaged) {
    // When packaged, use system temp
    return path.join(app.getPath('temp'), 'white-logo-converter');
  }
  return path.join(__dirname, 'temp');
}

// Get exec options with proper PATH for ImageMagick
// Fixes: "magick: command not found" in packaged app
function getExecOptions() {
  const homebrewPaths = process.arch === 'arm64'
    ? '/opt/homebrew/bin:/opt/homebrew/sbin'  // Apple Silicon
    : '/usr/local/bin:/usr/local/sbin';        // Intel Mac

  const currentPath = process.env.PATH || '';
  const fixedPath = `${homebrewPaths}:${currentPath}`;

  return {
    env: { ...process.env, PATH: fixedPath }
  };
}

// Handle image conversion
ipcMain.handle('convert-images', async (event, filePaths, settings = {}) => {
  const outputDir = getOutputDir();
  const tempDir = getTempDir();

  // Ensure output and temp directories exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const fuzz = settings.fuzz || 8;
  const threshold = settings.threshold || 80;
  const preserveColors = settings.preserveColors || false;

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

      const execOptions = getExecOptions();

      await new Promise((resolve, reject) => {
        exec(cmd1, execOptions, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Step 2: Harden the mask for crisp edges
      const cmd2 = `magick "${temp1}" \\( +clone -alpha extract -threshold ${threshold}% \\) -compose Copy_Opacity -composite "${temp2}"`;

      await new Promise((resolve, reject) => {
        exec(cmd2, execOptions, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Step 3: Convert to white (selectively or fully)
      let cmd3;

      if (preserveColors) {
        // Preserve colors: only convert grayscale/black to white
        // Create saturation mask, composite white over grayscale areas only
        cmd3 = `magick "${temp2}" \\( +clone -colorspace HSL -channel S -separate +channel -threshold 15% -negate \\) \\( -clone 0 -fill white -colorize 100 \\) -delete 0 -alpha off -compose Over -composite \\( "${temp2}" -alpha extract \\) -compose Copy_Alpha -composite -define png:color-type=6 -strip "${outputPath}"`;
      } else {
        // Convert all to white - preserves anti-aliasing by directly setting RGB to white
        // while leaving the alpha channel completely untouched
        cmd3 = `magick "${temp2}" -channel RGB -evaluate set 100% +channel -define png:color-type=6 "${outputPath}"`;
      }

      await new Promise((resolve, reject) => {
        exec(cmd3, execOptions, (error) => {
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

      // Read output as base64 for preview
      const previewBuffer = fs.readFileSync(outputPath);
      const previewBase64 = `data:image/png;base64,${previewBuffer.toString('base64')}`;

      results.push({ success: true, file: fileName, output: outputPath, preview: previewBase64 });
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

// Handle native file drag from preview
ipcMain.on('start-drag', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: path.join(__dirname, 'input', 'test-logo.png') // Optional: use a generic icon or the file itself
  });
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const { prepareInputForMagick } = require('./image-prep');

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
  return path.join(__dirname, 'output');
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

function convertSvgToWhite(filePath, outputDir) {
  const fileName = path.basename(filePath);
  const outputPath = path.join(outputDir, fileName);

  try {
    let svg = fs.readFileSync(filePath, 'utf8');

    // Replace fill colors with white (skip none/transparent)
    svg = svg.replace(
      /fill\s*=\s*"(?!none|transparent)([^"]*)"/gi,
      'fill="white"'
    );
    svg = svg.replace(
      /fill\s*:\s*(?!none|transparent)[^;}"']+/gi,
      'fill: white'
    );

    // Replace stroke colors with white (skip none/transparent)
    svg = svg.replace(
      /stroke\s*=\s*"(?!none|transparent)([^"]*)"/gi,
      'stroke="white"'
    );
    svg = svg.replace(
      /stroke\s*:\s*(?!none|transparent)[^;}"']+/gi,
      'stroke: white'
    );

    fs.writeFileSync(outputPath, svg, 'utf8');

    const previewBase64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    return {
      success: true,
      file: fileName,
      output: outputPath,
      preview: previewBase64
    };
  } catch (error) {
    return {
      success: false,
      file: fileName,
      error: error.message
    };
  }
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
  const maxSize = settings.maxSize ?? 1000;

  const results = [];
  const execOptions = getExecOptions();

  for (const filePath of filePaths) {
    const tempFiles = [];

    try {
      const fileName = path.basename(filePath);
      const baseName = path.basename(fileName, path.extname(fileName));
      const ext = path.extname(fileName).toLowerCase();

      if (ext === '.svg') {
        const result = convertSvgToWhite(filePath, outputDir);
        results.push(result);
        continue;
      }

      const outputFileName = `${baseName}.png`;
      const outputPath = path.join(outputDir, outputFileName);

      // Temp file paths
      const temp1 = path.join(tempDir, `${baseName}_temp1.png`);
      const temp2 = path.join(tempDir, `${baseName}_temp2.png`);
      tempFiles.push(temp1, temp2);

      const { preparedPath, cleanupFiles } = await prepareInputForMagick(filePath, tempDir, execOptions);
      tempFiles.push(...cleanupFiles);

      // Step 1: Remove white everywhere (including inside letters)
      const cmd1 = `magick "${preparedPath}" -alpha set -fuzz ${fuzz}% -fill none -opaque white "${temp1}"`;

      await new Promise((resolve, reject) => {
        exec(cmd1, execOptions, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Step 2: Harden the mask for crisp edges while preserving anti-aliasing
      const cmd2 = `magick "${temp1}" \\( +clone -alpha extract -level 0%,${threshold}% \\) -compose Copy_Opacity -composite "${temp2}"`;

      await new Promise((resolve, reject) => {
        exec(cmd2, execOptions, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Step 3: Convert to white (selectively or fully)
      // The trailing ">" only shrinks images larger than maxSize, never upscales.
      // Resizing last means the white conversion runs at full resolution (supersampling).
      const resizeArg = maxSize > 0 ? `-resize "${maxSize}x${maxSize}>" ` : '';
      let cmd3;

      if (preserveColors) {
        // Preserve colors: composite white only over grayscale/black areas,
        // keeping saturated (colored) pixels as-is. Base = original color,
        // overlay = all-white, mask = white where saturation < 15%.
        cmd3 = `magick "${temp2}" \\( +clone -fill white -colorize 100 \\) \\( "${temp2}" -alpha off -colorspace HSL -channel S -separate +channel -threshold 15% -negate \\) -compose over -composite \\( "${temp2}" -alpha extract \\) -compose Copy_Alpha -composite ${resizeArg}-define png:color-type=6 -strip "${outputPath}"`;
      } else {
        // Convert all to white - preserves anti-aliasing by directly setting RGB to white
        // while leaving the alpha channel completely untouched
        cmd3 = `magick "${temp2}" -channel RGB -evaluate set 100% +channel ${resizeArg}-define png:color-type=6 "${outputPath}"`;
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

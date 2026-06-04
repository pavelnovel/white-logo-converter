const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

let sharpInstance = null;
const magickSupportCache = new Map();

function getCacheKey(execOptions) {
  if (!execOptions || !execOptions.env || !execOptions.env.PATH) {
    return 'default';
  }
  return execOptions.env.PATH;
}

async function ensureTempDir(tempDir) {
  await fs.promises.mkdir(tempDir, { recursive: true });
}

async function ensureSharp() {
  if (!sharpInstance) {
    try {
      // Lazy-load sharp since it's only needed for AVIF decoding fallback
      sharpInstance = require('sharp');
    } catch (error) {
      throw new Error('AVIF support requires the "sharp" package. Please run `npm install` again.');
    }
  }
  return sharpInstance;
}

async function magickSupportsAvif(execOptions) {
  const cacheKey = getCacheKey(execOptions);
  if (magickSupportCache.has(cacheKey)) {
    return magickSupportCache.get(cacheKey);
  }

  const detectionPromise = execAsync('magick -list format', execOptions)
    .then(({ stdout }) => {
      const supports = stdout.split(/\r?\n/).some(line => {
        const match = line.match(/^\s*AVIF\*?\s+\S+\s+([rw\+\-]+)/i);
        if (!match) {
          return false;
        }
        return /r/i.test(match[1]);
      });
      return supports;
    })
    .catch(() => false);

  magickSupportCache.set(cacheKey, detectionPromise);
  return detectionPromise;
}

/**
 * Ensures the provided image can be read by ImageMagick. For AVIF inputs we keep the original file
 * when ImageMagick already supports AVIF. Otherwise we decode them into PNGs using Sharp so that the
 * downstream ImageMagick steps continue to work without requiring AVIF delegates.
 */
async function prepareInputForMagick(inputPath, tempDir, execOptions) {
  const ext = path.extname(inputPath).toLowerCase();

  if (ext !== '.avif') {
    return { preparedPath: inputPath, cleanupFiles: [] };
  }

  const hasNativeSupport = await magickSupportsAvif(execOptions);
  if (hasNativeSupport) {
    return { preparedPath: inputPath, cleanupFiles: [] };
  }

  await ensureTempDir(tempDir);

  const sharp = await ensureSharp();
  const baseName = path.basename(inputPath, ext);
  const tempAvifPath = path.join(tempDir, `${baseName}_avif.png`);

  try {
    await sharp(inputPath).png().toFile(tempAvifPath);
  } catch (error) {
    throw new Error(`Failed to decode AVIF file "${path.basename(inputPath)}": ${error.message}`);
  }

  return { preparedPath: tempAvifPath, cleanupFiles: [tempAvifPath] };
}

/**
 * Reads an image's pixel dimensions using Sharp. Dimensions are informational
 * (shown in the UI/CLI output), so any read failure resolves to null rather
 * than throwing — a missing size readout must never fail a conversion.
 */
async function getImageDimensions(filePath) {
  try {
    const sharp = await ensureSharp();
    const { width, height } = await sharp(filePath).metadata();
    if (width && height) {
      return { width, height };
    }
  } catch (error) {
    return null;
  }
  return null;
}

module.exports = {
  prepareInputForMagick,
  getImageDimensions
};

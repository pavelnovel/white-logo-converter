#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { prepareInputForMagick } = require('./image-prep');

const execAsync = promisify(exec);

const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');
const tempDir = path.join(__dirname, 'temp');

async function convertImage(inputPath, outputPath, fuzz = 8, threshold = 80, preserveColors = false) {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const temp1 = path.join(tempDir, `${baseName}_temp1.png`);
  const temp2 = path.join(tempDir, `${baseName}_temp2.png`);

  const auxFiles = [];

  try {
    const { preparedPath, cleanupFiles } = await prepareInputForMagick(inputPath, tempDir);
    auxFiles.push(...cleanupFiles);

    // Step 1: Remove white everywhere (including inside letters)
    const cmd1 = `magick "${preparedPath}" -alpha set -fuzz ${fuzz}% -fill none -opaque white "${temp1}"`;
    await execAsync(cmd1);

    // Step 2: Harden the mask for crisp edges while preserving anti-aliasing
    const cmd2 = `magick "${temp1}" \\( +clone -alpha extract -level 0%,${threshold}% \\) -compose Copy_Opacity -composite "${temp2}"`;
    await execAsync(cmd2);

    // Step 3: Convert to white (selectively or fully)
    let cmd3;

    if (preserveColors) {
      // Preserve colors: only convert grayscale/black to white
      cmd3 = `magick "${temp2}" \\( +clone -colorspace HSL -channel S -separate +channel -threshold 15% -negate \\) \\( -clone 0 -fill white -colorize 100 \\) -delete 0 -alpha off -compose Over -composite \\( "${temp2}" -alpha extract \\) -compose Copy_Alpha -composite -define png:color-type=6 -strip "${outputPath}"`;
    } else {
      // Convert all to white - preserves anti-aliasing by directly setting RGB to white
      // while leaving the alpha channel completely untouched
      cmd3 = `magick "${temp2}" -channel RGB -evaluate set 100% +channel -define png:color-type=6 "${outputPath}"`;
    }

    await execAsync(cmd3);

    // Clean up temp files
    if (fs.existsSync(temp1)) fs.unlinkSync(temp1);
    if (fs.existsSync(temp2)) fs.unlinkSync(temp2);
    auxFiles.forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    return { success: true };
  } catch (error) {
    // Clean up temp files on error
    if (fs.existsSync(temp1)) fs.unlinkSync(temp1);
    if (fs.existsSync(temp2)) fs.unlinkSync(temp2);
    auxFiles.forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    return { success: false, error: error.message };
  }
}

function convertSvgToWhite(filePath, outputDir) {
  const fileName = path.basename(filePath);
  const outputPath = path.join(outputDir, fileName);

  try {
    let svg = fs.readFileSync(filePath, 'utf8');

    svg = svg.replace(
      /fill\s*=\s*"(?!none|transparent)([^"]*)"/gi,
      'fill="white"'
    );
    svg = svg.replace(
      /fill\s*:\s*(?!none|transparent)[^;}"']+/gi,
      'fill: white'
    );
    svg = svg.replace(
      /stroke\s*=\s*"(?!none|transparent)([^"]*)"/gi,
      'stroke="white"'
    );
    svg = svg.replace(
      /stroke\s*:\s*(?!none|transparent)[^;}"']+/gi,
      'stroke: white'
    );

    fs.writeFileSync(outputPath, svg, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('White Logo Converter CLI\n');

  // Parse command-line arguments
  const args = process.argv.slice(2);
  let fuzz = 8;
  let threshold = 80;
  let preserveColors = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fuzz' && args[i + 1]) {
      fuzz = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--threshold' && args[i + 1]) {
      threshold = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--preserve-colors') {
      preserveColors = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: npm run convert [options]\n');
      console.log('Options:');
      console.log('  --fuzz <3-15>         Fuzz percentage for white removal (default: 8)');
      console.log('  --threshold <70-90>   Threshold percentage for edge hardening (default: 80)');
      console.log('  --preserve-colors     Only convert black/dark to white, keep colors (default: false)');
      console.log('  --help, -h            Show this help message\n');
      console.log('Examples:');
      console.log('  npm run convert');
      console.log('  npm run convert -- --fuzz 10 --threshold 85');
      console.log('  npm run convert -- --preserve-colors');
      process.exit(0);
    }
  }

  const colorMode = preserveColors ? ', Preserve Colors: Yes' : '';
  console.log(`Settings: Fuzz=${fuzz}%, Threshold=${threshold}%${colorMode}\n`);

  // Ensure input, output, and temp directories exist
  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory not found: ${inputDir}`);
    console.log('Please create an "input" folder and add image files to convert.');
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('Created output directory.');
  }

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Get all image files from input directory
  const files = fs.readdirSync(inputDir).filter(file => {
    const lower = file.toLowerCase();
    return lower.endsWith('.png') || lower.endsWith('.jpg') ||
           lower.endsWith('.jpeg') || lower.endsWith('.webp') ||
           lower.endsWith('.avif') || lower.endsWith('.svg');
  });

  if (files.length === 0) {
    console.log('No image files found in the input directory.');
    process.exit(0);
  }

  console.log(`Found ${files.length} image file(s) to convert:\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const ext = path.extname(file).toLowerCase();

    process.stdout.write(`Converting ${file}... `);

    if (ext === '.svg') {
      const result = convertSvgToWhite(inputPath, outputDir);
      if (result.success) {
        console.log('✓ Success');
        successCount++;
      } else {
        console.log(`✗ Failed: ${result.error}`);
        failCount++;
      }
      continue;
    }

    // Convert raster files to PNG format
    const baseName = path.basename(file, path.extname(file));
    const outputFileName = `${baseName}.png`;
    const outputPath = path.join(outputDir, outputFileName);

    const result = await convertImage(inputPath, outputPath, fuzz, threshold, preserveColors);

    if (result.success) {
      console.log('✓ Success');
      successCount++;
    } else {
      console.log(`✗ Failed: ${result.error}`);
      failCount++;
    }
  }

  console.log(`\nConversion complete!`);
  console.log(`Success: ${successCount} | Failed: ${failCount}`);
  console.log(`\nConverted files saved to: ${outputDir}`);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

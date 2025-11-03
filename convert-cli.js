#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');
const tempDir = path.join(__dirname, 'temp');

async function convertImage(inputPath, outputPath, fuzz = 8, threshold = 80) {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const temp1 = path.join(tempDir, `${baseName}_temp1.png`);
  const temp2 = path.join(tempDir, `${baseName}_temp2.png`);

  try {
    // Step 1: Remove white everywhere (including inside letters)
    const cmd1 = `magick "${inputPath}" -alpha set -fuzz ${fuzz}% -fill none -opaque white "${temp1}"`;
    await execAsync(cmd1);

    // Step 2: Harden the mask for crisp edges
    const cmd2 = `magick "${temp1}" \\( +clone -alpha extract -threshold ${threshold}% \\) -compose Copy_Opacity -composite "${temp2}"`;
    await execAsync(cmd2);

    // Step 3: Force visible pixels to pure white, keep transparency
    const cmd3 = `magick \\( "${temp2}" -fill white -draw "color 0,0 reset" \\) \\( "${temp2}" -alpha extract \\) -compose Copy_Alpha -composite -define png:color-type=6 -strip "${outputPath}"`;
    await execAsync(cmd3);

    // Clean up temp files
    if (fs.existsSync(temp1)) fs.unlinkSync(temp1);
    if (fs.existsSync(temp2)) fs.unlinkSync(temp2);

    return { success: true };
  } catch (error) {
    // Clean up temp files on error
    if (fs.existsSync(temp1)) fs.unlinkSync(temp1);
    if (fs.existsSync(temp2)) fs.unlinkSync(temp2);

    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('White Logo Converter CLI\n');

  // Parse command-line arguments
  const args = process.argv.slice(2);
  let fuzz = 8;
  let threshold = 80;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fuzz' && args[i + 1]) {
      fuzz = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--threshold' && args[i + 1]) {
      threshold = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: npm run convert [options]\n');
      console.log('Options:');
      console.log('  --fuzz <3-15>       Fuzz percentage for white removal (default: 8)');
      console.log('  --threshold <70-90> Threshold percentage for edge hardening (default: 80)');
      console.log('  --help, -h          Show this help message\n');
      console.log('Examples:');
      console.log('  npm run convert');
      console.log('  npm run convert -- --fuzz 10 --threshold 85');
      process.exit(0);
    }
  }

  console.log(`Settings: Fuzz=${fuzz}%, Threshold=${threshold}%\n`);

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
           lower.endsWith('.jpeg') || lower.endsWith('.webp');
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

    // Convert all files to PNG format
    const baseName = path.basename(file, path.extname(file));
    const outputFileName = `${baseName}.png`;
    const outputPath = path.join(outputDir, outputFileName);

    process.stdout.write(`Converting ${file}... `);

    const result = await convertImage(inputPath, outputPath, fuzz, threshold);

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

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

async function convertImage(inputPath, outputPath) {
  // Robust ImageMagick command for macOS/Linux
  // Converts all formats to PNG with transparency support
  const command = `magick \\( "${inputPath}" -fill white -draw "color 0,0 reset" \\) \\( "${inputPath}" -alpha extract \\) -compose Copy_Alpha -composite -define png:color-type=6 -strip "${outputPath}"`;

  try {
    await execAsync(command);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('White Logo Converter CLI\n');

  // Ensure input and output directories exist
  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory not found: ${inputDir}`);
    console.log('Please create an "input" folder and add image files to convert.');
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('Created output directory.');
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

    const result = await convertImage(inputPath, outputPath);

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

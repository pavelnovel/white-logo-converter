const { execSync, exec } = require('child_process');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');

describe('Smoke Tests', () => {
  describe('ImageMagick', () => {
    test('magick command is available', () => {
      const result = execSync('magick -version', { encoding: 'utf8' });
      expect(result).toContain('ImageMagick');
    });
  });

  describe('CLI', () => {
    test('--help flag works', () => {
      const result = execSync('node convert-cli.js --help', {
        cwd: ROOT_DIR,
        encoding: 'utf8',
      });
      expect(result).toContain('Usage:');
      expect(result).toContain('--fuzz');
      expect(result).toContain('--threshold');
      expect(result).toContain('--preserve-colors');
    });

    test('handles missing input directory gracefully', () => {
      // Temporarily rename input dir if it exists
      const fs = require('fs');
      const inputDir = path.join(ROOT_DIR, 'input');
      const tempDir = path.join(ROOT_DIR, 'input_backup_test');
      const inputExists = fs.existsSync(inputDir);

      if (inputExists) {
        fs.renameSync(inputDir, tempDir);
      }

      try {
        execSync('node convert-cli.js', {
          cwd: ROOT_DIR,
          encoding: 'utf8',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toContain('input');
      } finally {
        // Restore input dir
        if (inputExists) {
          fs.renameSync(tempDir, inputDir);
        }
      }
    });

    test('handles empty input directory', () => {
      const fs = require('fs');
      const inputDir = path.join(ROOT_DIR, 'input');
      const tempDir = path.join(ROOT_DIR, 'input_backup_test');
      const inputExists = fs.existsSync(inputDir);

      // Backup existing input dir
      if (inputExists) {
        fs.renameSync(inputDir, tempDir);
      }

      // Create empty input dir
      fs.mkdirSync(inputDir, { recursive: true });

      try {
        const result = execSync('node convert-cli.js', {
          cwd: ROOT_DIR,
          encoding: 'utf8',
        });
        expect(result).toContain('No image files found');
      } finally {
        // Restore original input dir
        fs.rmSync(inputDir, { recursive: true });
        if (inputExists) {
          fs.renameSync(tempDir, inputDir);
        } else {
          fs.mkdirSync(inputDir, { recursive: true });
        }
      }
    });
  });
});

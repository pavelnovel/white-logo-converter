# White Logo Converter

Convert logo colors to white while preserving transparency using ImageMagick. Supports PNG, JPG, and WebP formats. Includes both a desktop UI and CLI interface.

## Prerequisites

### Install ImageMagick

**macOS:**
```bash
brew install imagemagick
```

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install imagemagick
```

**Fedora:**
```bash
sudo dnf install imagemagick
```

**Arch:**
```bash
sudo pacman -S imagemagick
```

**Windows (PowerShell):**
```powershell
winget install ImageMagick.ImageMagick
```

Or with Chocolatey:
```powershell
choco install imagemagick
```

### Verify Installation

```bash
magick -version
```

If you only have `convert`, you're on ImageMagick 6. Replace `magick` with `convert` in the commands.

## Setup

1. Navigate to the project directory:
```bash
cd white-logo-converter
```

2. Install Node.js dependencies:
```bash
npm install
```

## Usage

### Desktop UI (Recommended)

1. Start the Electron app:
```bash
npm start
```

2. Drag and drop image files (PNG, JPG, WebP) into the application window, or click to select files

3. Converted files are automatically saved to the `output/` folder as PNG files

### CLI Mode

1. Place image files (PNG, JPG, WebP) in the `input/` folder

2. Run the conversion script:
```bash
npm run convert
```

3. Converted files will be saved to the `output/` folder as PNG files

## How It Works

The converter uses a robust ImageMagick command that:
- Accepts PNG, JPG/JPEG, and WebP input formats
- Converts all RGB colors to pure white
- Preserves or creates an alpha (transparency) channel
- Outputs all files as RGBA PNG format
- Strips metadata for smaller file sizes

**Note:** JPG files don't support transparency, but they will be converted to PNG with a transparent background where the white areas are.

**Command used:**
```bash
magick \( input.png -fill white -draw "color 0,0 reset" \) \
       \( input.png -alpha extract \) -compose Copy_Alpha -composite \
       -define png:color-type=6 -strip output.png
```

## Troubleshooting

### Jagged or dark edges
The robust command preserves the original alpha mask to prevent edge issues.

### "Command not found"
Open a new terminal after installing ImageMagick to refresh your PATH.

### No transparency in output
If your input image has no transparency (e.g., opaque JPG), the output will be an opaque white PNG. The converter preserves existing transparency but doesn't create it from scratch.

## Project Structure

```
white-logo-converter/
├── input/              # Place image files here for CLI mode
├── output/             # Converted PNG files are saved here
├── main.js             # Electron main process
├── preload.js          # Electron security bridge
├── index.html          # UI layout
├── renderer.js         # Frontend logic
├── styles.css          # UI styling
├── convert-cli.js      # CLI conversion script
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## License

MIT

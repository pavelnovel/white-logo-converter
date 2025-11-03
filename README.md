# White Logo Converter

Convert logo colors to white while **creating transparency from white areas** (perfect for logo letter holes) using ImageMagick. Supports PNG, JPG, and WebP formats. Includes both a desktop UI with adjustable settings and CLI interface.

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

2. Adjust settings if needed:
   - **Fuzz Percentage** (3-15%, default 8%): How much near-white to remove. Higher = more aggressive white removal
   - **Edge Threshold** (70-90%, default 80%): Edge crispness. Higher = sharper edges (may clip anti-aliasing)

3. Drag and drop image files (PNG, JPG, WebP) into the application window, or click to select files

4. Converted files are automatically saved to the `output/` folder as PNG files

### CLI Mode

1. Place image files (PNG, JPG, WebP) in the `input/` folder

2. Run the conversion script with default settings:
```bash
npm run convert
```

Or with custom settings:
```bash
npm run convert -- --fuzz 10 --threshold 85
```

Options:
- `--fuzz <3-15>`: Fuzz percentage (default: 8)
- `--threshold <70-90>`: Threshold percentage (default: 80)
- `--help`: Show help message

3. Converted files will be saved to the `output/` folder as PNG files

## How It Works

The converter uses a **3-step "key out white" approach** to create transparency from white areas (perfect for logo letter holes):

### Step 1: Remove White Areas
```bash
magick input.png -alpha set -fuzz 8% -fill none -opaque white temp1.png
```
Removes white and near-white pixels (including inside letter holes), making them transparent.

### Step 2: Harden Mask for Crisp Edges
```bash
magick temp1.png \( +clone -alpha extract -threshold 80% \) \
       -compose Copy_Opacity -composite temp2.png
```
Sharpens edges for clean, professional logo appearance.

### Step 3: Rebuild as Pure White
```bash
magick \( temp2.png -fill white -draw "color 0,0 reset" \) \
       \( temp2.png -alpha extract \) -compose Copy_Alpha -composite \
       -define png:color-type=6 -strip output.png
```
Forces all remaining visible pixels to pure white while preserving the transparency mask.

### What This Achieves
- **Creates transparency** from white areas (not just preserving existing alpha)
- Perfect for logos where letter holes need to be transparent
- Accepts PNG, JPG/JPEG, and WebP input formats
- Outputs crisp, clean RGBA PNG files
- Strips metadata for smaller file sizes

## Troubleshooting

### Jagged or dark edges
- Increase the **Edge Threshold** (try 85-90%) for sharper edges
- Decrease it (try 70-75%) if edges look too harsh

### Too much color removed
- Decrease the **Fuzz Percentage** (try 5% or lower) to be more conservative with white removal

### White areas not becoming transparent
- Increase the **Fuzz Percentage** (try 10-12%) to remove more off-white tones
- Works best for logos on white backgrounds

### "Command not found"
Open a new terminal after installing ImageMagick to refresh your PATH.

### Background not fully removed
If your logo has connected white areas, the fuzz setting may need adjustment. Try values between 8-12% for typical logos.

## Project Structure

```
white-logo-converter/
├── input/              # Place image files here for CLI mode
├── output/             # Converted PNG files are saved here
├── temp/               # Temporary files (auto-created, auto-cleaned)
├── main.js             # Electron main process (3-step conversion)
├── preload.js          # Electron security bridge
├── index.html          # UI layout with settings controls
├── renderer.js         # Frontend logic and slider handling
├── styles.css          # UI styling
├── convert-cli.js      # CLI conversion script with arguments
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## License

MIT

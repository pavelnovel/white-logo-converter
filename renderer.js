const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const results = document.getElementById('results');
const fuzzSlider = document.getElementById('fuzzSlider');
const fuzzValue = document.getElementById('fuzzValue');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');
const preserveColorsCheckbox = document.getElementById('preserveColors');
const previewSection = document.getElementById('previewSection');
const previewContainer = document.getElementById('previewContainer');

const supportedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'];
const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'];

let selectedFiles = [];

// Update slider value displays
fuzzSlider.addEventListener('input', (e) => {
  fuzzValue.textContent = `${e.target.value}%`;
});

thresholdSlider.addEventListener('input', (e) => {
  thresholdValue.textContent = `${e.target.value}%`;
});

// Click to select files
dropZone.addEventListener('click', () => {
  fileInput.click();
});

// File input change
fileInput.addEventListener('change', (e) => {
  handleFiles(Array.from(e.target.files));
});

// Drag and drop events
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files).filter(isSupportedFile);

  handleFiles(files);
});

function handleFiles(files) {
  if (files.length === 0) {
    return;
  }

  const validFiles = files.filter(isSupportedFile);

  if (validFiles.length === 0) {
    results.innerHTML = '<h3>Error:</h3><p class="error">Only PNG, JPG, WebP, AVIF, and SVG files are supported.</p>';
    results.className = 'results error';
    return;
  }

  selectedFiles = validFiles;
  displayFileList(validFiles);
  convertFiles(validFiles);
}

function displayFileList(files) {
  fileList.innerHTML = '<h3>Selected Files:</h3>';
  const ul = document.createElement('ul');

  files.forEach(file => {
    const li = document.createElement('li');
    li.textContent = file.name;
    ul.appendChild(li);
  });

  fileList.appendChild(ul);
}

async function convertFiles(files) {
  results.innerHTML = '<h3>Converting...</h3>';
  results.className = 'results processing';

  const filePaths = files.map(file => file.path);

  // Get current slider values and checkbox state
  const settings = {
    fuzz: parseFloat(fuzzSlider.value),
    threshold: parseFloat(thresholdSlider.value),
    preserveColors: preserveColorsCheckbox.checked
  };

  try {
    const conversionResults = await window.electronAPI.convertImages(filePaths, settings);
    displayResults(conversionResults, settings);
  } catch (error) {
    results.innerHTML = `<h3>Error:</h3><p class="error">${error.message}</p>`;
    results.className = 'results error';
  }
}

function displayResults(conversionResults, settings) {
  results.innerHTML = '<h3>Results:</h3>';

  const successCount = conversionResults.filter(r => r.success).length;
  const failCount = conversionResults.length - successCount;

  const summary = document.createElement('p');
  summary.className = 'summary';
  const colorMode = settings.preserveColors ? ', Preserve Colors: Yes' : '';
  summary.textContent = `Converted ${successCount} of ${conversionResults.length} files (Fuzz: ${settings.fuzz}%, Threshold: ${settings.threshold}%${colorMode})`;
  results.appendChild(summary);

  const ul = document.createElement('ul');

  conversionResults.forEach(result => {
    const li = document.createElement('li');
    li.className = result.success ? 'success' : 'error';

    if (result.success) {
      li.innerHTML = `<span class="icon">✓</span> ${result.file} → output/${result.file}`;
    } else {
      li.innerHTML = `<span class="icon">✗</span> ${result.file}: ${result.error}`;
    }

    ul.appendChild(li);
  });

  results.appendChild(ul);
  results.className = failCount > 0 ? 'results partial-success' : 'results success';

  // Display preview for successful conversions
  displayPreview(conversionResults);
}

function displayPreview(conversionResults) {
  const successfulResults = conversionResults.filter(r => r.success && r.preview);

  if (successfulResults.length === 0) {
    previewSection.style.display = 'none';
    return;
  }

  previewContainer.innerHTML = '';
  previewSection.style.display = 'block';

  successfulResults.forEach(result => {
    const item = document.createElement('div');
    item.className = 'preview-item';

    const img = document.createElement('img');
    img.src = result.preview;
    img.className = 'preview-image';
    img.alt = result.file;
    img.draggable = true;
    img.style.cursor = 'grab';

    // Enable native drag to other apps using Electron's drag API
    img.addEventListener('dragstart', (e) => {
      e.preventDefault();
      window.electronAPI.startDrag(result.output);
    });

    const filename = document.createElement('span');
    filename.className = 'preview-filename';
    filename.textContent = result.file;

    item.appendChild(img);
    item.appendChild(filename);
    previewContainer.appendChild(item);
  });
}

function isSupportedFile(file) {
  const name = (file.name || '').toLowerCase();
  const hasSupportedExtension = supportedExtensions.some(ext => name.endsWith(ext));
  const hasSupportedMime = supportedMimeTypes.includes(file.type);
  return hasSupportedExtension || hasSupportedMime;
}

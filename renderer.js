const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const results = document.getElementById('results');
const fuzzSlider = document.getElementById('fuzzSlider');
const fuzzValue = document.getElementById('fuzzValue');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');

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

  const files = Array.from(e.dataTransfer.files).filter(file => {
    const name = file.name.toLowerCase();
    return name.endsWith('.png') || name.endsWith('.jpg') ||
           name.endsWith('.jpeg') || name.endsWith('.webp');
  });

  handleFiles(files);
});

function handleFiles(files) {
  if (files.length === 0) {
    return;
  }

  selectedFiles = files;
  displayFileList(files);
  convertFiles(files);
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

  // Get current slider values
  const settings = {
    fuzz: parseFloat(fuzzSlider.value),
    threshold: parseFloat(thresholdSlider.value)
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
  summary.textContent = `Converted ${successCount} of ${conversionResults.length} files (Fuzz: ${settings.fuzz}%, Threshold: ${settings.threshold}%)`;
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
}

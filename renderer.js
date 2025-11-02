const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const results = document.getElementById('results');

let selectedFiles = [];

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

  try {
    const conversionResults = await window.electronAPI.convertImages(filePaths);
    displayResults(conversionResults);
  } catch (error) {
    results.innerHTML = `<h3>Error:</h3><p class="error">${error.message}</p>`;
    results.className = 'results error';
  }
}

function displayResults(conversionResults) {
  results.innerHTML = '<h3>Results:</h3>';

  const successCount = conversionResults.filter(r => r.success).length;
  const failCount = conversionResults.length - successCount;

  const summary = document.createElement('p');
  summary.className = 'summary';
  summary.textContent = `Converted ${successCount} of ${conversionResults.length} files`;
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

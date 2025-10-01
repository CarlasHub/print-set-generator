document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.querySelector('.drop-zone');
    const fileInput = document.querySelector('.drop-zone__input');
    const promptEl = document.querySelector('.drop-zone__prompt');
    const previewEl = document.querySelector('.drop-zone__preview');
    const filenameEl = document.querySelector('.drop-zone__filename');
    const removeBtn = document.querySelector('.drop-zone__remove-btn');
  
    if (!dropZone) return;
  
    // Clicking the drop zone opens the file browser
    dropZone.addEventListener('click', (e) => {
      // Prevent click on remove button from triggering file browser
      if (e.target !== removeBtn) {
        fileInput.click();
      }
    });
  
    // Handle file selection (either by click or drop)
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        updatePreview(fileInput.files[0]);
      }
    });
  
    // Drag and Drop Events
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-zone--active');
    });
  
    ['dragleave', 'dragend'].forEach(type => {
      dropZone.addEventListener(type, () => {
        dropZone.classList.remove('drop-zone--active');
      });
    });
  
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-zone--active');
      
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        fileInput.files = droppedFiles; // Assign dropped file to the input
        updatePreview(droppedFiles[0]);
      }
    });
  
    // Remove File Button
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.value = ''; // Clear the file input
      showPrompt();
    });
  
    function updatePreview(file) {
      promptEl.style.display = 'none';
      previewEl.style.display = 'flex';
      filenameEl.textContent = file.name;
    }
  
    function showPrompt() {
      promptEl.style.display = 'flex';
      previewEl.style.display = 'none';
    }
  });
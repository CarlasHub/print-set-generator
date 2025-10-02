// upload.js — client-side generator (GitHub Pages safe)
// Requires in index.html (before this file):
//   <script src="jszip.min.js"></script>
//   <script src="jspdf.umd.min.js"></script>

document.addEventListener('DOMContentLoaded', () => {
  // ------- Elements (match your HTML) -------
  const dropZone   = document.querySelector('.drop-zone');
  const fileInput  = document.querySelector('.drop-zone__input');
  const promptEl   = document.querySelector('.drop-zone__prompt');
  const previewEl  = document.querySelector('.drop-zone__preview');
  const filenameEl = document.querySelector('.drop-zone__filename');
  const removeBtn  = document.querySelector('.drop-zone__remove-btn');

  const baseInput  = document.getElementById('basename-input');
  const dpiInput   = document.getElementById('dpi-input');
  const addMargins = document.getElementById('addMargins');

  const generateBtn = document.getElementById('generateBtn');
  const downloadLink = document.getElementById('downloadLink');
  const live = document.getElementById('liveRegion');

  if (!dropZone) return;

  // ------- Dropzone UX -------
  dropZone.addEventListener('click', (e) => {
    if (e.target !== removeBtn) fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) updatePreview(fileInput.files[0]);
    updateGenerateState();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--active');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => dropZone.classList.remove('drop-zone--active'));
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--active');
    const dropped = e.dataTransfer.files;
    if (dropped.length > 0) {
      fileInput.files = dropped;
      updatePreview(dropped[0]);
      updateGenerateState();
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.value = '';
    showPrompt();
    updateGenerateState();
  });

  baseInput?.addEventListener('input', updateGenerateState);

  function updatePreview(file) {
    promptEl.style.display = 'none';
    previewEl.style.display = 'flex';
    filenameEl.textContent = `${file.name} — ${(file.size/1024/1024).toFixed(2)} MB`;
    if (live) live.textContent = `Selected ${file.name}`;
  }
  function showPrompt() {
    promptEl.style.display = 'flex';
    previewEl.style.display = 'none';
  }
  function updateGenerateState() {
    const ok = fileInput.files && fileInput.files[0] && (baseInput.value || '').trim();
    generateBtn.disabled = !ok;
  }

  // ------- Print helpers -------
  const A_MM = { A1:{w:594,h:841}, A2:{w:420,h:594}, A3:{w:297,h:420}, A4:{w:210,h:297} };
  const ORDER = ['A4','A3','A2','A1']; // small -> large keeps memory saner
  const mmToPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);
  const safeBase = s => (s || 'Print').trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_\-]/g,'');

  function blobToImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  function drawContain(canvas, img) {
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.min(canvas.width / iw, canvas.height / ih);
    const w = Math.round(iw * scale), h = Math.round(ih * scale);
    const x = Math.floor((canvas.width - w) / 2), y = Math.floor((canvas.height - h) / 2);
    ctx.drawImage(img, 0, 0, iw, ih, x, y, w, h);
  }

  function canvasToJpegBlob(canvas, q=0.95) {
    return new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
  }

  async function canvasToPdfBlob(canvas, widthMM, heightMM) {
    // Access jsPDF from UMD bundle
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error('jsPDF not loaded. Check <script src="jspdf.umd.min.js">');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [widthMM, heightMM] });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, widthMM, heightMM, undefined, 'FAST');
    return pdf.output('blob');
  }

  function buildReadme(base, dpi) {
    const pxLine = k => `${mmToPx(A_MM[k].w, dpi)} × ${mmToPx(A_MM[k].h, dpi)} px`;
    return `# ${base} – Print_Set (A1–A4, JPG + PDF)

DPI: ${dpi} ppi
Fit: contain (no crop; proportional; white margins if needed)

Pixel dimensions at ${dpi} ppi:
- A4 = ${pxLine('A4')} (210×297 mm)
- A3 = ${pxLine('A3')} (297×420 mm)
- A2 = ${pxLine('A2')} (420×594 mm)
- A1 = ${pxLine('A1')} (594×841 mm)

PDF pages are true A-series in millimetres. PDFs don’t have DPI; the embedded image quality matches the JPG.

Filenames: <Size>_${base}_Print.(jpg|pdf)
Example: A4_${base}_Print.jpg`;
  }

  // ------- Generate ZIP -------
  generateBtn.addEventListener('click', async () => {
    try {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return alert('Please select an image.');

      const base = safeBase(baseInput.value || 'Print');
      const dpi = Math.max(72, Math.min(600, parseInt(dpiInput.value || '300', 10)));
      const margins = !!addMargins.checked;

      generateBtn.disabled = true;
      downloadLink.style.display = 'none';
      if (live) live.textContent = 'Generating…';

      const img = await blobToImage(file);

      // ZIP root
      if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded. Check <script src="jszip.min.js">');
      const zip = new JSZip();
      const root = zip.folder('Print_Set');
      root.file('README.txt', buildReadme(base, dpi));

      const aFolder = root.folder('Ready_to_Print_A-Sizes');
      const marginFolder = margins ? root.folder('Ready_to_Print_A-Sizes_With_1in_Margins') : null;

      // Process sizes
      for (const key of ORDER) {
        const { w: mmW, h: mmH } = A_MM[key];
        const pxW = mmToPx(mmW, dpi);
        const pxH = mmToPx(mmH, dpi);

        // Base canvas @ exact pixel size
        const canvas = document.createElement('canvas');
        canvas.width = pxW; canvas.height = pxH;
        drawContain(canvas, img);

        // JPG
        const jpgBlob = await canvasToJpegBlob(canvas, 0.95);
        aFolder.file(`${key}_${base}_Print.jpg`, await jpgBlob.arrayBuffer());

        // PDF
        const pdfBlob = await canvasToPdfBlob(canvas, mmW, mmH);
        aFolder.file(`${key}_${base}_Print.pdf`, await pdfBlob.arrayBuffer());

        // Optional 1-inch margin set
        if (margins && marginFolder) {
          const marginPx = Math.round(dpi); // ~1 inch per side at <dpi>
          const innerW = Math.max(1, pxW - marginPx * 2);
          const innerH = Math.max(1, pxH - marginPx * 2);

          const mCanvas = document.createElement('canvas');
          mCanvas.width = pxW; mCanvas.height = pxH;

          const ctx = mCanvas.getContext('2d', { alpha: false });
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, pxW, pxH);

          const inner = document.createElement('canvas');
          inner.width = innerW; inner.height = innerH;
          drawContain(inner, img);
          ctx.drawImage(inner, marginPx, marginPx);

          const mJpg = await canvasToJpegBlob(mCanvas, 0.95);
          marginFolder.file(`${key}_${base}_Print_Margined.jpg`, await mJpg.arrayBuffer());

          const mPdf = await canvasToPdfBlob(mCanvas, mmW, mmH);
          marginFolder.file(`${key}_${base}_Print_Margined.pdf`, await mPdf.arrayBuffer());
        }

        // Free memory from very large canvases between iterations
        canvas.width = canvas.height = 0;
      }

      if (live) live.textContent = 'Zipping files…';
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(zipBlob);
      downloadLink.href = url;
      downloadLink.download = `${base}_Print_Set.zip`;
      downloadLink.style.display = 'inline-block';

      if (live) live.textContent = 'Ready! Click “Download ZIP”.';
    } catch (err) {
      console.error(err);
      alert('Sorry, something went wrong. Please check your internet and try again.');
      if (live) live.textContent = 'Error';
    } finally {
      generateBtn.disabled = false;
    }
  });
});

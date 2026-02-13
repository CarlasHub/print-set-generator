document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.querySelector(".drop-zone");
  const fileInput = document.querySelector(".drop-zone__input");
  const promptEl = document.querySelector(".drop-zone__prompt");
  const previewEl = document.querySelector(".drop-zone__preview");
  const filenameEl = document.querySelector(".drop-zone__filename");
  const fileMeta = document.getElementById("fileMeta");
  const removeBtn = document.querySelector(".drop-zone__remove-btn");
  const baseInput = document.getElementById("basename-input");
  const dpiInput = document.getElementById("dpi-input");
  const qualityInput = document.getElementById("quality-input");
  const qualityLabel = document.getElementById("qualityLabel");
  const fitMode = document.getElementById("fit-mode");
  const orientationMode = document.getElementById("orientation-mode");
  const bgColor = document.getElementById("bg-color");
  const toggleJpg = document.getElementById("toggle-jpg");
  const togglePdf = document.getElementById("toggle-pdf");
  const toggleMargins = document.getElementById("toggle-margins");
  const marginSize = document.getElementById("margin-size");
  const toggleRatios = document.getElementById("toggle-ratios");
  const toggleInches = document.getElementById("toggle-inches");
  const toggleMm = document.getElementById("toggle-mm");
  const toggleSquare = document.getElementById("toggle-square");
  const aSizeChecks = Array.from(document.querySelectorAll(".chips input[type='checkbox']"));
  const generateBtn = document.getElementById("generateBtn");
  const downloadLink = document.getElementById("downloadLink");
  const live = document.getElementById("liveRegion");
  const progressBar = document.getElementById("progressBar");
  const statusText = document.getElementById("statusText");
  const estimates = document.getElementById("estimates");
  const summaryList = document.getElementById("summaryList");
  const previewImage = document.getElementById("previewImage");
  const seedDemo = document.getElementById("seed-demo");
  const resetAll = document.getElementById("reset-all");
  let currentZipUrl = null;

  if (!dropZone) return;

  const A_MM = { A1: { w: 594, h: 841 }, A2: { w: 420, h: 594 }, A3: { w: 297, h: 420 }, A4: { w: 210, h: 297 }, A5: { w: 148, h: 210 } };
  const ORDER = ["A5", "A4", "A3", "A2", "A1"];
  const AR_SPECS = {
    "2x3": { sizesIn: [[4, 6], [8, 12], [12, 18], [16, 24], [20, 30], [24, 36]] },
    "3x4": { sizesIn: [[6, 8], [9, 12], [12, 16], [18, 24]] },
    "4x5": { sizesIn: [[4, 5], [8, 10], [12, 15], [16, 20], [20, 25], [24, 30]] },
    ISO: { sizesMm: [[148, 210], [210, 297], [297, 420], [420, 594]] },
  };
  const MC_IN = [[4, 6], [5, 7], [8, 10], [11, 14], [12, 16], [16, 20], [18, 24], [24, 36]];
  const MC_MM = [[148, 210], [210, 297], [297, 420], [420, 594]];
  const MC_SQ = [8, 10, 12, 16, 20];

  const mmToPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);
  const inToMm = (inch) => inch * 25.4;
  const safeBase = (s) => (s || "Print").trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");

  const setStatus = (text, pct = 0) => {
    statusText.textContent = text;
    progressBar.style.width = `${pct}%`;
    if (live) live.textContent = text;
  };

  const updateQualityLabel = () => {
    qualityLabel.textContent = `${qualityInput.value}%`;
  };

  const updateSummary = () => {
    const selectedA = aSizeChecks.filter((c) => c.checked).map((c) => c.value);
    const extras = [
      toggleRatios.checked ? "Aspect ratios" : null,
      toggleInches.checked ? "Inches" : null,
      toggleMm.checked ? "Millimeters" : null,
      toggleSquare.checked ? "Square" : null,
    ].filter(Boolean);

    summaryList.innerHTML = "";
    summaryList.insertAdjacentHTML("beforeend", `<li>A sizes: ${selectedA.join(", ") || "None"}</li>`);
    summaryList.insertAdjacentHTML("beforeend", `<li>Formats: ${toggleJpg.checked ? "JPG" : ""}${toggleJpg.checked && togglePdf.checked ? " + " : ""}${togglePdf.checked ? "PDF" : ""}</li>`);
    summaryList.insertAdjacentHTML("beforeend", `<li>Extras: ${extras.join(", ") || "None"}</li>`);
    summaryList.insertAdjacentHTML("beforeend", `<li>Margins: ${toggleMargins.checked ? `${marginSize.value} in` : "No"}</li>`);
  };

  const updateEstimates = (img) => {
    if (!img) {
      estimates.textContent = "—";
      return;
    }
    const dpi = Number(dpiInput.value || 300);
    const maxA = A_MM.A1;
    const maxPx = `${mmToPx(maxA.w, dpi)}×${mmToPx(maxA.h, dpi)} px`;
    const count = aSizeChecks.filter((c) => c.checked).length;
    estimates.textContent = `A sizes selected: ${count} • Max A1 output: ${maxPx}`;
  };

  const setPreview = (file) => {
    if (!file) {
      previewImage.innerHTML = "<span>Preview will appear here</span>";
      return;
    }
    const url = URL.createObjectURL(file);
    previewImage.innerHTML = `<img src="${url}" alt="Uploaded preview">`;
  };

  dropZone.addEventListener("click", (e) => { if (e.target !== removeBtn) fileInput.click(); });
  fileInput.addEventListener("change", () => { if (fileInput.files.length > 0) handleFile(fileInput.files[0]); syncState(); });
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drop-zone--active"); });
  ["dragleave", "dragend"].forEach((t) => dropZone.addEventListener(t, () => dropZone.classList.remove("drop-zone--active")));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drop-zone--active");
    const data = e.dataTransfer.files;
    if (data.length > 0) {
      fileInput.files = data;
      handleFile(data[0]);
      syncState();
    }
  });

  removeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.value = "";
    clearFile();
    syncState();
  });

  seedDemo.addEventListener("click", async () => {
    const demoUrl = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=80";
    const res = await fetch(demoUrl);
    const blob = await res.blob();
    const file = new File([blob], "Demo-Print.jpg", { type: blob.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    handleFile(file);
    syncState();
  });

  resetAll.addEventListener("click", () => {
    fileInput.value = "";
    clearFile();
    baseInput.value = "";
    dpiInput.value = "300";
    qualityInput.value = "92";
    fitMode.value = "contain";
    orientationMode.value = "auto";
    bgColor.value = "#ffffff";
    toggleJpg.checked = true;
    togglePdf.checked = true;
    toggleMargins.checked = false;
    marginSize.value = "1";
    toggleRatios.checked = true;
    toggleInches.checked = true;
    toggleMm.checked = true;
    toggleSquare.checked = false;
    aSizeChecks.forEach((c) => (c.checked = true));
    updateQualityLabel();
    updateSummary();
    updateEstimates(null);
    syncState();
  });

  baseInput.addEventListener("input", syncState);
  dpiInput.addEventListener("input", () => { updateEstimates(getCurrentImage()); syncState(); });
  qualityInput.addEventListener("input", updateQualityLabel);
  const updateMarginState = () => {
    marginSize.disabled = !toggleMargins.checked;
  };

  [fitMode, orientationMode, bgColor, toggleJpg, togglePdf, toggleMargins, marginSize, toggleRatios, toggleInches, toggleMm, toggleSquare, ...aSizeChecks].forEach((el) => {
    el.addEventListener("change", () => {
      updateSummary();
      updateEstimates(getCurrentImage());
      updateMarginState();
    });
  });

  function handleFile(file) {
    promptEl.style.display = "none";
    previewEl.style.display = "flex";
    filenameEl.textContent = file.name;
    const sizeMb = (file.size / 1024 / 1024).toFixed(2);
    fileMeta.textContent = `${sizeMb} MB`;
    if (live) live.textContent = `Selected ${file.name}`;
    setPreview(file);
    if (!baseInput.value.trim()) {
      baseInput.value = file.name.replace(/\.[^/.]+$/, "");
    }
    updateSummary();
    updateEstimates(file);
  }

  function clearFile() {
    promptEl.style.display = "grid";
    previewEl.style.display = "none";
    filenameEl.textContent = "";
    fileMeta.textContent = "";
    setPreview(null);
    updateSummary();
    updateEstimates(null);
  }

  function syncState() {
    const ok = fileInput.files && fileInput.files[0] && (baseInput.value || "").trim();
    generateBtn.disabled = !ok;
  }

  function getCurrentImage() {
    return fileInput.files && fileInput.files[0];
  }

  function blobToImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function drawFit(canvas, img, mode, bg) {
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cw = canvas.width;
    const ch = canvas.height;
    const canvasRatio = cw / ch;
    const imageRatio = iw / ih;

    let sx = 0, sy = 0, sWidth = iw, sHeight = ih;
    let dx = 0, dy = 0, dWidth = cw, dHeight = ch;

    if (mode === "cover") {
      if (imageRatio > canvasRatio) {
        sWidth = ih * canvasRatio;
        sx = (iw - sWidth) / 2;
      } else if (imageRatio < canvasRatio) {
        sHeight = iw / canvasRatio;
        sy = (ih - sHeight) / 2;
      }
    } else {
      if (imageRatio > canvasRatio) {
        dHeight = cw / imageRatio;
        dy = (ch - dHeight) / 2;
      } else {
        dWidth = ch * imageRatio;
        dx = (cw - dWidth) / 2;
      }
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
  }

  function canvasToJpegBlob(canvas, q = 0.92) {
    return new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
  }

  async function canvasToPdfBlob(canvas, widthMM, heightMM, quality) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error("jsPDF not loaded");
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const pdf = new jsPDF({
      orientation: widthMM > heightMM ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMM, heightMM],
    });
    pdf.addImage(dataUrl, "JPEG", 0, 0, widthMM, heightMM, undefined, "FAST");
    return pdf.output("blob");
  }

  function readme(base, dpi, orientation, mode) {
    const px = (k) => `${mmToPx(A_MM[k].w, dpi)}×${mmToPx(A_MM[k].h, dpi)} px`;
    return `# ${base} Print Set
DPI: ${dpi}
Orientation: ${orientation}
Fit mode: ${mode}

A-series:
A5 ${px("A5")}
A4 ${px("A4")}
A3 ${px("A3")}
A2 ${px("A2")}
A1 ${px("A1")}
`;
  }

  generateBtn.addEventListener("click", async () => {
    try {
      const file = getCurrentImage();
      if (!file) return alert("Select an image");
      if (!toggleJpg.checked && !togglePdf.checked) return alert("Select at least one output format");
      generateBtn.disabled = true;

      const base = safeBase(baseInput.value || "Print");
      const dpi = Math.max(72, Math.min(600, parseInt(dpiInput.value || "300", 10)));
      const quality = Math.max(0.8, Math.min(1, Number(qualityInput.value) / 100));
      const margins = toggleMargins.checked;
      const marginIn = Math.max(0, Math.min(2, Number(marginSize.value || 0)));
      const bg = bgColor.value || "#ffffff";
      const fit = fitMode.value;

      const img = await blobToImage(file);
      const isLandscape = img.naturalWidth >= img.naturalHeight;
      const orientation = orientationMode.value === "auto"
        ? (isLandscape ? "landscape" : "portrait")
        : orientationMode.value;

      if (typeof JSZip === "undefined") throw new Error("JSZip not loaded");
      const zip = new JSZip();
      const root = zip.folder(`${base}_Print_Set`);
      root.file("Instructions.txt", readme(base, dpi, orientation, fit));
      setStatus("Preparing…", 5);

      const aSelected = aSizeChecks.filter((c) => c.checked).map((c) => c.value);
      const aJpg = toggleJpg.checked ? root.folder("A_Sizes_JPG") : null;
      const aPdf = togglePdf.checked ? root.folder("A_Sizes_PDF") : null;
      const mJpg = toggleJpg.checked && margins ? root.folder("A_Sizes_With_Margins_JPG") : null;
      const mPdf = togglePdf.checked && margins ? root.folder("A_Sizes_With_Margins_PDF") : null;
      const arRoot = toggleRatios.checked ? root.folder("Aspect_Ratios") : null;
      const mcJpg = toggleJpg.checked && (toggleInches.checked || toggleMm.checked || toggleSquare.checked) ? root.folder("Sizes_JPG") : null;
      const mcPdf = togglePdf.checked && (toggleInches.checked || toggleMm.checked || toggleSquare.checked) ? root.folder("Sizes_PDF") : null;

      const totalSteps = aSelected.length + (toggleRatios.checked ? 8 : 0) + (toggleInches.checked ? MC_IN.length : 0) + (toggleMm.checked ? MC_MM.length : 0) + (toggleSquare.checked ? MC_SQ.length : 0);
      let step = 0;
      const bump = () => {
        step += 1;
        const pct = Math.min(90, Math.round((step / Math.max(1, totalSteps)) * 90));
        setStatus("Generating…", pct);
      };

      const orientSize = (w, h) => (orientation === "landscape" ? { w: h, h: w } : { w, h });

      for (const key of ORDER) {
        if (!aSelected.includes(key)) continue;
        const { w: mmW, h: mmH } = orientSize(A_MM[key].w, A_MM[key].h);
        const pxW = mmToPx(mmW, dpi);
        const pxH = mmToPx(mmH, dpi);
        const canvas = document.createElement("canvas");
        canvas.width = pxW;
        canvas.height = pxH;
        drawFit(canvas, img, fit, bg);

        if (toggleJpg.checked) {
          const jpg = await canvasToJpegBlob(canvas, quality);
          aJpg.file(`${key}_${base}.jpg`, await jpg.arrayBuffer());
        }
        if (togglePdf.checked) {
          const pdf = await canvasToPdfBlob(canvas, mmW, mmH, quality);
          aPdf.file(`${key}_${base}.pdf`, await pdf.arrayBuffer());
        }

        if (margins && marginIn > 0) {
          const marginPx = Math.round(dpi * marginIn);
          const innerW = Math.max(1, pxW - marginPx * 2);
          const innerH = Math.max(1, pxH - marginPx * 2);
          const marginedCanvas = document.createElement("canvas");
          marginedCanvas.width = pxW;
          marginedCanvas.height = pxH;
          const ctx = marginedCanvas.getContext("2d", { alpha: false });
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, pxW, pxH);
          const innerCanvas = document.createElement("canvas");
          innerCanvas.width = innerW;
          innerCanvas.height = innerH;
          drawFit(innerCanvas, img, fit, bg);
          ctx.drawImage(innerCanvas, marginPx, marginPx);

          if (toggleJpg.checked) {
            const mj = await canvasToJpegBlob(marginedCanvas, quality);
            mJpg.file(`${key}_${base}_Margined.jpg`, await mj.arrayBuffer());
          }
          if (togglePdf.checked) {
            const mp = await canvasToPdfBlob(marginedCanvas, mmW, mmH, quality);
            mPdf.file(`${key}_${base}_Margined.pdf`, await mp.arrayBuffer());
          }
        }
        bump();
      }

      if (toggleRatios.checked && arRoot) {
        for (const [folderName, spec] of Object.entries(AR_SPECS)) {
          const out = arRoot.folder(folderName);
          if (spec.sizesIn) {
            for (const [win, hin] of spec.sizesIn) {
              const { w: w_in, h: h_in } = orientSize(win, hin);
              const winMm = inToMm(w_in);
              const hinMm = inToMm(h_in);
              const pxW = mmToPx(winMm, dpi);
              const pxH = mmToPx(hinMm, dpi);
              const c = document.createElement("canvas");
              c.width = pxW;
              c.height = pxH;
              drawFit(c, img, fit, bg);
              const jpg = await canvasToJpegBlob(c, quality);
              out.file(`${w_in}x${h_in}in_${base}.jpg`, await jpg.arrayBuffer());
            }
          } else if (spec.sizesMm) {
            for (const [wmm, hmm] of spec.sizesMm) {
              const { w, h } = orientSize(wmm, hmm);
              const pxW = mmToPx(w, dpi);
              const pxH = mmToPx(h, dpi);
              const c = document.createElement("canvas");
              c.width = pxW;
              c.height = pxH;
              drawFit(c, img, fit, bg);
              const jpg = await canvasToJpegBlob(c, quality);
              out.file(`${w}x${h}mm_${base}.jpg`, await jpg.arrayBuffer());
            }
          }
          bump();
        }
      }

      if (toggleInches.checked && (mcJpg || mcPdf)) {
        for (const [win, hin] of MC_IN) {
          const { w: w_in, h: h_in } = orientSize(win, hin);
          const winMm = inToMm(w_in);
          const hinMm = inToMm(h_in);
          const pxW = mmToPx(winMm, dpi);
          const pxH = mmToPx(hinMm, dpi);
          const c = document.createElement("canvas");
          c.width = pxW;
          c.height = pxH;
          drawFit(c, img, fit, bg);
          if (toggleJpg.checked && mcJpg) {
            const jpg = await canvasToJpegBlob(c, quality);
            mcJpg.file(`${w_in}x${h_in}in_${base}.jpg`, await jpg.arrayBuffer());
          }
          if (togglePdf.checked && mcPdf) {
            const pdf = await canvasToPdfBlob(c, winMm, hinMm, quality);
            mcPdf.file(`${w_in}x${h_in}in_${base}.pdf`, await pdf.arrayBuffer());
          }
          bump();
        }
      }

      if (toggleMm.checked && (mcJpg || mcPdf)) {
        for (const [wmm, hmm] of MC_MM) {
          const { w, h } = orientSize(wmm, hmm);
          const pxW = mmToPx(w, dpi);
          const pxH = mmToPx(h, dpi);
          const c = document.createElement("canvas");
          c.width = pxW;
          c.height = pxH;
          drawFit(c, img, fit, bg);
          if (toggleJpg.checked && mcJpg) {
            const jpg = await canvasToJpegBlob(c, quality);
            mcJpg.file(`${w}x${h}mm_${base}.jpg`, await jpg.arrayBuffer());
          }
          if (togglePdf.checked && mcPdf) {
            const pdf = await canvasToPdfBlob(c, w, h, quality);
            mcPdf.file(`${w}x${h}mm_${base}.pdf`, await pdf.arrayBuffer());
          }
          bump();
        }
      }

      if (toggleSquare.checked && (mcJpg || mcPdf)) {
        for (const n of MC_SQ) {
          const { w: w_in, h: h_in } = orientSize(n, n);
          const w_mm = inToMm(w_in);
          const h_mm = inToMm(h_in);
          const pxW = mmToPx(w_mm, dpi);
          const pxH = mmToPx(h_mm, dpi);
          const c = document.createElement("canvas");
          c.width = pxW;
          c.height = pxH;
          drawFit(c, img, fit, bg);
          if (toggleJpg.checked && mcJpg) {
            const jpg = await canvasToJpegBlob(c, quality);
            mcJpg.file(`${w_in}x${h_in}in_${base}.jpg`, await jpg.arrayBuffer());
          }
          if (togglePdf.checked && mcPdf) {
            const pdf = await canvasToPdfBlob(c, w_mm, h_mm, quality);
            mcPdf.file(`${w_in}x${h_in}in_${base}.pdf`, await pdf.arrayBuffer());
          }
          bump();
        }
      }

      setStatus("Zipping…", 95);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      if (currentZipUrl) {
        URL.revokeObjectURL(currentZipUrl);
      }
      const url = URL.createObjectURL(zipBlob);
      currentZipUrl = url;
      downloadLink.href = url;
      downloadLink.download = `${base}_Print_Set.zip`;
      downloadLink.style.display = "inline-block";
      setStatus("Ready", 100);
    } catch (e) {
      console.error(e);
      alert("Error generating set");
      setStatus("Error", 0);
    } finally {
      generateBtn.disabled = false;
    }
  });

  updateQualityLabel();
  updateSummary();
  updateMarginState();
  setStatus("Ready", 0);
});

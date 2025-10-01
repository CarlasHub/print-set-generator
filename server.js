// server.js
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* --- Helpers --- */
const mmToPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);
const inchToPx = (inch, dpi) => Math.round(inch * dpi);
const mmToPt = mm => (mm / 25.4) * 72;
const safeBase = s => (s || 'Print').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '');

// --- Configuration for Aspect Ratios & A-Sizes ---
const RATIOS = [
  { name: '2x3', w: 24, h: 36, unit: 'in', folder: 'Aspect_Ratios/2x3_Ratio' },
  { name: '3x4', w: 18, h: 24, unit: 'in', folder: 'Aspect_Ratios/3x4_Ratio' },
  { name: '4x5', w: 16, h: 20, unit: 'in', folder: 'Aspect_Ratios/4x5_Ratio' },
  { name: 'ISO', w: 594, h: 841, unit: 'mm', folder: 'Aspect_Ratios/ISO_Ratio' } // A1
];
const A_SIZES = [
    { name: 'A4', w: 210, h: 297 },
    { name: 'A3', w: 297, h: 420 },
    { name: 'A2', w: 420, h: 594 },
    { name: 'A1', w: 594, h: 841 }
];


app.post('/print-set', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('Image required');

    const base = safeBase(req.body.baseName);
    const dpi = Math.max(72, Math.min(600, parseInt(req.body.dpi || '300', 10)));
    const addMargins = req.body.addMargins === 'on';
    const marginInch = 1;
    const marginMm = 25.4;

    /* --- ZIP Response --- */
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${base}_Print_Set.zip"`);
    const zip = archiver('zip', { zlib: { level: 9 } });
    zip.on('error', err => { throw err; });
    zip.pipe(res);

    /* --- README File for the ZIP --- */
    const readme =
`# Print Instructions for "${req.body.baseName}"

This ZIP file contains two main folders for your convenience:

1.  **Aspect_Ratios**: Contains high-resolution JPGs for flexible printing in various standard frame sizes.
2.  **Ready_to_Print_A-Sizes**: Contains specific JPG and PDF files for A1, A2, A3, and A4 sizes.

## Margin Option
${addMargins ? `You selected the margin option. The "Ready_to_Print_A-Sizes" folder contains an **extra set** of files with a "_Margined" suffix. These have a 1-inch (2.54 cm) white border for easy framing.` : 'The generated files do not have an extra border. For framing, some of the image edge may be covered by the frame.'}

## Printing Guide
- For standard A4, A3, etc., prints, use the files in the "Ready_to_Print_A-Sizes" folder. The PDFs are ideal for print shops.
- For other frame sizes (e.g., 8x10", 16x24"), use the corresponding file from the "Aspect_Ratios" folder.
`;
    zip.append(readme, { name: 'Instructions.md' });

    /* --- Part 1: Process Aspect Ratio JPGs --- */
    for (const ratio of RATIOS) {
      const pxW = ratio.unit === 'in' ? inchToPx(ratio.w, dpi) : mmToPx(ratio.w, dpi);
      const pxH = ratio.unit === 'in' ? inchToPx(ratio.h, dpi) : mmToPx(ratio.h, dpi);
      
      const jpgBuffer = await sharp(req.file.buffer, { limitInputPixels: false })
        .rotate().resize(pxW, pxH, { fit: 'contain', background: '#fff', withoutEnlargement: false })
        .sharpen().withMetadata({ density: dpi }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();

      const filename = `${ratio.folder}/${base}_${ratio.name}_${dpi}dpi.jpg`;
      zip.append(jpgBuffer, { name: filename });
    }

    /* --- Part 2: Process Specific A-Size JPGs and PDFs (with optional extra margined files) --- */
    for (const size of A_SIZES) {
        const pxW = mmToPx(size.w, dpi);
        const pxH = mmToPx(size.h, dpi);

        // 1. Create the standard, non-margined version
        const jpgBuffer = await sharp(req.file.buffer, { limitInputPixels: false })
            .rotate().resize(pxW, pxH, { fit: 'contain', background: '#fff', withoutEnlargement: false })
            .sharpen().withMetadata({ density: dpi }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
        
        const jpgFilename = `Ready_to_Print_A-Sizes/${size.name}_${base}_Print.jpg`;
        zip.append(jpgBuffer, { name: jpgFilename });

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([mmToPt(size.w), mmToPt(size.h)]);
        const embeddedJpg = await pdfDoc.embedJpg(jpgBuffer);
        page.drawImage(embeddedJpg, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
        
        // FIX #1: Convert Uint8Array to Buffer
        const pdfBuffer = Buffer.from(await pdfDoc.save());
        const pdfFilename = `Ready_to_Print_A-Sizes/${size.name}_${base}_Print.pdf`;
        zip.append(pdfBuffer, { name: pdfFilename });

        // 2. If margins are requested, create an additional, separate set of margined files
        if (addMargins) {
            const marginPx = inchToPx(marginInch, dpi);
            const marginedJpgBuffer = await sharp(jpgBuffer)
                .extend({ top: marginPx, bottom: marginPx, left: marginPx, right: marginPx, background: '#fff' })
                .toBuffer();
            
            const marginedJpgFilename = `Ready_to_Print_A-Sizes/${size.name}_${base}_Print_Margined.jpg`;
            zip.append(marginedJpgBuffer, { name: marginedJpgFilename });
            
            const marginedPdfDoc = await PDFDocument.create();
            const marginedPageWidth = mmToPt(size.w + (marginMm * 2));
            const marginedPageHeight = mmToPt(size.h + (marginMm * 2));
            const marginedPage = marginedPdfDoc.addPage([marginedPageWidth, marginedPageHeight]);
            const marginedEmbeddedJpg = await marginedPdfDoc.embedJpg(marginedJpgBuffer);
            marginedPage.drawImage(marginedEmbeddedJpg, { x: 0, y: 0, width: marginedPage.getWidth(), height: marginedPage.getHeight() });
            
            // FIX #2: Convert Uint8Array to Buffer for the margined PDF as well
            const marginedPdfBuffer = Buffer.from(await marginedPdfDoc.save());
            const marginedPdfFilename = `Ready_to_Print_A-Sizes/${size.name}_${base}_Print_Margined.pdf`;
            zip.append(marginedPdfBuffer, { name: marginedPdfFilename });
        }
    }

    await zip.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
        res.status(500).send('Error generating print set.');
    }
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(3000, () => console.log('Print Set server running at http://localhost:3000'));
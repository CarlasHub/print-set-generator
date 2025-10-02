
document.addEventListener('DOMContentLoaded', () => {
  const dropZone=document.querySelector('.drop-zone');
  const fileInput=document.querySelector('.drop-zone__input');
  const promptEl=document.querySelector('.drop-zone__prompt');
  const previewEl=document.querySelector('.drop-zone__preview');
  const filenameEl=document.querySelector('.drop-zone__filename');
  const removeBtn=document.querySelector('.drop-zone__remove-btn');
  const baseInput=document.getElementById('basename-input');
  const dpiInput=document.getElementById('dpi-input');
  const addMargins=document.getElementById('addMargins');
  const generateBtn=document.getElementById('generateBtn');
  const downloadLink=document.getElementById('downloadLink');
  const live=document.getElementById('liveRegion');
  if(!dropZone) return;

  dropZone.addEventListener('click',e=>{ if(e.target!==removeBtn) fileInput.click(); });
  fileInput.addEventListener('change',()=>{ if(fileInput.files.length>0) u(fileInput.files[0]); s(); });
  dropZone.addEventListener('dragover',e=>{ e.preventDefault(); dropZone.classList.add('drop-zone--active'); });
  ['dragleave','dragend'].forEach(t=>dropZone.addEventListener(t,()=>dropZone.classList.remove('drop-zone--active')));
  dropZone.addEventListener('drop',e=>{ e.preventDefault(); dropZone.classList.remove('drop-zone--active'); const d=e.dataTransfer.files; if(d.length>0){ fileInput.files=d; u(d[0]); s(); }});
  removeBtn.addEventListener('click',e=>{ e.preventDefault(); fileInput.value=''; p(); s(); });
  baseInput?.addEventListener('input',s);

  function u(file){ promptEl.style.display='none'; previewEl.style.display='flex'; filenameEl.textContent=`${file.name} — ${(file.size/1024/1024).toFixed(2)} MB`; if(live) live.textContent=`Selected ${file.name}`; }
  function p(){ promptEl.style.display='flex'; previewEl.style.display='none'; }
  function s(){ const ok=fileInput.files&&fileInput.files[0]&&(baseInput.value||'').trim(); generateBtn.disabled=!ok; }

  const A_MM={A1:{w:594,h:841},A2:{w:420,h:594},A3:{w:297,h:420},A4:{w:210,h:297},A5:{w:148,h:210}};
  const ORDER=['A5','A4','A3','A2','A1'];
  const AR_SPECS={
    '2x3':{sizesIn:[[4,6],[8,12],[12,18],[16,24],[20,30],[24,36]]},
    '3x4':{sizesIn:[[6,8],[9,12],[12,16],[18,24]]},
    '4x5':{sizesIn:[[4,5],[8,10],[12,15],[16,20],[20,25],[24,30]]},
    'ISO':{sizesMm:[[148,210],[210,297],[297,420],[420,594]]}
  };
  const MC_IN=[[4,6],[5,7],[8,10],[11,14],[12,16],[16,20],[18,24],[24,36]];
  const MC_MM=[[148,210],[210,297],[297,420],[420,594]];
  const MC_SQ=[8,10,12,16,20];

  const mmToPx=(mm,dpi)=>Math.round((mm/25.4)*dpi);
  const inToMm = inch => inch * 25.4;
  const safeBase=s=>(s||'Print').trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_]/g,'');

  function blobToImage(fileOrBlob){ return new Promise((resolve,reject)=>{ const url=URL.createObjectURL(fileOrBlob); const img=new Image(); img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); }; img.onerror=reject; img.src=url; }); }

  function drawContain(canvas,img){ const ctx=canvas.getContext('2d',{alpha:false}); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); const iw=img.naturalWidth,ih=img.naturalHeight; const scale=Math.min(canvas.width/iw,canvas.height/ih); const w=Math.round(iw*scale),h=Math.round(ih*scale); const x=Math.floor((canvas.width-w)/2),y=Math.floor((canvas.height-h)/2); ctx.drawImage(img,0,0,iw,ih,x,y,w,h); }

  function canvasToJpegBlob(canvas,q=0.9){ return new Promise(res=>canvas.toBlob(res,'image/jpeg',q)); }
  async function canvasToPdfBlob(canvas,widthMM,heightMM){ const {jsPDF}=window.jspdf||{}; if(!jsPDF) throw new Error('jsPDF not loaded'); const dataUrl=canvas.toDataURL('image/jpeg',0.9); const pdf=new jsPDF({orientation:widthMM>heightMM?'landscape':'portrait',unit:'mm',format:[widthMM,heightMM]}); pdf.addImage(dataUrl,'JPEG',0,0,widthMM,heightMM,undefined,'FAST'); return pdf.output('blob'); }

  function readme(base,dpi,orientation){ 
    const px=k=>`${mmToPx(A_MM[k].w,dpi)}×${mmToPx(A_MM[k].h,dpi)} px`;
    return `# ${base} Print Set
DPI ${dpi}
Orientation: ${orientation}

A-series:
A5 ${px('A5')}
A4 ${px('A4')}
A3 ${px('A3')}
A2 ${px('A2')}
A1 ${px('A1')}

Aspect ratios: 2x3, 3x4, 4x5, ISO
Additional inch/mm and square sizes included.`;
  }

  generateBtn.addEventListener('click',async()=>{ try{
    const file=fileInput.files&&fileInput.files[0]; if(!file) return alert('Select an image');
    const base=safeBase(baseInput.value||'Print');
    const dpi=Math.max(72,Math.min(600,parseInt(dpiInput.value||'300',10)));
    const margins=!!addMargins.checked;
    generateBtn.disabled=true; downloadLink.style.display='none'; if(live) live.textContent='Generating';
    const img=await blobToImage(file);
    const isLandscape=img.naturalWidth>=img.naturalHeight;
    const orientation=isLandscape?'landscape':'portrait';
    if(typeof JSZip==='undefined') throw new Error('JSZip not loaded');
    const zip=new JSZip();
    const root=zip.folder(`${base}_Print_Set`);
    root.file('Instructions.txt',readme(base,dpi,orientation));

    const aJpg=root.folder('A_Sizes_JPG');
    const aPdf=root.folder('A_Sizes_PDF');
    const mJpg=margins?root.folder('A_Sizes_With_1in_Margins_JPG'):null;
    const mPdf=margins?root.folder('A_Sizes_With_1in_Margins_PDF'):null;
    const arRoot=root.folder('Aspect_Ratios');
    const mcJpg=root.folder('Sizes_JPG');
    const mcPdf=root.folder('Sizes_PDF');

    function orientSize(w,h){ return isLandscape?{w,h}:{w:h,h:w}; }

    for(const key of ORDER){
      const {w:mmW,h:mmH}=orientSize(A_MM[key].w,A_MM[key].h);
      const pxW=mmToPx(mmW,dpi),pxH=mmToPx(mmH,dpi);
      const c=document.createElement('canvas'); c.width=pxW; c.height=pxH; drawContain(c,img);
      const jpg=await canvasToJpegBlob(c,0.9); aJpg.file(`${key}_${base}.jpg`,await jpg.arrayBuffer());
      const pdf=await canvasToPdfBlob(c,mmW,mmH); aPdf.file(`${key}_${base}.pdf`,await pdf.arrayBuffer());
      if(margins){ const marginPx=Math.round(dpi); const innerW=Math.max(1,pxW-marginPx*2); const innerH=Math.max(1,pxH-marginPx*2);
        const mc=document.createElement('canvas'); mc.width=pxW; mc.height=pxH; const ctx=mc.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,pxW,pxH);
        const ic=document.createElement('canvas'); ic.width=innerW; ic.height=innerH; drawContain(ic,img); ctx.drawImage(ic,marginPx,marginPx);
        const mj=await canvasToJpegBlob(mc,0.9); mJpg.file(`${key}_${base}_Margined.jpg`,await mj.arrayBuffer());
        const mp=await canvasToPdfBlob(mc,mmW,mmH); mPdf.file(`${key}_${base}_Margined.pdf`,await mp.arrayBuffer());
      }
    }

    for(const [folderName,spec] of Object.entries(AR_SPECS)){
      const out=arRoot.folder(folderName);
      if(spec.sizesIn){
        for(const [win,hin] of spec.sizesIn){
          const {w:winMm,h:hinMm}=orientSize(inToMm(win),inToMm(hin));
          const pxW=mmToPx(winMm,dpi),pxH=mmToPx(hinMm,dpi);
          const c=document.createElement('canvas'); c.width=pxW; c.height=pxH; drawContain(c,img);
          const jpg=await canvasToJpegBlob(c,0.9);
          out.file(`${win}x${hin}in_${base}.jpg`,await jpg.arrayBuffer());
        }
      } else if(spec.sizesMm){
        for(const [wmm,hmm] of spec.sizesMm){
          const {w,h}=orientSize(wmm,hmm);
          const pxW=mmToPx(w,dpi),pxH=mmToPx(h,dpi);
          const c=document.createElement('canvas'); c.width=pxW; c.height=pxH; drawContain(c,img);
          const jpg=await canvasToJpegBlob(c,0.9);
          out.file(`${w}x${h}mm_${base}.jpg`,await jpg.arrayBuffer());
        }
      }
    }

    for(const [win,hin] of MC_IN){
      const {w:winMm,h:hinMm}=orientSize(inToMm(win),inToMm(hin));
      const pxW=mmToPx(winMm,dpi),pxH=mmToPx(hinMm,dpi);
      const c=document.createElement('canvas'); c.width=pxW; c.height=pxH; drawContain(c,img);
      const jpg=await canvasToJpegBlob(c,0.9); mcJpg.file(`${win}x${hin}in_${base}.jpg`,await jpg.arrayBuffer());
      const pdf=await canvasToPdfBlob(c,winMm,hinMm); mcPdf.file(`${win}x${hin}in_${base}.pdf`,await pdf.arrayBuffer());
    }
    for(const [wmm,hmm] of MC_MM){
      const {w,h}=orientSize(wmm,hmm);
      const pxW=mmToPx(w,dpi),pxH=mmToPx(h,dpi);
      const c=document.createElement('canvas'); c.width=pxW; c.height=pxH; drawContain(c,img);
      const jpg=await canvasToJpegBlob(c,0.9); mcJpg.file(`${w}x${h}mm_${base}.jpg`,await jpg.arrayBuffer());
      const pdf=await canvasToPdfBlob(c,w,h); mcPdf.file(`${w}x${h}mm_${base}.pdf`,await pdf.arrayBuffer());
    }
    for(const n of MC_SQ){
      const mm=inToMm(n);
      const {w,h}=orientSize(mm,mm);
      const pxW=mmToPx(w,dpi),pxH=mmToPx(h,dpi);
      const c=document.createElement('canvas'); c.width=pxW; c.height=pxH; drawContain(c,img);
      const jpg=await canvasToJpegBlob(c,0.9); mcJpg.file(`${n}x${n}in_${base}.jpg`,await jpg.arrayBuffer());
      const pdf=await canvasToPdfBlob(c,w,h); mcPdf.file(`${n}x${n}in_${base}.pdf`,await pdf.arrayBuffer());
    }

    if(live) live.textContent='Zipping';
    const zipBlob=await zip.generateAsync({type:'blob'});
    const url=URL.createObjectURL(zipBlob);
    downloadLink.href=url;
    downloadLink.download=`${base}_Print_Set.zip`;
    downloadLink.style.display='inline-block';
    if(live) live.textContent='Ready';
  }catch(e){ console.error(e); alert('Error generating set'); if(live) live.textContent='Error'; }
  finally{ generateBtn.disabled=false; }
  });
});

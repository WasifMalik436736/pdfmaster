(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const body = $('#workspaceBody');
  const title = $('#workspaceTitle');
  const subtitle = $('#workspaceSubtitle');
  const toast = $('#toast');
  let selectedFiles = [];
  let activeTool = null;
  let resultUrl = null;
  let resultName = 'converted.pdf';
  let toastTimer;
  $('#year').textContent = new Date().getFullYear();

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }
  function bytes(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  function safeName(name) { return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'converted'; }
  function revokeResult() { if (resultUrl) URL.revokeObjectURL(resultUrl); resultUrl = null; }
  function showResult(blob, filename) {
    revokeResult();
    resultUrl = URL.createObjectURL(blob);
    resultName = filename;
    const preview = URL.createObjectURL(blob);
    const panel = document.createElement('div');
    panel.className = 'result-panel';
    panel.innerHTML = `<div class="result-icon">PDF</div><div class="result-info"><strong>${escapeHtml(filename)}</strong><span>${bytes(blob.size)} · Ready to download</span></div><button class="download-btn" type="button">↓ Download PDF</button>`;
    panel.querySelector('button').addEventListener('click', () => downloadBlob(blob, filename));
    body.appendChild(panel);
    const frame = document.createElement('iframe');
    frame.className = 'preview-frame';
    frame.title = 'PDF preview';
    frame.src = preview;
    body.appendChild(frame);
    frame.addEventListener('load', () => { /* preview URL is retained by the frame */ });
    setStatus('Your PDF is ready. Preview it below or download your file.', 'success');
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function setStatus(message, kind = '') {
    let el = $('.status', body);
    if (!el) { el = document.createElement('div'); el.className = 'status'; body.appendChild(el); }
    el.className = `status ${kind}`; el.textContent = message;
  }
  function filePicker(accept, multiple = false) {
    const input = document.createElement('input'); input.type = 'file'; input.accept = accept; input.multiple = multiple; input.className = 'file-input';
    input.addEventListener('change', () => { if (input.files?.length) addFiles([...input.files]); });
    body.appendChild(input); return input;
  }
  function renderFileList() {
    let list = $('.file-list', body);
    if (!list) { list = document.createElement('div'); list.className = 'file-list'; $('.converter', body).insertBefore(list, $('.converter-actions', body)); }
    list.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const row = document.createElement('div'); row.className = 'file-row';
      const ext = (file.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
      row.innerHTML = `<div class="file-badge">${escapeHtml(ext)}</div><div class="file-meta"><strong>${escapeHtml(file.name)}</strong><span>${bytes(file.size)}</span></div><button class="remove-file" type="button" aria-label="Remove ${escapeHtml(file.name)}">×</button>`;
      row.querySelector('button').addEventListener('click', () => { selectedFiles.splice(index, 1); renderFileList(); });
      list.appendChild(row);
    });
  }
  function addFiles(files) {
    const imageMode = ['image', 'images'].includes(activeTool);
    const officeMode = ['word', 'excel', 'powerpoint'].includes(activeTool);
    const allowed = imageMode ? ['jpg','jpeg','png','webp'] : officeMode ? (activeTool === 'word' ? ['doc','docx'] : activeTool === 'excel' ? ['xls','xlsx'] : ['ppt','pptx']) : [];
    let added = 0;
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (file.size > 25 * 1024 * 1024) { notify(`${file.name} is larger than 25 MB.`); continue; }
      if (allowed.length && !allowed.includes(ext)) { notify(`Unsupported file type: ${file.name}`); continue; }
      if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) { selectedFiles.push(file); added++; }
    }
    renderFileList();
    if (added) setStatus(`${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected.`);
  }
  function baseWorkspace(toolTitle, description) {
    selectedFiles = []; revokeResult();
    title.textContent = toolTitle; subtitle.textContent = description;
    body.innerHTML = '';
    const root = document.createElement('div'); root.className = 'converter'; body.appendChild(root);
    return root;
  }
  function buildUploader(tool, label, accept, multiple = false) {
    const root = baseWorkspace(label, multiple ? 'Add your images in the order you want them to appear.' : 'Upload your file to get started.');
    const drop = document.createElement('div'); drop.className = 'dropzone';
    drop.innerHTML = `<div class="upload-symbol">↑</div><h3>Drop ${multiple ? 'your files' : 'your file'} here</h3><p>or browse from your device</p><button class="browse-btn" type="button">Choose ${multiple ? 'images' : 'file'}</button><div class="format-note">Supported: ${accept.replaceAll('.', '').replaceAll(',', ', ').toUpperCase()} · Max 25 MB per file</div>`;
    root.appendChild(drop);
    const input = filePicker(accept, multiple);
    drop.querySelector('button').addEventListener('click', e => { e.stopPropagation(); input.click(); });
    drop.addEventListener('click', e => { if (e.target === drop || e.target.closest('h3,p,.upload-symbol')) input.click(); });
    ['dragenter','dragover'].forEach(event => drop.addEventListener(event, e => { e.preventDefault(); drop.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(event => drop.addEventListener(event, e => { e.preventDefault(); drop.classList.remove('dragover'); }));
    drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
    const actions = document.createElement('div'); actions.className = 'converter-actions';
    const clear = document.createElement('button'); clear.className = 'secondary-action'; clear.textContent = 'Clear files'; clear.type = 'button';
    const convert = document.createElement('button'); convert.className = 'action-btn'; convert.textContent = 'Convert to PDF →'; convert.type = 'button';
    clear.addEventListener('click', () => { selectedFiles = []; renderFileList(); setStatus('Selection cleared.'); });
    convert.addEventListener('click', () => tool === 'office' ? convertOffice() : convertImages());
    actions.append(clear, convert); root.appendChild(actions);
    const status = document.createElement('div'); status.className = 'status'; root.appendChild(status);
    return root;
  }
  function renderTool(tool) {
    activeTool = tool;
    $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (tool === 'image' || tool === 'images') {
      buildUploader('image', tool === 'image' ? 'Image to PDF' : 'Multiple images to one PDF', '.jpg,.jpeg,.png,.webp', tool === 'images');
    } else if (tool === 'word' || tool === 'excel' || tool === 'powerpoint') {
      const labels = {word:'Word to PDF',excel:'Excel to PDF',powerpoint:'PowerPoint to PDF'};
      const accepts = {word:'.doc,.docx',excel:'.xls,.xlsx',powerpoint:'.ppt,.pptx'};
      buildUploader('office', labels[tool], accepts[tool]);
      $('.action-btn', body).textContent = 'Convert document →';
    } else if (tool === 'text') renderTextEditor();
    else if (tool === 'preview') renderPreview();
  }
  async function convertImages() {
    if (!selectedFiles.length) return setStatus('Please choose at least one image first.', 'error');
    const button = $('.action-btn', body); button.disabled = true; body.classList.add('busy'); setStatus('Preparing your PDF…');
    try {
      const { PDFDocument } = PDFLib;
      const pdf = await PDFDocument.create();
      for (const file of selectedFiles) {
        const bytesData = await file.arrayBuffer();
        let image;
        if (/\.png$/i.test(file.name) || file.type === 'image/png') image = await pdf.embedPng(bytesData);
        else if (/\.(jpe?g)$/i.test(file.name) || file.type === 'image/jpeg') image = await pdf.embedJpg(bytesData);
        else {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
          const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          image = await pdf.embedPng(await png.arrayBuffer());
        }
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      const blob = new Blob([await pdf.save()], { type: 'application/pdf' });
      showResult(blob, `${safeName(selectedFiles[0].name)}${selectedFiles.length > 1 ? '-combined' : ''}.pdf`);
    } catch (err) { setStatus(`Could not convert these images: ${err.message}`, 'error'); }
    finally { button.disabled = false; body.classList.remove('busy'); }
  }
  async function convertOffice() {
    if (selectedFiles.length !== 1) return setStatus('Please choose one Office document.', 'error');
    const file = selectedFiles[0]; const button = $('.action-btn', body); button.disabled = true; body.classList.add('busy'); setStatus('Uploading document securely for conversion…');
    try {
      const data = new FormData(); data.append('file', file);
      const response = await fetch('/api/convert-office', { method: 'POST', body: data });
      if (!response.ok) { let message = 'Conversion failed.'; try { message = (await response.json()).error || message; } catch {} throw new Error(message); }
      const blob = await response.blob();
      if (blob.type !== 'application/pdf') throw new Error('The server returned an invalid PDF.');
      showResult(blob, `${safeName(file.name)}.pdf`);
    } catch (err) { setStatus(err.message, 'error'); }
    finally { button.disabled = false; body.classList.remove('busy'); }
  }
  function renderTextEditor() {
    const root = baseWorkspace('Text to PDF', 'Write or paste your content, choose a page size, and create a PDF.');
    root.innerHTML = `<textarea class="text-editor" id="textContent" placeholder="Start typing or paste your text here…"></textarea><div class="editor-tools"><span id="charCount">0 characters</span><label>Page size <select class="select-control" id="pageSize"><option value="A4">A4</option><option value="Letter">Letter</option><option value="A5">A5</option></select></label></div><div class="converter-actions"><button class="secondary-action" id="clearText" type="button">Clear text</button><button class="action-btn" id="makeTextPdf" type="button">Create PDF →</button></div><div class="status"></div>`;
    const textarea = $('#textContent'); textarea.addEventListener('input', () => $('#charCount').textContent = `${textarea.value.length.toLocaleString()} characters`);
    $('#clearText').addEventListener('click', () => { textarea.value = ''; textarea.dispatchEvent(new Event('input')); });
    $('#makeTextPdf').addEventListener('click', createTextPdf);
  }
  async function createTextPdf() {
    const text = $('#textContent').value;
    if (!text.trim()) return setStatus('Please enter some text before creating your PDF.', 'error');
    const button = $('#makeTextPdf'); button.disabled = true; body.classList.add('busy'); setStatus('Creating your PDF…');
    try {
      const { PDFDocument, StandardFonts, rgb } = PDFLib;
      const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const sizes = {A4:[595.28,841.89],Letter:[612,792],A5:[419.53,595.28]};
      const [width,height] = sizes[$('#pageSize').value];
      const margin = 54, fontSize = 11, lineHeight = 16, maxWidth = width - margin * 2;
      let page = pdf.addPage([width,height]); let y = height - margin;
      page.drawText('PDFMaster document', {x:margin,y,font:bold,size:16,color:rgb(.12,.2,.36)}); y -= 34;
      const paragraphs = text.replace(/\r/g,'').split('\n');
      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) { y -= lineHeight; if (y < margin) { page = pdf.addPage([width,height]); y = height - margin; } continue; }
        const words = paragraph.split(/\s+/); let line = '';
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(candidate,fontSize) > maxWidth && line) {
            if (y < margin + lineHeight) { page = pdf.addPage([width,height]); y = height - margin; }
            page.drawText(line,{x:margin,y,size:fontSize,font,color:rgb(.16,.2,.28)}); y -= lineHeight; line = word;
          } else line = candidate;
        }
        if (line) { if (y < margin + lineHeight) { page = pdf.addPage([width,height]); y = height - margin; } page.drawText(line,{x:margin,y,size:fontSize,font,color:rgb(.16,.2,.28)}); y -= lineHeight; }
      }
      const blob = new Blob([await pdf.save()],{type:'application/pdf'}); showResult(blob,'text-document.pdf');
    } catch (err) { setStatus(`Could not create PDF: ${err.message}`,'error'); }
    finally { button.disabled = false; body.classList.remove('busy'); }
  }
  function renderPreview() {
    const root = baseWorkspace('PDF preview', 'Choose a PDF file to view it here and download a copy.');
    root.innerHTML = `<div class="dropzone" id="pdfDrop"><div class="upload-symbol">◫</div><h3>Choose a PDF to preview</h3><p>PDF files only · Max 25 MB</p><button class="browse-btn" id="pdfBrowse" type="button">Choose PDF</button></div><input class="file-input" id="pdfInput" type="file" accept="application/pdf"/><div class="status"></div>`;
    const input = $('#pdfInput'); $('#pdfBrowse').addEventListener('click',()=>input.click());
    $('#pdfDrop').addEventListener('dragover',e=>{e.preventDefault();$('#pdfDrop').classList.add('dragover')});
    $('#pdfDrop').addEventListener('dragleave',()=>$('#pdfDrop').classList.remove('dragover'));
    $('#pdfDrop').addEventListener('drop',e=>{e.preventDefault();$('#pdfDrop').classList.remove('dragover');loadPdf(e.dataTransfer.files[0])});
    input.addEventListener('change',()=>loadPdf(input.files[0]));
  }
  function loadPdf(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setStatus('Please choose a valid PDF file.','error');
    if (file.size > 25*1024*1024) return setStatus('This PDF is larger than 25 MB.','error');
    const url = URL.createObjectURL(file); const frame = document.createElement('iframe'); frame.className='preview-frame'; frame.title='PDF preview'; frame.src=url; body.appendChild(frame);
    const row = document.createElement('div'); row.className='result-panel'; row.innerHTML=`<div class="result-icon">PDF</div><div class="result-info"><strong>${escapeHtml(file.name)}</strong><span>${bytes(file.size)}</span></div><button class="download-btn" type="button">↓ Download</button>`;
    row.querySelector('button').addEventListener('click',()=>downloadBlob(file,file.name)); body.appendChild(row); setStatus('PDF loaded successfully.','success');
  }
  $$('.tool-card').forEach(card => card.addEventListener('click', () => renderTool(card.dataset.tool)));
  $('#mobileMenu').addEventListener('click', () => $('.nav-links').classList.toggle('open'));
  $$('.nav-links a').forEach(link => link.addEventListener('click',()=>$('.nav-links').classList.remove('open')));
})();

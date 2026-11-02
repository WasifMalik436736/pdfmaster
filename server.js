const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const allowed = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp']);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.has(ext)) return cb(new Error('Unsupported file type. Upload DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS or ODP.'));
    cb(null, true);
  }
});

function convertWithLibreOffice(inputPath, outputDir, profileDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('soffice', [ 
      `-env:UserInstallation=file://${profileDir}`,
      '--headless', '--convert-to', 'pdf', '--outdir', outputDir, inputPath
    ], { timeout: 90000 });
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', err => reject(new Error('LibreOffice is not installed or could not be started. Install LibreOffice and try again.')));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.trim() || 'Document conversion failed.')));
  });
}

app.post('/api/convert-office', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose a document first.' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const base = path.basename(req.file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'document';
  const workDir = path.join(os.tmpdir(), `pdfmaster-${crypto.randomUUID()}`);
  const outputDir = path.join(workDir, 'out');
  const profileDir = path.join(workDir, 'profile');
  const inputPath = path.join(workDir, `source${ext}`);
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(inputPath, req.file.buffer);
    await convertWithLibreOffice(inputPath, outputDir, profileDir);
    const outputPath = path.join(outputDir, 'source.pdf');
    if (!fs.existsSync(outputPath)) throw new Error('The converter did not create a PDF. Please check that the document is valid.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    res.sendFile(outputPath, err => { if (err) console.error('Send file error:', err); fs.rm(workDir, { recursive: true, force: true }, () => {}); });
  } catch (err) {
    fs.rm(workDir, { recursive: true, force: true }, () => {});
    res.status(500).json({ error: err.message || 'Conversion failed.' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, converter: 'LibreOffice (server-side)' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, _req, res, _next) => res.status(400).json({ error: err.message || 'Upload error.' }));
app.listen(PORT, () => console.log(`PDFMaster running at http://localhost:${PORT}`));

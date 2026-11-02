# PDFMaster

A responsive PDF conversion website with browser-based image/text conversion and server-side Microsoft Office conversion through LibreOffice.

## Features
- JPG, JPEG, PNG and WEBP images to PDF
- Combine multiple images into one PDF
- Text to PDF with A4, Letter and A5 page sizes
- DOC/DOCX to PDF
- XLS/XLSX to PDF
- PPT/PPTX to PDF
- PDF preview and download
- Responsive layout for desktop, tablet and mobile

## Requirements
- Node.js 18 or newer
- LibreOffice installed and available as `libreoffice` on the server PATH (required for Word, Excel and PowerPoint conversions)

### Install LibreOffice
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y libreoffice`
- macOS: install LibreOffice and ensure its command-line executable is available as `libreoffice` (or adjust `server.js` to its full path).
- Windows: install LibreOffice and add its program directory to PATH; the executable may be named `soffice.exe`, so update `spawn('libreoffice', ...)` in `server.js` to `spawn('soffice', ...)` if needed.

## Run locally
```bash
npm install
npm start
```
Open http://localhost:3000.

## Notes before production deployment
- Office files are uploaded to your server for conversion. The server stores them in a unique temporary directory and removes that directory after the response or on conversion failure.
- Browser-based image and text conversion use PDF-Lib loaded from a CDN. Mammoth is included for future Word preview enhancements; actual Office-to-PDF conversion uses LibreOffice.
- Add HTTPS, authentication if needed, persistent monitoring, stronger per-IP limits, malware scanning, and an upload policy before exposing this service publicly.
- The server limits uploads to 25 MB and one file per Office conversion. Only Office/OpenDocument formats are accepted by that endpoint.
- Keep LibreOffice patched and run the conversion service as an unprivileged user in a restricted container for public deployments.

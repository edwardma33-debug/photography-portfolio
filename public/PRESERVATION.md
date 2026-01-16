# PRESERVATION GUIDE

## What This Archive Contains

This is a permanent digital archive of photographs by Edward Ma, created December 2024.

## Contents

- **Master Files** (`masters/`): Full-resolution 16-bit TIFF files, exactly as exported from Lightroom. These are the archival source of truth.

- **Preview Images** (`previews/`): High-quality JPEG files at ~2400px, suitable for screen viewing and moderate printing.

- **Thumbnails** (`thumbnails/`): WebP files at ~800px for quick browsing.

- **Tile Pyramids** (`tiles/`): Deep Zoom Image format (DZI) allowing smooth zoom from overview to pixel-level detail. Each image has its own folder containing the `.dzi` manifest and numbered tile folders.

- **Gallery Manifest** (`data/gallery.json`): JSON file containing metadata for all images, including technical camera data, titles, locations, and file paths.

- **Website** (`.html`, `.js`, `.css`): A static website that displays the gallery. Requires only a web browser to view.

## How to Access Images Directly

### View a Master File
Master files are standard TIFF format. Open with:
- Adobe Photoshop
- GIMP
- Any photo viewer that supports TIFF

### View the Gallery Manifest
`gallery.json` is human-readable JSON. Each image entry contains:
```json
{
  "id": "unique-identifier",
  "title": "Image Title",
  "master": "masters/filename.tiff",
  "width": 11648,
  "height": 8736,
  "camera": "Fujifilm GFX100S II",
  "lens": "GF32-64mmF4 R LM WR",
  ...
}
```

### Browse Without a Server
Most files can be viewed directly. For the full interactive experience, run a local server:
```bash
python -m http.server 8000
```
Then open http://localhost:8000

## How to Rebuild the Website

If the website code becomes corrupted or you need to recreate it:

1. The website is built with Next.js (React framework)
2. Source code should be in the repository
3. Requirements: Node.js 18+

```bash
npm install
npm run build
npm run start
```

## File Formats Used

| Format | Purpose | Longevity |
|--------|---------|-----------|
| TIFF | Master files | Excellent - 30+ year standard |
| JPEG | Previews | Excellent - universal support |
| WebP | Thumbnails | Good - modern standard |
| JSON | Metadata | Excellent - plain text |
| HTML/CSS/JS | Website | Good - web standards |

## Recommended Backup Strategy

1. **Local Copies**: Keep on multiple physical drives in different locations
2. **Cloud Storage**: Backblaze B2, Cloudflare R2, or AWS S3 Glacier
3. **Optical Media**: M-DISC Blu-ray rated for 1000+ years
4. **Decentralized**: IPFS or Arweave for censorship-resistant permanence

## Contact

Edward Ma
edwardma33@gmail.com

Created: December 2024
Last Updated: January 2026

## Legal

All photographs © Edward Ma. All rights reserved.
The website code is MIT licensed.

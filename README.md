# ToBook - Markdown to KDP Book Converter

A Railway-deployable web application that converts Markdown files to Amazon KDP-ready books (Paperback PDF, Hardcover PDF, Kindle EPUB) using TinyTeX + Pandoc.

## Features

- **Multiple Output Formats**: Generate Paperback PDF, Hardcover PDF, and Kindle EPUB from a single Markdown source
- **KDP-Compliant**: Professional trim sizes and margins for Amazon KDP publishing
- **TinyTeX Integration**: Automatic download and installation of TinyTeX (~130MB) on first run
- **Web Interface**: Modern React-based UI for easy file upload and conversion
- **REST API**: Programmatic access for integration with other tools
- **Railway Ready**: One-click deployment to Railway with persistent storage

## Supported Trim Sizes

| Trim Size | Paperback Inner | Hardcover Inner | Best For |
|-----------|----------------|-----------------|----------|
| 5" × 8" | 0.70" | 0.85" | Standard fiction/memoir |
| 5.25" × 8" | 0.75" | 0.90" | Fiction alternative |
| 5.5" × 8.5" | 0.80" | 0.95" | Digest size |
| 6" × 9" | 0.85" | 1.00" | Non-fiction/textbooks |

## Quick Start

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd tobook

# Install dependencies
npm install

# Start development servers
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Deployment to Railway

1. Fork this repository
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repository
4. Add a persistent volume for `TINYTEX_DIR` and `PANDOC_DIR`
5. Deploy!

## API Endpoints

### Health Check
```
GET /api/health
```

### Upload Files
```
POST /api/upload
Content-Type: multipart/form-data

Fields:
- markdown: Markdown files (multiple)
- cover: Cover image (optional, single)
```

### Start Conversion
```
POST /api/convert
Content-Type: application/json

{
  "files": ["/path/to/file1.md", "/path/to/file2.md"],
  "coverFile": "/path/to/cover.jpg",
  "title": "My Book",
  "author": "Jane Smith",
  "format": "all",        // "pdf", "epub", or "all"
  "trim": "5x8",          // "5x8", "5.25x8", "5.5x8.5", "6x9"
  "fontSize": "11pt",     // "10pt", "11pt", "12pt"
  "toc": false,           // Include table of contents
  "openRight": false,     // Chapters start on right pages
  "year": "2024",
  "isbn": "978-..."
}
```

### Check Status
```
GET /api/status/:jobId
```

### Get Job Details
```
GET /api/jobs/:jobId
```

### Download File
```
GET /api/download/:jobId/:filename
```

### Download All (ZIP)
```
GET /api/download/:jobId/all
```

## Markdown Format

The converter expects standard Markdown with chapter headings:

```markdown
# Chapter One

The story begins...

---

A scene break above.

## A Section

More content here.

# Chapter Two

Next chapter starts here.
```

- `# Heading` creates a new chapter
- `---` creates a scene break (* * *)
- Standard Markdown formatting is supported

## Project Structure

```
tobook/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── trimSizes.ts      # KDP trim size configurations
│   │   ├── filters/
│   │   │   └── scene-break.lua   # Pandoc filter for scene breaks
│   │   ├── routes/
│   │   │   ├── convert.ts        # Conversion endpoints
│   │   │   ├── download.ts       # Download endpoints
│   │   │   ├── status.ts         # Status endpoints
│   │   │   └── upload.ts         # File upload endpoints
│   │   ├── services/
│   │   │   ├── ConversionService.ts  # Pandoc execution
│   │   │   ├── JobService.ts         # Job tracking
│   │   │   ├── PandocService.ts      # Pandoc binary management
│   │   │   └── TinyTeXService.ts     # TinyTeX installation
│   │   ├── templates/
│   │   │   ├── epub.css          # EPUB stylesheet
│   │   │   └── kdp-print.tex     # LaTeX template for PDF
│   │   ├── types/
│   │   │   └── index.ts          # TypeScript types
│   │   ├── index.ts              # Entry point
│   │   └── server.ts             # Express server setup
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main React component
│   │   ├── App.css               # Styles
│   │   └── main.tsx              # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── package.json                  # Root workspace config
├── railway.json                  # Railway deployment config
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` |
| `OUTPUT_DIR` | Directory for generated files | `./outputs` |
| `TINYTEX_DIR` | TinyTeX installation directory | `./.tinytex` |
| `PANDOC_DIR` | Pandoc installation directory | `./.pandoc` |
| `NODE_ENV` | Environment | `development` |

## License

MIT

## Credits

- Built with [TinyTeX](https://yihui.org/tinytex/) by Yihui Xie
- Document conversion powered by [Pandoc](https://pandoc.org/) by John MacFarlane
- Original CLI tool: [markdown-to-book](https://github.com/vpuna/markdown-to-book) by vpuna

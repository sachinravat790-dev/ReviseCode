/**
 * ReviseCode Zero-Dependency Local Static Server
 * Usage: node server.js [port]
 * Default port: 3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Normalize URL
  let parsedUrl = req.url.split('?')[0].split('#')[0];
  if (parsedUrl === '/') {
    parsedUrl = '/index.html';
  }

  let filePath = path.join(__dirname, parsedUrl);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head><title>404 Not Found — ReviseCode</title><style>body{background:#0a0d17;color:#f8fafc;font-family:sans-serif;padding:40px;text-align:center;}a{color:#8b5cf6;}</style></head>
        <body>
          <h1>404 — Page Not Found</h1>
          <p>The requested file <code>${parsedUrl}</code> does not exist.</p>
          <p><a href="/index.html">Return to ReviseCode Home</a></p>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 ReviseCode Web Application is Live!`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  console.log(`  Dashboard:   http://localhost:${PORT}/dashboard.html`);
  console.log(`======================================================\n`);
  console.log(`Press Ctrl+C to stop the server.\n`);
});

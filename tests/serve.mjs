// Servidor estático para pruebas: sirve dist/ con las cabeceras de netlify.toml (CSP incluida)
// y el mismo fallback de SPA, para probar la app tal como quedará publicada.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

const rules = [];
for (const block of toml.split('[[headers]]').slice(1)) {
  const pattern = block.match(/for\s*=\s*"([^"]+)"/)?.[1];
  const values = {};
  for (const m of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/gm)) if (m[1] !== 'for') values[m[1]] = m[2];
  rules.push({ re: new RegExp('^' + pattern.replace(/\*/g, '.*') + '$'), values });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.gz': 'application/gzip', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.txt': 'text/plain',
};

const port = Number(process.env.PORT || 4173);
createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end('{"enabled":false}');
  }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    // igual que netlify.toml: el panel tiene su propia página
    file = join(root, url.pathname === '/admin' || url.pathname.startsWith('/admin/') ? 'admin/index.html' : 'index.html');
  }
  const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' };
  for (const r of rules) if (r.re.test(url.pathname)) Object.assign(headers, r.values);
  // en local no hay HTTPS: se omite solo esta directiva
  if (headers['Content-Security-Policy']) headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(port, () => console.log(`http://localhost:${port}`));

// Punto 2 de seguridad: falla el build si hay secretos dentro del repositorio.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI API key', re: /sk-(proj-)?[A-Za-z0-9]{32,}/ },
  { name: 'JWT (posible service_role de Supabase)', re: /eyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Clave privada', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Token de GitHub', re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: 'Clave de AWS', re: /AKIA[0-9A-Z]{16}/ },
];

let files = [];
try {
  files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  console.log('check-secrets: no es un repositorio git, se omite.');
  process.exit(0);
}

const skip = /\.(png|jpe?g|webp|gif|ico|xlsx|gz|wasm|woff2?)$|package-lock\.json$|^\.agents\/|^\.claude\/|^scripts\/check-secrets\.mjs$/;
const hits = [];
for (const f of files) {
  if (skip.test(f)) continue;
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) {
    hits.push(`${f}: archivo .env versionado`);
    continue;
  }
  let text = '';
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  for (const p of patterns) if (p.re.test(text)) hits.push(`${f}: ${p.name}`);
}

if (hits.length) {
  console.error('Se encontraron posibles secretos en el repositorio:\n  ' + hits.join('\n  '));
  console.error('Muévelos a variables de entorno de Netlify y elimínalos del historial de Git.');
  process.exit(1);
}
console.log(`check-secrets: ${files.length} archivos revisados, sin secretos.`);

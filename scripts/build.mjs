import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public');

const filesToCopy = [
  'index.html',
  'script.js',
  'styles.css',
  'eus-logo.png',
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const file of filesToCopy) {
  const src = path.join(ROOT, file);
  const dest = path.join(OUT_DIR, file);

  if (!fs.existsSync(src)) {
    console.warn(`[build] Skipping missing file: ${file}`);
    continue;
  }

  fs.copyFileSync(src, dest);
  console.log(`[build] Copied ${file} -> public/${file}`);
}

console.log('[build] Static output ready in public/');



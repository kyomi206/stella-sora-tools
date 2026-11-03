import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../src/data');

const SOURCES = {
  'datamined-banners.json': 'https://raw.githubusercontent.com/AutumnVN/ss-data/main/gacha.json',
  'datamined-unreleased.json': 'https://raw.githubusercontent.com/AutumnVN/ss-data/main/unreleased.json',
  'datamined-blitz.json': 'https://raw.githubusercontent.com/AutumnVN/ss-data/main/blitz.json',
};

async function sync() {
  console.log('🔄 Syncing datamined roadmap data from AutumnVN/ss-data...');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  for (const [filename, url] of Object.entries(SOURCES)) {
    const dest = path.join(DATA_DIR, filename);
    try {
      console.log(`  Downloading ${url} -> ${filename}...`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf-8');
      const count = Array.isArray(data) ? data.length : Object.keys(data).length;
      console.log(`  ✅ Wrote ${filename} (${count} entries)`);
    } catch (err) {
      console.error(`  ❌ Failed to sync ${filename}:`, err.message);
      // Fallback: If network fails and file does not exist, write empty object
      if (!fs.existsSync(dest)) {
        fs.writeFileSync(dest, '{}', 'utf-8');
      }
    }
  }

  console.log('🎉 Roadmap datamined sync complete!');
}

sync();

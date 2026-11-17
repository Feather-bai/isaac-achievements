import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBlocks } from './lib/atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const blocks = readBlocks(html);

mkdirSync(resolve(root, 'scripts/data/raw'), { recursive: true });
mkdirSync(resolve(root, 'scripts/data/atlas-src'), { recursive: true });

const keep = ['pos-json', 'ipos-json', 'data-json', 'user-icons', 'tainted-chars', 'tainted-map'];
const snap = Object.fromEntries(keep.map((k) => [k, blocks[k]]));
writeFileSync(resolve(root, 'scripts/data/raw/blocks.json'), JSON.stringify(snap));

const imgs = {
  'ach.jpg': blocks['atlas-json'],
  'collect.png': blocks['collect-b64'],
  'cards.png': blocks['cards-b64'],
  'trinket.png': blocks['trinket-b64'],
};
for (const [file, b64] of Object.entries(imgs)) {
  writeFileSync(resolve(root, 'scripts/data/atlas-src', file), Buffer.from(b64, 'base64'));
}
console.log('ok');

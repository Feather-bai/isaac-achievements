import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';
import { buildCodex } from './lib/codex.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blocks = JSON.parse(readFileSync(resolve(root, 'scripts/data/raw/blocks.json'), 'utf8'));
const eid = JSON.parse(readFileSync(resolve(root, 'scripts/data/eid-names.json'), 'utf8'));
const guru = JSON.parse(readFileSync(resolve(root, 'scripts/data/guru-items.json'), 'utf8'));
const aliases = JSON.parse(readFileSync(resolve(root, 'scripts/data/aliases.json'), 'utf8'));

function py(name) {
  const full = pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/\s+/g, '');
  const initials = pinyin(name, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/\s+/g, '');
  return { full, initials };
}

const codex = buildCodex({ blocks, eid, guru, aliases, pinyin: py });
const json = JSON.stringify(codex);
mkdirSync(resolve(root, 'public/data'), { recursive: true });
writeFileSync(resolve(root, 'public/data/codex.json'), json);

const byKind = codex.items.reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {});
console.log(byKind, 'bytes', json.length, 'aliases', Object.keys(codex.aliases).length);
const noPools = codex.items.filter(i => i.kind === 'collectible' && i.quality == null);
console.log('collectibles without quality:', noPools.map(i => i.id));

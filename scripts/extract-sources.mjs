import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBlocks } from './lib/atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const blocks = readBlocks(html);

mkdirSync(resolve(root, 'scripts/data/raw'), { recursive: true });

// 只快照页面里仍存在的 JSON 块。图集 base64 已外置到 public/assets/，
// scripts/data/atlas-src/ 是受版本管理的输入，不再从这里重新生成。
const keep = ['pos-json', 'ipos-json', 'data-json', 'user-icons', 'tainted-chars', 'tainted-map'];
const snap = Object.fromEntries(keep.map((k) => [k, blocks[k]]));
writeFileSync(resolve(root, 'scripts/data/raw/blocks.json'), JSON.stringify(snap));
console.log('ok');

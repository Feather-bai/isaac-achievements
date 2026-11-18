// 生成成就标题的逐字拼音表（全部 637/641 条标题里只有 823 个不同汉字）
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const m = html.match(/<script type="application\/json" id="data-json">([\s\S]*?)<\/script>/);
if (!m) throw new Error('找不到 data-json');
const data = JSON.parse(m[1]);

const chars = new Set();
for (const it of data) for (const ch of String(it.title || '')) if (/[一-鿿]/.test(ch)) chars.add(ch);

const map = {};
for (const ch of chars) {
  const p = pinyin(ch, { toneType: 'none', type: 'array', nonZh: 'consecutive' })[0] || '';
  map[ch] = String(p).toLowerCase().replace(/[^a-z]/g, '');
}
const out = JSON.stringify(map);
writeFileSync(resolve(root, 'public/data/ach-py.json'), out);
console.log('ach-py:', chars.size, 'chars,', out.length, 'bytes');

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const codex = read('public/data/codex.json');
const icons = read('public/data/eid-icons.json');
const manifest = read('public/assets/manifest.json');

// 每类 {{Token}}：颜色/换行指令、图标表、动态道具必须覆盖
const TEXT = /^(Color[A-Za-z]+|Blink[A-Za-z]+|CR|ColorReset|NoLB|NoLineBreak|Blank|Indent|IND)$/;
const ITEM = /^(Collectible|Trinket|Card|Pill)\d+$/;

test('每条描述里的 {{Token}} 都能被页面解析', () => {
  const unresolved = [];
  for (const it of codex.items) {
    if (!it.desc) continue;
    for (const m of it.desc.matchAll(/\{\{(.*?)\}\}/g)) {
      const t = m[1];
      if (TEXT.test(t) || icons[t] || ITEM.test(t)) continue;
      unresolved.push(it.kind + '#' + it.id + ' ' + t);
    }
  }
  assert.deepEqual(unresolved.slice(0, 20), []);
});

test('图标表的每个格子都落在 eid-inline 图集内', () => {
  const sheet = manifest['eid-inline'];
  assert.ok(sheet, 'manifest 缺少 eid-inline');
  const max = sheet.cols * sheet.rows - 1;
  const bad = Object.entries(icons).filter(([, v]) => !(v.c >= 0 && v.c <= max));
  assert.deepEqual(bad, []);
});

test('标签与道具池都有中文名（缺译时回退英文，不能是空串）', () => {
  const src = readFileSync(resolve(root, 'index.html'), 'utf8');
  const tags = new Set(), pools = new Set();
  for (const it of codex.items) {
    for (const t of (it.tags || [])) for (const w of String(t).split(' ')) if (w) tags.add(w);
    for (const p of (it.pools || [])) if (p !== ',') pools.add(p);
  }
  const missing = [];
  const tagBlock = (src.match(/const CODEX_TAG_LABELS = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const poolBlock = (src.match(/const CODEX_POOL_LABELS = \{([\s\S]*?)\n\};/) || [])[1] || '';
  for (const t of tags) if (!new RegExp('^\\s*' + t + ':', 'm').test(tagBlock)) missing.push('tag ' + t);
  for (const p of pools) if (!new RegExp('^\\s*' + p + ':', 'm').test(poolBlock)) missing.push('pool ' + p);
  assert.deepEqual(missing, []);
});

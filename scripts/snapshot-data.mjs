import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEidNames, parseEidDescriptions } from './lib/names.mjs';
import { resolveAliases } from './lib/aliases.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = resolve(root, '.scratch');
const descDir = resolve(scratch, 'eid-master/External-Item-Descriptions-master/descriptions');
mkdirSync(resolve(root, 'scripts/data'), { recursive: true });

// 1) EID 名称 + 描述（合并顺序 ab+ → rep → rep+，后到覆盖先到）
const names = parseEidNames(readFileSync(resolve(descDir, 'names/zh_cn.lua'), 'utf8'));
const descriptions = parseEidDescriptions(
  readFileSync(resolve(descDir, 'ab+/zh_cn.lua'), 'utf8'),
  readFileSync(resolve(descDir, 'rep/zh_cn.lua'), 'utf8'),
  readFileSync(resolve(descDir, 'rep+/zh_cn.lua'), 'utf8'),
);
writeFileSync(resolve(root, 'scripts/data/eid-names.json'), JSON.stringify({ ...names, descriptions }));

// 2) IsaacGuru 元数据（pools/tags 形如 "@treasure#1.0@devil#1.0" 或 ", "）
const parseList = (s) => String(s || '').split('@').map((x) => x.split('#')[0].trim()).filter(Boolean);
const guru = JSON.parse(readFileSync(resolve(scratch, 'guru-items-full.json'), 'utf8')).map((r) => ({
  key: r.key,
  name: r.name,
  clean_name: r.clean_name,
  quality: r.quality === '' ? null : Number(r.quality),
  type: r.type,
  main_type: r.main_type,
  pools: parseList(r.pools),
  tags: parseList(r.tags) .filter((t) => t !== ','),
}));
writeFileSync(resolve(root, 'scripts/data/guru-items.json'), JSON.stringify(guru));

// 3) 别名表
const rows = JSON.parse(readFileSync(resolve(scratch, 'alias-raw.json'), 'utf8'))
  .map((r) => ({ row: r.r, id: r.id, name: r.name, parts: r.parts }));
const { aliases, unresolved } = resolveAliases(rows, names);
writeFileSync(resolve(root, 'scripts/data/aliases.json'), JSON.stringify({ aliases, unresolved }));

const count = (o) => Object.keys(o).length;
console.log('name counts', Object.fromEntries(Object.entries(names).map(([k, v]) => [k, count(v)])));
console.log('desc counts', Object.fromEntries(Object.entries(descriptions).map(([k, v]) => [k, count(v)])));
console.log('guru', guru.length, 'aliases', count(aliases), 'unresolved', unresolved.length);

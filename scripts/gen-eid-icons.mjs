// 把 EID（external item descriptions）描述里的 {{Token}} 解析成图标。
// 输入：EID 的 anm2 图集定义 + lua 里的 InlineIcons 表；输出：外置图标表 + token→格子映射。
// 只收录 codex.json 描述里实际出现的 token。
// 动态 token（{{CollectibleN}}/{{TrinketN}}/{{CardN}}/{{PillN}}）也预先取成格子，
// 页面端只查这张表，不必再拼 IPOS/卡牌映射。
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBlocks, cellOf, cardCellMap, pillCellMap } from './lib/atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EID = resolve(root, '.scratch/eid-master/External-Item-Descriptions-master');
const GFX = resolve(EID, 'resources/gfx');
const CELL = 48;      // 输出表格子边长
const PAD = 4;        // 小图标四周留白，避免放大到格子时溢出
const SCALE = 3;      // 像素放大倍数（nearest）
const COLS = 20;

// 1) anm2 → 动画帧表：[x, y, w, h]
function parseAnm(file) {
  const xml = readFileSync(resolve(GFX, file), 'utf8');
  const out = {};
  for (const block of xml.split(/<Animation Name="/).slice(1)) {
    const name = block.slice(0, block.indexOf('"'));
    const layer = block.split('<LayerAnimation LayerId="0"')[1] || '';
    out[name] = [...layer.matchAll(/XCrop="(\d+)" YCrop="(\d+)" Width="(\d+)" Height="(\d+)"/g)]
      .map(m => [+m[1], +m[2], +m[3], +m[4]]);
  }
  return out;
}
const inline = parseAnm('eid_inline_icons.anm2');
const players = parseAnm('eid_player_icons.anm2').Players;
const transforms = parseAnm('eid_transform_icons.anm2');

// 2) lua 表 → token 定义。行格式：["Name"] = {"Anim", frame, w, h [, left, top]}
const lua = readFileSync(resolve(EID, 'features/eid_data.lua'), 'utf8');
const frames = {};      // token → { sheet, frame:[x,y,w,h] }
for (const m of lua.matchAll(/\["([A-Za-z0-9_]+)"\]\s*=\s*\{"([A-Za-z0-9_]+)",\s*(\d+),\s*(\d+),\s*(\d+)/g)) {
  const [, token, anim, frame, w, h] = m;
  const f = inline[anim] && inline[anim][+frame];
  // 用 lua 里声明的显示尺寸；anm2 的帧裁剪框在某些动画上是合并后的整图
  if (f) frames[token] = { sheet: 'inline', f: [f[0], f[1], +w, +h] };
}
// 简写别名（eid_data.lua 698–706 行，取 Repentance 版本）
for (const suffix of ['Damage', 'Speed', 'Tears', 'Range', 'Shotspeed', 'Luck', 'AngelChance', 'DevilChance', 'Tearsize']) {
  if (frames[suffix + 'REP']) frames[suffix] = frames[suffix + 'REP'];
}
// 变身图标（Guppy / Leviathan …）来自 eid_transform_icons.anm2
for (const m of lua.matchAll(/\["([A-Za-z0-9_]+)"\]\s*=\s*\{"(Transformation[0-9A-Za-z]*)",\s*(\d+),\s*(\d+),\s*(\d+)/g)) {
  const f = transforms[m[2]] && transforms[m[2]][+m[3]];
  if (f) frames[m[1]] = { sheet: 'transform', f: [f[0], f[1], +m[4], +m[5]] };
}
for (const m of lua.matchAll(/\["(Player\d+)"\]\s*=\s*\{"Players",\s*(\d+),\s*(\d+),\s*(\d+)/g)) {
  const f = players[+m[2]];
  if (f) frames[m[1]] = { sheet: 'players', f: [f[0], f[1], +m[3], +m[4]] };
}

// 3) codex.json 里实际用到的 token
const codex = JSON.parse(readFileSync(resolve(root, 'public/data/codex.json'), 'utf8'));
const used = new Set();
for (const it of codex.items) {
  if (!it.desc) continue;
  for (const m of it.desc.matchAll(/\{\{(.*?)\}\}/g)) used.add(m[1]);
}

// 4) 动态道具 token → 现有道具图集里的格子
const blocks = readBlocks(readFileSync(resolve(root, 'index.html'), 'utf8'));
const IPOS = blocks['ipos-json'];
const ASHEET = JSON.parse(readFileSync(resolve(root, 'public/assets/manifest.json'), 'utf8'));
const cardCells = cardCellMap(), pillCells = pillCellMap();
function sheetFile(name) { return resolve(root, 'public/assets', ASHEET[name].file); }
// 返回裁剪源：{ file, box } 或 { sheet, cell }（后一种从成品图集里按格子取）
function itemCell(type, n) {
  if (type === 'Collectible') {
    const pos = IPOS.collectibles[String(n).padStart(3, '0')];
    return pos ? { sheet: 'item-collect', cell: cellOf(pos) } : null;
  }
  if (type === 'Trinket') {
    const pos = IPOS.trinkets[String(n).padStart(3, '0')];
    return pos ? { sheet: 'item-trinket', cell: cellOf(pos) } : null;
  }
  if (type === 'Card') {
    if (n >= 32 && n <= 39) return { sheet: 'item-runes', cell: n - 32 };
    return cardCells[n] != null ? { sheet: 'item-cards', cell: n - 1 } : null;
  }
  if (type === 'Pill') return pillCells[n] != null ? { sheet: 'item-pills', cell: n } : null;
  return null;
}

// 5) 组装图标表：同一帧只存一份。颜色标记 / CR / NoLB / Blank 是纯文本指令，不进图标表。
const SKIP = /^(Color[A-Za-z]+|Blink[A-Za-z]+|CR|NoLB|NoLineBreak|Blank|Indent|IND)$/;
const ITEM = /^(Collectible|Trinket|Card|Pill)(\d+)$/;
const cells = new Map();   // 源键 → cell
const map = {};            // token → { c, w, h }
const missing = [];
function addCell(key, w, h) {
  if (!cells.has(key)) cells.set(key, cells.size);
  return { c: cells.get(key), w, h };
}
for (const token of used) {
  if (SKIP.test(token)) continue;
  const im = token.match(ITEM);
  if (im) {
    const hit = itemCell(im[1], +im[2]);
    if (!hit) { missing.push(token); continue; }
    map[token] = addCell('item:' + hit.sheet + ':' + hit.cell, 32, 32);
    continue;
  }
  const hit = frames[token];
  if (!hit) { missing.push(token); continue; }
  const [x, y, w, h] = hit.f;
  map[token] = addCell(hit.sheet + ':' + x + ',' + y + ',' + w + ',' + h, w, h);
}

// 6) 拼图表子
const rows = Math.max(1, Math.ceil(cells.size / COLS));
const W = COLS * CELL, H = rows * CELL;
const composites = [];
for (const [key, cell] of cells) {
  let source, box, w, h;
  if (key.startsWith('item:')) {
    // item:item-collect:123 → 道具图集按 32px 格子取
    const [sheetName, cellNo] = key.split(':').slice(1);
    w = h = 32;
    source = sheetFile(sheetName);
    box = { left: (cellNo % ASHEET[sheetName].cols) * 32, top: Math.floor(cellNo / ASHEET[sheetName].cols) * 32, width: 32, height: 32 };
  } else {
    const [sheet, geom] = key.split(':');
    const file = sheet === 'transform' ? 'eid_transform_icons.png'
      : sheet === 'players' ? 'eid_player_icons.png' : 'eid_inline_icons.png';
    const [x, y, gw, gh] = geom.split(',').map(Number);
    [w, h] = [gw, gh];
    box = { left: x, top: y, width: gw, height: gh };
    source = resolve(GFX, file);
  }
  const avail = CELL - PAD * 2;
  const k = Math.min(SCALE, Math.floor(avail / Math.max(w, h)) || 1);
  const tw = Math.min(avail, w * k), th = Math.min(avail, h * k);
  const buf = await sharp(source)
    .extract(box)
    .resize(tw, th, { kernel: 'nearest' })
    .png().toBuffer();
  composites.push({
    input: buf,
    left: (cell % COLS) * CELL + Math.floor((CELL - tw) / 2),
    top: Math.floor(cell / COLS) * CELL + Math.floor((CELL - th) / 2),
  });
}
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(composites).webp({ lossless: true }).toFile(resolve(root, 'public/assets/eid-inline.webp'));

// 与 gen-assets 写出的 manifest.json 合并，保证页面里的 ASSETS 常量包含新图集
const manifestPath = resolve(root, 'public/assets/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest['eid-inline'] = { file: 'eid-inline.webp', cell: CELL, cols: COLS, rows, w: W, h: H };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

writeFileSync(resolve(root, 'public/data/eid-icons.json'), JSON.stringify(map));
console.log('eid icons', Object.keys(map).length, 'cells', cells.size, 'sheet', W + '×' + H,
  'unresolved', missing.length, missing.join(','), '| dynamic', [...used].filter(t => ITEM.test(t)).length);

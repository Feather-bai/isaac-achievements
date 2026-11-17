import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardCellMap, pillCellMap } from './lib/atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/assets');
mkdirSync(out, { recursive: true });

const SRC = resolve(root, 'scripts/data/atlas-src');
const RUNES = resolve(root, 'scripts/data/rune-images');
const GURU = resolve(root, '.scratch/guru-isaac.png');   // 40000×32 精灵表
const IPOS = JSON.parse(readFileSync(resolve(root, 'scripts/data/raw/blocks.json'), 'utf8'))['ipos-json'];

// 1) 成就图集：1280×2112 JPEG → 800×1320（40px/格，nearest）+ 256 色 PNG
await sharp(resolve(SRC, 'ach.jpg'))
  .resize(800, 1320, { kernel: 'nearest' })
  .png({ palette: true, colors: 256, compressionLevel: 9 })
  .toFile(resolve(out, 'atlas-ach.png'));

// 2) 道具 / 饰品：旧图集只有 640×1280（20×40）里被 IPOS 覆盖的区域。
//    IPOS 覆盖 C1–C732 与 T1–T189，按 IPOS 的实际行数裁掉尾部的空白行。
const collectRows = Math.max(...Object.values(IPOS.collectibles).map(p => Math.abs(p[1]) / 32)) + 1;
const trinketRows = Math.max(...Object.values(IPOS.trinkets).map(p => Math.abs(p[1]) / 32)) + 1;
await sharp(resolve(SRC, 'collect.png'))
  .extract({ left: 0, top: 0, width: 640, height: collectRows * 32 })
  .webp({ lossless: true }).toFile(resolve(out, 'item-collect.webp'));
await sharp(resolve(SRC, 'trinket.png'))
  .extract({ left: 0, top: 0, width: 640, height: trinketRows * 32 })
  .webp({ lossless: true }).toFile(resolve(out, 'item-trinket.webp'));

// 3) 通用：从 Guru 精灵表按 cell 号裁 32×32 并拼成网格，直接写文件
async function sheetFromCells(cells, cols, outFile) {
  const rows = Math.ceil(cells.length / cols);
  const tile = 32;
  const composites = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const buf = await sharp(GURU)
      .extract({ left: cell * tile, top: 0, width: tile, height: tile })
      .png()
      .toBuffer();
    composites.push({ input: buf, left: (i % cols) * tile, top: Math.floor(i / cols) * tile });
  }
  await sharp({
    create: { width: cols * tile, height: rows * tile, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).webp({ lossless: true }).toFile(outFile);
}

// 卡牌 1–97：Guru 的 909–1005 连续排布，按 20 列重排（32–39 保留空格）
const cardMap = cardCellMap();
const cardCells = [];
for (let id = 1; id <= 97; id++) cardCells.push(cardMap[id] ?? null);
await sharp({
  create: { width: 640, height: 160, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite(
  (await Promise.all(cardCells.map(async (cell, i) => {
    if (cell == null) return [];
    const buf = await sharp(GURU).extract({ left: cell * 32, top: 0, width: 32, height: 32 }).png().toBuffer();
    return [{ input: buf, left: (i % 20) * 32, top: Math.floor(i / 20) * 32 }];
  }))).flat()
).webp({ lossless: true }).toFile(resolve(out, 'item-cards.webp'));

// 胶囊 0–49
const pillMap = pillCellMap();
const pillCells = [];
for (let id = 0; id <= 49; id++) pillCells.push(pillMap[id]);
await sheetFromCells(pillCells, 10, resolve(out, 'item-pills.webp'));

// 符文 32–39：8 个 64×64 原图 → 32×32，横向 8 格
const runeFiles = [
  'Rune-32-Hagalaz.webp', 'Rune-33-Jera.webp', 'Rune-34-Ehwaz.webp', 'Rune-35-Dagaz.webp',
  'Rune-36-Ansuz.webp', 'Rune-37-Perthro.webp', 'Rune-38-Berkano.webp', 'Rune-39-Algiz.webp',
];
const runeBufs = [];
for (const f of runeFiles) {
  runeBufs.push(await sharp(resolve(RUNES, f)).resize(32, 32, { kernel: 'nearest' }).png().toBuffer());
}
await sharp({
  create: { width: 256, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite(runeBufs.map((input, i) => ({ input, left: i * 32, top: 0 })))
  .webp({ lossless: true }).toFile(resolve(out, 'item-runes.webp'));

// manifest（道具/饰品行数由 IPOS 实际覆盖范围决定）
const collectH = collectRows * 32;
const trinketH = trinketRows * 32;
const manifest = {
  version: '2026-11-16.1',
  'atlas-ach': { file: 'atlas-ach.png', cell: 40, cols: 20, rows: 33, w: 800, h: 1320 },
  'item-collect': { file: 'item-collect.webp', cell: 32, cols: 20, rows: collectRows, w: 640, h: collectH },
  'item-trinket': { file: 'item-trinket.webp', cell: 32, cols: 20, rows: trinketRows, w: 640, h: trinketH },
  'item-cards': { file: 'item-cards.webp', cell: 32, cols: 20, rows: 5, w: 640, h: 160 },
  'item-runes': { file: 'item-runes.webp', cell: 32, cols: 8, rows: 1, w: 256, h: 32 },
  'item-pills': { file: 'item-pills.webp', cell: 32, cols: 10, rows: 5, w: 320, h: 160 },
};
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('assets written', manifest['item-collect'], manifest['item-trinket']);

import { cellOf } from './atlas.mjs';

const NON_PICKUP = new Set([43, 61, 235, 587, 613, 620, 630, 648, 662, 666, 718]);
// Guru 缺 C59 / C656 两条，用同名道具补元数据
const INHERIT = new Map([[59, 'c34'], [656, 'c577']]);

const NO_PINYIN = () => ({ full: '', initials: '' });

// descriptions 表在真实数据里是 { id: {name, desc} }（Task 3 的 parseEidDescriptions），
// 但也兼容直接给字符串的调用方/测试夹具。
function descOf(table, id) {
  const d = table && table[id];
  if (!d) return '';
  return typeof d === 'string' ? d : d.desc || '';
}

export function buildCodex({ blocks, eid, guru, aliases, pinyin = NO_PINYIN }) {
  const ipos = blocks['ipos-json'];
  const guruByKey = new Map(guru.map(g => [g.key, g]));
  const items = [];

  // 道具 C1–C732（11 个空名不可拾取 ID 跳过 → 721 条）
  for (let id = 1; id <= 732; id++) {
    const name = eid.collectibles[id];
    if (!name || !name.trim() || NON_PICKUP.has(id)) continue;
    const pos = ipos.collectibles[String(id).padStart(3, '0')];
    if (!pos) continue;
    const meta = guruByKey.get('c' + id) || guruByKey.get(INHERIT.get(id)) || {};
    items.push({
      id, kind: 'collectible', sheet: 'item-collect', cell: cellOf(pos),
      name, en: meta.name || '', type: meta.type || meta.main_type || '',
      quality: meta.quality ?? null,
      pools: meta.pools || [], tags: meta.tags || [],
      desc: descOf(eid.descriptions.collectibles, id),
      wiki: '/wiki/C' + id,
    });
  }

  // 饰品 T1–T189（T47 空名跳过 → 188 条）
  for (let id = 1; id <= 189; id++) {
    const name = eid.trinkets[id];
    if (!name || !name.trim()) continue;
    const pos = ipos.trinkets[String(id).padStart(3, '0')];
    if (!pos) continue;
    const g = guruByKey.get('t' + id) || {};
    items.push({
      id, kind: 'trinket', sheet: 'item-trinket', cell: cellOf(pos),
      name, en: g.name || '', type: 'trinket', quality: g.quality ?? null,
      pools: g.pools || [], tags: g.tags || [],
      desc: descOf(eid.descriptions.trinkets, id), wiki: '/wiki/T' + id,
    });
  }

  // 卡牌 K1–K97（32–39 → 符文图集）
  // cell 是「目标图集内的格号」：item-cards.webp 按 id 1–97 顺序铺格（32–39 留空）→ id-1；
  // item-runes.webp 横向 8 格 → id-32。注意不要用 cardCellMap()，它给的是 Guru 精灵表坐标（909+）。
  for (let id = 1; id <= 97; id++) {
    const name = eid.cards[id];
    if (!name) continue;
    const isRune = id >= 32 && id <= 39;
    items.push({
      id, kind: 'card', sheet: isRune ? 'item-runes' : 'item-cards',
      cell: isRune ? id - 32 : id - 1,
      name, en: '', type: isRune ? 'rune' : 'tarot', quality: null,
      pools: [], tags: [], desc: descOf(eid.descriptions.cards, id), wiki: '/wiki/K' + id,
    });
  }

  // 胶囊 P1–P50（药效 ID 0–49）
  // cell 是 item-pills.webp 内的格号（10 列 × 5 行，按药效 0–49 顺序铺格）→ id。
  // 不要用 pillCellMap()，它给的是 Guru 精灵表坐标（1006+）。
  for (let id = 0; id <= 49; id++) {
    const name = eid.pills[id];
    if (!name) continue;
    items.push({
      id, kind: 'pill', sheet: 'item-pills', cell: id,
      name, en: '', type: 'pill', quality: null,
      pools: [], tags: [], desc: descOf(eid.descriptions.pills, id), wiki: '/wiki/P' + id,
    });
  }

  for (const item of items) {
    const p = pinyin(item.name);
    item.py = p.full;
    item.ini = p.initials;
  }

  return { version: '2026-11-16.1', items, aliases: aliases.aliases };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCodex } from '../lib/codex.mjs';

const blocks = {
  'ipos-json': {
    collectibles: { '004': [-96, -0], '059': [-128, -0], '269': [-0, -160], '656': [-64, -160] },
    trinkets: { '169': [-64, -0] },
    cards: {},
  },
  'data-json': [{ id: 1, wicon: 'collectibles', wicon_id: '4' }],
};
const eid = {
  collectibles: { 4: '柯吉猫的头', 59: '彼列之书', 269: '无头宝宝', 656: '达摩克里斯之剑' },
  trinkets: { 47: '', 169: '儿童涂鸦' },
  cards: { 36: '诸神符文', 40: '空白符文' },
  pills: { 0: '剧毒臭屁' },
  descriptions: { collectibles: { 4: '一只猫头。' }, trinkets: {}, cards: {}, pills: {} },
};
const guru = [
  { key: 'c4', name: 'Broken Modem', clean_name: '', quality: 2, type: 'passive', main_type: 'passive', pools: ['treasure'], tags: [] },
  { key: 'c269', name: 'Headless Baby', clean_name: '', quality: 1, type: 'passive', main_type: 'passive', pools: ['treasure'], tags: [] },
  { key: 'c34', name: 'The Book of Belial', clean_name: '', quality: 2, type: 'active', main_type: 'active', pools: ['devil'], tags: [] },
  { key: 't169', name: "Kid's Drawing", clean_name: '', quality: 1, type: 'passive', main_type: 'trinket', pools: [], tags: [] },
];
const aliases = { aliases: { 狗头: [{ kind: 'collectible', id: 4 }] }, unresolved: [] };

// 拼音桩：真实拼音由 gen-codex.mjs 注入（pinyin-pro）
const pinyin = (name) => ({
  full: name === '柯吉猫的头' ? 'kejimaodetou' : name,
  initials: name === '柯吉猫的头' ? 'kjmdt' : name,
});

test('buildCodex 产出道具/饰品/卡牌/胶囊四类', () => {
  const r = buildCodex({ blocks, eid, guru, aliases, pinyin });
  const kinds = r.items.reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {});
  assert.equal(kinds.collectible, 4);   // 4 / 59 / 269 / 656
  assert.equal(kinds.trinket, 1);       // T47 空名被跳过
  assert.equal(kinds.card, 2);
  assert.equal(kinds.pill, 1);
});

test('buildCodex 计算格子、wiki、拼音', () => {
  const r = buildCodex({ blocks, eid, guru, aliases, pinyin });
  const c4 = r.items.find(i => i.kind === 'collectible' && i.id === 4);
  assert.equal(c4.cell, 3);
  assert.equal(c4.wiki, '/wiki/C4');
  assert.equal(c4.py, 'kejimaodetou');
  assert.equal(c4.ini, 'kjmdt');
  assert.equal(c4.en, 'Broken Modem');
  assert.equal(c4.quality, 2);
  assert.equal(c4.desc, '一只猫头。');
});

test('buildCodex 的 C59 继承 C34 元数据', () => {
  const r = buildCodex({ blocks, eid, guru, aliases, pinyin });
  const c59 = r.items.find(i => i.kind === 'collectible' && i.id === 59);
  assert.equal(c59.name, '彼列之书');
  assert.equal(c59.quality, 2);
  assert.equal(c59.en, 'The Book of Belial');
});

test('buildCodex 卡牌 32–39 指向符文图集', () => {
  const r = buildCodex({ blocks, eid, guru, aliases, pinyin });
  const rune = r.items.find(i => i.kind === 'card' && i.id === 36);
  assert.equal(rune.sheet, 'item-runes');
  assert.equal(rune.cell, 4);
  assert.equal(rune.type, 'rune');
});

test('buildCodex 胶囊使用 pills 图集', () => {
  const r = buildCodex({ blocks, eid, guru, aliases, pinyin });
  const p = r.items.find(i => i.kind === 'pill' && i.id === 0);
  assert.equal(p.sheet, 'item-pills');
  assert.equal(p.cell, 0);
});

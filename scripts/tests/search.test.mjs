import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, searchExact, searchFuzzy, isSubsequence } from '../lib/search.mjs';

const items = [
  { id: 488, kind: 'collectible', name: '节拍器', en: 'Metronome', py: 'jiepaiqi', ini: 'jpq' },
  { id: 160, kind: 'collectible', name: '嗝屁猫的爪子', en: "Guppy's Paw", py: 'gepimaodezhuaizi', ini: 'gpmdz' },
  { id: 228, kind: 'collectible', name: '妈妈的菜刀', en: "Mom's Knife", py: 'mamadecaidao', ini: 'mmcd' },
  { id: 86, kind: 'collectible', name: '萌死戳的牙', en: "Steven", py: 'mengsichuodeya', ini: 'mscdy' },
  { id: 1, kind: 'collectible', name: '悲伤洋葱', en: 'Sad Onion', py: 'beishangyangcong', ini: 'bsyc' },
];
const aliases = { 小汽车: [{ kind: 'collectible', id: 488 }] };
const idx = buildSearchIndex(items, aliases);

test('精确：名称连续子串', () => {
  assert.deepEqual(searchExact(idx, '节拍').map(i => i.id), [488]);
});
test('精确：ID', () => {
  assert.deepEqual(searchExact(idx, '488').map(i => i.id), [488]);
});
test('精确：英文名不分大小写', () => {
  assert.deepEqual(searchExact(idx, 'metro').map(i => i.id), [488]);
});
test('精确：别名不进精确栏', () => {
  assert.deepEqual(searchExact(idx, '小汽车'), []);
});
test('模糊：别名', () => {
  assert.deepEqual(searchFuzzy(idx, '小汽车').map(i => i.id), [488]);
});
test('模糊：子序列 猫爪', () => {
  assert.deepEqual(searchFuzzy(idx, '猫爪').map(i => i.id), [160]);
});
test('模糊：子序列 妈刀', () => {
  assert.deepEqual(searchFuzzy(idx, '妈刀').map(i => i.id), [228]);
});
test('模糊：全拼', () => {
  assert.deepEqual(searchFuzzy(idx, 'jiepaiqi').map(i => i.id), [488]);
});
test('模糊：首字母', () => {
  assert.deepEqual(searchFuzzy(idx, 'jpq').map(i => i.id), [488]);
});
test('模糊：拼音错一字（编辑距离 1）', () => {
  assert.deepEqual(searchFuzzy(idx, 'jiepaiqz').map(i => i.id), [488]);
});
test('模糊：排除精确栏已有的结果', () => {
  const ex = new Set(searchExact(idx, '节拍').map(i => i.kind + ':' + i.id));
  assert.deepEqual(searchFuzzy(idx, '节拍', ex).map(i => i.id), []);
});
test('模糊：别的分类占用的 ID 不排除同名条目', () => {
  const mixed = buildSearchIndex(
    [...items, { id: 488, kind: 'trinket', name: '节拍饰品', en: '', py: 'jiepaishipin', ini: 'jpsp' }],
    {},
  );
  const ex = new Set(searchExact(mixed, '节拍器').map(i => i.kind + ':' + i.id));
  assert.equal(ex.has('collectible:488'), true);
  assert.equal(ex.has('trinket:488'), false);
  assert.deepEqual(searchFuzzy(mixed, '节拍', ex).map(i => i.kind + ':' + i.id), ['trinket:488']);
});
test('isSubsequence', () => {
  assert.equal(isSubsequence('猫爪', '嗝屁猫的爪子'), true);
  assert.equal(isSubsequence('爪猫', '嗝屁猫的爪子'), false);
});

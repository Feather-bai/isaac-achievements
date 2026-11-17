import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAliases } from '../lib/aliases.mjs';

const tables = {
  collectibles: { 4: '柯吉猫的头', 191: '3美元纸币', 249: '额外选择', 414: '更多选择', 81: '嗝屁猫', 86: '萌死戳的牙' },
  trinkets: { 4: '损坏的遥控器', 169: '儿童涂鸦' },
  cards: { 45: '反人类卡' },
  pills: {},
};

test('名称精确命中优先于 ID', () => {
  const rows = [{ id: 4, name: '柯吉猫的头', parts: ['狗头'] }];
  const r = resolveAliases(rows, tables);
  assert.deepEqual(r.aliases['狗头'], [{ kind: 'collectible', id: 4 }]);
  assert.equal(r.unresolved.length, 0);
});

test('名称命中饰品空间', () => {
  const rows = [{ id: 4, name: '损坏的遥控器', parts: ['破传'] }];
  const r = resolveAliases(rows, tables);
  assert.deepEqual(r.aliases['破传'], [{ kind: 'trinket', id: 4 }]);
});

test('名称未命中时按 ID 兜底到道具表', () => {
  const rows = [{ id: 81, name: '死猫', parts: ['九命猫'] }];
  const r = resolveAliases(rows, tables);
  assert.deepEqual(r.aliases['九命猫'], [{ kind: 'collectible', id: 81 }]);
});

test('自我指代被忽略（别称等于官方名）', () => {
  const rows = [{ id: 86, name: '萌死戳的牙', parts: ['萌死戳的牙'] }];
  const r = resolveAliases(rows, tables);
  assert.equal(r.aliases['萌死戳的牙'], undefined);
  assert.equal(r.unresolved.length, 0);
});

test('同一别名多目标去重', () => {
  const rows = [
    { id: 4, name: '柯吉猫的头', parts: ['狗头'] },
    { id: 4, name: '柯吉猫的头', parts: ['狗头'] },
  ];
  const r = resolveAliases(rows, tables);
  assert.equal(r.aliases['狗头'].length, 1);
});

test('名称首尾空格不影响匹配', () => {
  const rows = [{ id: 169, name: ' 儿童涂鸦 ', parts: ['猫片'] }];
  const r = resolveAliases(rows, tables);
  assert.deepEqual(r.aliases['猫片'], [{ kind: 'trinket', id: 169 }]);
});

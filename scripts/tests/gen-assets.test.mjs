import test from 'node:test';
import assert from 'node:assert/strict';
import { cardCellMap, pillCellMap } from '../lib/atlas.mjs';

test('卡牌格子映射（Guru 精灵表，统一 908 + id）', () => {
  const m = cardCellMap();
  assert.equal(m[1], 909);   // 愚者
  assert.equal(m[22], 930);  // 世界
  assert.equal(m[23], 931);  // 黑桃A（扑克牌行起点）
  assert.equal(m[31], 939);  // 小丑
  assert.equal(m[40], 948);  // 空白符文
  assert.equal(m[41], 949);  // 黑符文
  assert.equal(m[42], 950);  // 混沌卡
  assert.equal(m[55], 963);  // 符文碎片
  assert.equal(m[56], 964);  // 倒愚者
  assert.equal(m[78], 986);  // 红钥匙
  assert.equal(m[79], 987);  // 红桃Q
  assert.equal(m[80], 988);  // 万用牌
  assert.equal(m[81], 989);  // 以撒的魂石
  assert.equal(m[97], 1005); // 雅各与以扫的魂石
  assert.equal(m[32], undefined, '符文 32–39 不在卡牌图集（Guru 940–947 为空格）');
  assert.equal(m[39], undefined);
});

test('胶囊格子映射', () => {
  const m = pillCellMap();
  assert.equal(m[0], 1006);
  assert.equal(m[49], 1055);
});

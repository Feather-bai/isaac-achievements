import test from 'node:test';
import assert from 'node:assert/strict';
import { readBlocks, cellOf } from '../lib/atlas.mjs';

test('readBlocks 解析 JSON script 块', () => {
  const html = '<script type="application/json" id="pos-json">{"1":[-0,-0],"2":[-64,-0]}</script>';
  assert.deepEqual(readBlocks(html)['pos-json'], { '1': [-0, -0], '2': [-64, -0] });
});

test('cellOf 按 20 列换算格子', () => {
  assert.equal(cellOf([-0, -0]), 0);
  assert.equal(cellOf([-64, -0]), 2);
  assert.equal(cellOf([-0, -32]), 20);
  assert.equal(cellOf([-608, -32]), 39);
});

test('cellOf 支持 40px 格', () => {
  assert.equal(cellOf([-80, -40], 40, 20), 22);
});

test('readBlocks 对裸 base64 块返回原始字符串', () => {
  const html = '<script type="application/json" id="collect-b64">iVBORw0KGgo=</script>';
  assert.equal(readBlocks(html)['collect-b64'], 'iVBORw0KGgo=');
});

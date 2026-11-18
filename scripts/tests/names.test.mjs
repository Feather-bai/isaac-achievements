import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEidNames, parseEidDescriptions } from '../lib/names.mjs';

const NAMES = `
---------collectibles---------
local collectibles = {
    [C_ID .. 1] = "悲伤洋葱", -- The Sad Onion
    [C_ID .. 59] = "彼列之书",
}
---------trinkets---------
local trinkets = {
    [T_ID .. 47] = "",
    [T_ID .. 169] = "儿童涂鸦",
}
---------cards---------
local cards = {
    [Card_ID .. 40] = "空白符文",
}
---------pills---------
local pills = {
    [Pill_ID .. 0] = "剧毒臭屁",
}
`;

const REP_DESC = `
---------- Collectibles ----------
local repCollectibles={
	[2] = {"2", "内眼", "↓ 射速#一次发射3颗泪弹"}, -- The Inner Eye
}
---------- Trinkets ----------
local repTrinkets={
	[169] = {"169", "儿童涂鸦", "持有时算作1个嗝屁猫套装道具"}, -- Kid's Drawing
}
---------- Pills ----------
local repPills={
	[4] = {"3", "炸弹变钥匙", "交换炸弹和钥匙#金炸弹和金钥匙也会交换"}, -- Bombs are Key
	[9999] = {"", "金胶囊", "随机胶囊效果"}, -- Golden Pill
}
`;

test('parseEidNames 按无空格段头解析名称', () => {
  const r = parseEidNames(NAMES);
  assert.equal(r.collectibles[1], '悲伤洋葱');
  assert.equal(r.collectibles[59], '彼列之书');
  assert.equal(r.trinkets[169], '儿童涂鸦');
  assert.equal(r.trinkets[47], '');
  assert.equal(r.cards[40], '空白符文');
  assert.equal(r.pills[0], '剧毒臭屁');
});

test('parseEidDescriptions 解析三元组行，胶囊用第二项作 ID', () => {
  const d = parseEidDescriptions(REP_DESC);
  assert.equal(d.collectibles[2].name, '内眼');
  assert.equal(d.collectibles[2].desc, '↓ 射速\n一次发射3颗泪弹');
  assert.equal(d.trinkets[169].desc, '持有时算作1个嗝屁猫套装道具');
  assert.equal(d.pills[3].name, '炸弹变钥匙');
  assert.equal(d.pills[9999].name, '金胶囊');
});

test('parseEidDescriptions 解析 ab+ 位置表', () => {
  const lua = 'EID.descriptions[languageCode].collectibles={\n\t{"1", "悲伤洋葱", "↑ 射速+0.7"},\n}';
  const d = parseEidDescriptions(lua);
  assert.equal(d.collectibles[1].desc, '↑ 射速+0.7');
});

// rep+ 真实形态：小写表名 `local collectibles = {` 与 `local horsepills = {`。
const REP_PLUS_DESC = `
---------- Collectibles ----------

local collectibles = {
	[56] = { "56", "烦事柠檬", "留下一摊水迹#水迹每秒造成24点伤害#水迹在离开房间前持续存在"}, -- Lemon Mishap
}

---------- Pills ----------

local horsepills = {
	[20] = {"19", "传送胶囊", "将角色传送至特殊房间"}, -- Telepills
}
`;

test('parseEidDescriptions 中 rep+ 小写表覆盖先前的 ab+/rep 层', () => {
  const d = parseEidDescriptions(REP_DESC, REP_PLUS_DESC);
  assert.equal(d.collectibles[56].desc, '留下一摊水迹\n水迹每秒造成24点伤害\n水迹在离开房间前持续存在');
  assert.equal(d.pills[19].name, '传送胶囊');
  assert.equal(d.collectibles[2].name, '内眼');
});

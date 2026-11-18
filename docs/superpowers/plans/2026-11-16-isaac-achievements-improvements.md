# 以撒成就网站改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在独立副本 `D:\ai\workspace\work\isaac-achievements-v2` 中实现五项改进：首屏体积从 gzip 1.55 MB 降到约 0.65 MB、iOS 从 wiki 返回定位、四个标签页的道具图鉴、只改两处 wiki 链接、新增忏悔+ 成就 638–641。

**Architecture:** 保留「单文件 index.html + Cloudflare Pages Functions」结构。把内嵌 base64 图集移到 `public/assets/`（图片 + CSS background-position 裁剪），构建期用 `scripts/gen-assets.mjs` 生成图集、`scripts/gen-codex.mjs` 生成 `public/data/codex.json`。图鉴作为 index.html 内的一个新模块（样式 + UI + 搜索），首次打开时懒加载 JSON。构建脚本改为把 `public/*` 平铺到 `build/` 根目录。

**Tech Stack:** 原生 HTML/CSS/JS（无框架、无打包）、Node ESM 构建脚本（`sharp` 已在依赖中）、`pinyin-pro`、`node:test`（vitest 已被占用给 TS 单测，脚本单测用 node:test + `.mjs`）、Cloudflare Pages。

## Global Constraints

- **绝不部署**：不执行 `git push`、`wrangler pages deploy`、`npm run deploy`；不改 `wrangler.toml` 的 `name`。
- **不覆盖旧版本**：所有修改只发生在 `D:\ai\workspace\work\isaac-achievements-v2`；原目录 `D:\ai\workspace\work\isaac-achievements` 只读。
- **wiki 链接只改两处**：#253 `wlink` → `/wiki/C269`；#432 `wlink` → `/wiki/C656`。#603 金胶囊**不动**。
- **数据常量**：成就总数 641；图鉴条目：道具 721、饰品 188、卡牌 97、胶囊 50（合计 1056）；符文 32–39 只在符文图集中。以下数量已用脚本在原始数据上核实，不要改用设计稿里的 709/187。
- **图集尺寸**：成就图集 20 列 × 33 行（40px/格 → 800×1320）；道具/饰品/卡牌/胶囊 20 列（32px/格）；符文图集 8 列 1 行（32px/格）。
- **格子公式**：`cell = (|py| / 32) * 20 + (|px| / 32)`，其中 `[px, py]` 是该物品在 `IPOS` 中的负偏移坐标。
- **文件名即缓存键**：`public/assets/*` 只在内容变化时才改文件名；`public/data/codex.json` 内带 `version` 字段，service worker 按版本号失效。
- **不新增外部运行时依赖**：图鉴只读本站 `/assets/`、`/data/`，不发任何第三方请求。
- **中文文案**：所有用户可见文字沿用现有简体中文风格（「道具」「饰品」「胶囊」「卡牌·符文」「精确查找」「模糊搜索」）。

## Environment Note

`D:\ai\workspace\work\isaac-achievements` 没有 `.git`（用户直接从 GitHub 下载的工作副本）。Task 1 会把原目录复制成 v2；如果副本同样没有 `.git`，在 v2 里执行一次 `git init` + 首次提交，后续每个 Task 正常 `git commit`（这样每个任务都有可回滚的检查点）。不要给 v2 配置任何 remote，避免误推送。

---

## 文件结构总览

| 文件 | 新建/修改 | 职责 |
|---|---|---|
| `D:\ai\workspace\work\isaac-achievements-v2\` | 新建 | 工作副本 |
| `scripts/lib/atlas.mjs` | 新建 | 从 index.html 解析 JSON 块、计算图集格子、拼图集（纯函数） |
| `scripts/lib/names.mjs` | 新建 | 解析 EID `zh_cn.lua` 名称/描述（纯函数） |
| `scripts/lib/aliases.mjs` | 新建 | 别名表解析（名称优先、ID 兜底，纯函数） |
| `scripts/lib/search.mjs` | 新建 | 搜索索引与匹配逻辑（纯函数，index.html 与单测共用） |
| `scripts/gen-assets.mjs` | 新建 | 生成 6 个图集并写 `public/assets/manifest.json` |
| `scripts/gen-codex.mjs` | 新建 | 生成 `public/data/codex.json` |
| `scripts/patch-html.mjs` | 新建 | 只删除 index.html 里的 4 个图片块（`atlas-json`/`collect-b64`/`cards-b64`/`trinket-b64`）及对应常量行，写入 `const ASSETS = {...}`；**保留 `ipos-json`**（17.7 KB，奖励图标定位必需） |
| `scripts/build.mjs` | 修改 | `public/*` 平铺到 `build/` 根 |
| `scripts/tests/*.test.mjs` | 新建 | `node --test` 单测 |
| `scripts/data/eid-names.json` | 新建（生成物，入库） | EID 名称/描述快照，避免构建时联网 |
| `scripts/data/guru-items.json` | 新建（生成物，入库） | IsaacGuru 元数据快照（name/en/type/quality/pools/tags） |
| `scripts/data/aliases.json` | 新建（生成物，入库） | 已解析的别名映射 |
| `scripts/data/rune-images/*.webp` | 新建（生成物，入库） | 符文 32–39 的 64×64 原图（8 个） |
| `scripts/data/atlas-src/*.png` | 新建（生成物，入库） | 从旧 HTML 抽出的 4 个原始图集 + Guru 精灵表裁切 |
| `public/assets/*` | 新建（生成物，入库） | 提供给浏览器的图集 |
| `public/data/codex.json` | 新建（生成物，入库） | 图鉴数据 |
| `public/_headers` | 新建 | 缓存策略 |
| `public/sw.js` | 修改 | 预缓存图集/数据，network-first 页面 |
| `index.html` | 修改 | 数据块、图标裁剪、lint、iOS 返回、图鉴 UI、懒渲染、链接修改、638–641 |
| `README.md` | 修改 | 成就数 641、功能列表、数据来源 |

---

### Task 1: 创建 v2 工作副本与版本控制基线

**Files:**
- Create: `D:\ai\workspace\work\isaac-achievements-v2\`（整份复制）
- Create: `D:\ai\workspace\work\isaac-achievements-v2\.git\`（如原目录无 .git）

**Interfaces:**
- Consumes: 无
- Produces: v2 工作目录；`V2` 之后所有任务的根路径。

- [ ] **Step 1: 复核原目录确实没有 .git，且 v2 尚不存在**

Run:
```bash
test -d /d/ai/workspace/work/isaac-achievements/.git && echo "HAS GIT" || echo "NO GIT"
test -d /d/ai/workspace/work/isaac-achievements-v2 && echo "V2 EXISTS — STOP" || echo "V2 ABSENT"
```
Expected: `NO GIT` 和 `V2 ABSENT`。若 v2 已存在，停止并询问用户。

- [ ] **Step 2: 复制工作副本（排除 node_modules、build、.wrangler、.scratch 的运行产物）**

Run:
```bash
mkdir -p /d/ai/workspace/work/isaac-achievements-v2
cd /d/ai/workspace/work/isaac-achievements
tar -cf - --exclude=node_modules --exclude=build --exclude=.wrangler --exclude=.scratch | (cd /d/ai/workspace/work/isaac-achievements-v2 && tar -xf -)
mkdir -p /d/ai/workspace/work/isaac-achievements-v2/.scratch
cp -r /d/ai/workspace/work/isaac-achievements/.scratch/. /d/ai/workspace/work/isaac-achievements-v2/.scratch/
cd /d/ai/workspace/work/isaac-achievements-v2 && npm ci
```
Expected: `npm ci` 成功（sharp/hono/vitest 等安装完成）。

- [ ] **Step 3: 初始化本地 git（无 remote）**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git init
git add -A
git -c user.name="local" -c user.email="local@localhost" commit -m "chore: 导入 isaac-achievements 基线（v2 工作副本）"
git remote -v
```
Expected: 提交成功，`git remote -v` 输出为空。

- [ ] **Step 4: 确认基线可构建、测试可跑**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && npm test
```
Expected: 现有 vitest 用例全部 PASS。

---

### Task 2: 抽出旧图集与原始数据为仓库内源文件

**Files:**
- Create: `scripts/lib/atlas.mjs`
- Create: `scripts/data/atlas-src/ach.jpg`, `collect.png`, `cards.png`, `trinket.png`
- Create: `scripts/data/raw/blocks.json`（`pos-json`/`ipos-json`/`data-json`/`user-icons`/`tainted-chars`/`tainted-map` 的解析结果，**不含** base64 图片块）
- Test: `scripts/tests/atlas-lib.test.mjs`

**Interfaces:**
- Produces:
  - `readBlocks(htmlText) -> Record<string, unknown>`：解析 `<script type="application/json" id="...">` 块并 JSON.parse。
  - `cellOf(pos, size = 32, cols = 20) -> number`：`cellOf([-64,-0]) === 2`。
  - `extractDataUris(blocks) -> void`（脚本内用，写文件）。
  - `blocks` 的 JSON 快照供后续任务离线使用。

- [ ] **Step 1: 写失败测试**

Create `scripts/tests/atlas-lib.test.mjs`:
```js
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
  assert.equal(cellOf([-80, -40], 40, 20), 21);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/atlas-lib.test.mjs`
Expected: FAIL，`Cannot find module '../lib/atlas.mjs'`。

- [ ] **Step 3: 实现 `scripts/lib/atlas.mjs`**

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function readBlocks(html) {
  const out = {};
  const re = /<script type="application\/json" id="([^"]+)">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out[m[1]] = JSON.parse(m[2]);
  return out;
}

export function cellOf(pos, size = 32, cols = 20) {
  const px = Math.abs(pos[0]);
  const py = Math.abs(pos[1]);
  return (py / size) * cols + px / size;
}

export function cellXY(cell, cols = 20) {
  return { col: cell % cols, row: Math.floor(cell / cols) };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/atlas-lib.test.mjs`
Expected: 3 tests PASS。

- [ ] **Step 5: 抽出原始数据块与图集图片**

Create `scripts/extract-sources.mjs`:
```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBlocks } from './lib/atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const blocks = readBlocks(html);

mkdirSync(resolve(root, 'scripts/data/raw'), { recursive: true });
mkdirSync(resolve(root, 'scripts/data/atlas-src'), { recursive: true });

const keep = ['pos-json', 'ipos-json', 'data-json', 'user-icons', 'tainted-chars', 'tainted-map'];
const snap = Object.fromEntries(keep.map(k => [k, blocks[k]]));
writeFileSync(resolve(root, 'scripts/data/raw/blocks.json'), JSON.stringify(snap));

const imgs = {
  'ach.jpg': blocks['atlas-json'],
  'collect.png': blocks['collect-b64'],
  'cards.png': blocks['cards-b64'],
  'trinket.png': blocks['trinket-b64'],
};
for (const [file, b64] of Object.entries(imgs)) {
  writeFileSync(resolve(root, 'scripts/data/atlas-src', file), Buffer.from(b64, 'base64'));
}
console.log('ok');
```

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node scripts/extract-sources.mjs
ls -la scripts/data/atlas-src scripts/data/raw
```
Expected: 4 个图片文件（ach.jpg ≈ 1.5 MB，collect.png ≈ 191 KB，cards.png ≈ 19 KB，trinket.png ≈ 57 KB）与 `blocks.json`。

- [ ] **Step 6: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add scripts/lib/atlas.mjs scripts/tests/atlas-lib.test.mjs scripts/extract-sources.mjs scripts/data
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(scripts): 抽出旧图集与数据块快照，新增图集格子工具"
```

---

### Task 3: 建立 EID / IsaacGuru / 别名表数据快照

**Files:**
- Create: `scripts/lib/names.mjs`
- Create: `scripts/lib/aliases.mjs`
- Create: `scripts/data/eid-names.json`
- Create: `scripts/data/guru-items.json`
- Create: `scripts/data/aliases.json`
- Test: `scripts/tests/names.test.mjs`, `scripts/tests/aliases.test.mjs`

**Interfaces:**
- Produces:
  - `parseEidNames(luaText) -> { collectibles: Record<number,string>, trinkets, cards, pills }`
  - `parseEidDescriptions(...luaTexts) -> { collectibles: Record<number,{name,desc}>, trinkets, cards, pills }`（后传入的文件覆盖前者，按 `ab+ → rep → rep+` 顺序合并）
  - `resolveAliases(rows, nameTables) -> { aliases: Record<string, {kind,id}[]>, unresolved: Row[] }`
  - `scripts/data/guru-items.json: Array<{key,name,clean_name,quality,type,main_type,pools,tags}>`

> **实测格式（必须按此实现，旧稿的 `--- collectibles ---` 写法是错的）**：
> - 名称文件 `names/zh_cn.lua`：段头是 `---------collectibles---------` 这类**无空格、六段连字符**的行；条目形如 `[C_ID .. 1] = "悲伤洋葱"`。
> - 描述文件 `rep/zh_cn.lua` / `rep+/zh_cn.lua`：段头是 `---------- Collectibles ----------`（有空格），表体是 `local repCollectibles={ [2] = {"2", "内眼", "描述#换行#…"}, … }` —— 行键是物品 ID，第二项才是描述 ID（胶囊两者不同）。`#` 是换行符。
> - 旧文件 `ab+/zh_cn.lua`：位置表 `EID.descriptions[languageCode].collectibles={ {"1","悲伤洋葱","↑ 射速…"}, … }`。
> - 合并后每类都有名称与描述：道具 732（11 个空名）、饰品 189（T47 空名）、卡牌 97、胶囊 51（含 9999 金胶囊）。图鉴再按 IPOS 过滤，见 Task 5。

- [ ] **Step 1: 写失败测试**

Create `scripts/tests/names.test.mjs`:
```js
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
```

Create `scripts/tests/aliases.test.mjs`:
```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/names.test.mjs scripts/tests/aliases.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `scripts/lib/names.mjs`**

```js
// 解析 EID zh_cn.lua。名称文件用 `---------kind---------` 段头；描述文件用
// `---------- Kind ----------` 段头 + `local xxxKind={ [id] = {"descId","名","描述#换行"} }`，
// 旧版 ab+ 则是位置表 `EID.descriptions[languageCode].kind={ {"id","名","描述"}, ... }`。

function splitSections(text) {
  const out = {};
  let cur = null;
  let buf = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-{5,}\s*(.+?)\s*-{5,}\s*$/);
    if (m) {
      if (cur) out[cur.toLowerCase()] = buf.join('\n');
      cur = m[1];
      buf = [];
    } else if (cur) buf.push(line);
  }
  if (cur) out[cur.toLowerCase()] = buf.join('\n');
  return out;
}

function findSection(secs, prefix) {
  const hit = Object.entries(secs).find(([k]) => k.startsWith(prefix));
  return hit ? hit[1] : '';
}

const KIND_PREFIX = {
  collectibles: 'collectible',
  trinkets: 'trinket',
  cards: 'card',
  pills: 'pill',
};

export function parseEidNames(lua) {
  const secs = splitSections(lua);
  const out = { collectibles: {}, trinkets: {}, cards: {}, pills: {} };
  for (const [kind, prefix] of Object.entries(KIND_PREFIX)) {
    const re = new RegExp('\\[(C_ID|T_ID|Card_ID|Pill_ID)\\s*\\.\\.\\s*(\\d+)\\]\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"', 'g');
    let m;
    while ((m = re.exec(findSection(secs, prefix)))) {
      out[kind][Number(m[2])] = m[3].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }
  return out;
}

const clean = (s) => s.replace(/\\n/g, '\n').replace(/\\"/g, '"');

export function parseEidDescriptions(...luaTexts) {
  const out = { collectibles: {}, trinkets: {}, cards: {}, pills: {} };
  for (const lua of luaTexts) {
    // 新的 rep / rep+ 表：local repCollectibles={ [id] = {"descId", "名", "描述"}, ... }
    const tableRe = /local\s+[A-Za-z]*?(Collectibles|Trinkets|Cards|Pills)\s*=\s*\{([\s\S]*?)\n\}/g;
    let t;
    while ((t = tableRe.exec(lua))) {
      const kind = t[1].toLowerCase();
      const rowRe = /^\s*\[(\d+)\]\s*=\s*\{\s*"([^"]*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/gm;
      let r;
      while ((r = rowRe.exec(t[2]))) {
        out[kind][Number(r[2] || r[1])] = { name: clean(r[3]), desc: clean(r[4]) };
      }
    }
    // 旧版 ab+ 位置表：EID.descriptions[languageCode].collectibles={ {"id", "名", "描述"}, ... }
    const posRe = /EID\.descriptions\[languageCode\]\.(collectibles|trinkets|cards|pills)\s*=\s*\{([\s\S]*?)\n\}/g;
    let p;
    while ((p = posRe.exec(lua))) {
      const kind = p[1];
      const rowRe = /\{\s*"(\d+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
      let r;
      while ((r = rowRe.exec(p[2]))) {
        const id = Number(r[1]);
        if (!out[kind][id]) out[kind][id] = { name: clean(r[2]), desc: clean(r[3]) };
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: 实现 `scripts/lib/aliases.mjs`**

```js
const SPACES = [
  ['collectibles', 'collectible'],
  ['trinkets', 'trinket'],
  ['cards', 'card'],
  ['pills', 'pill'],
];

// 表格 id 列混用四个 ID 空间，故先按「名称」在各空间精确匹配，未命中再按 ID 兜底到道具表。
export function resolveAliases(rows, tables) {
  const aliases = {};
  const unresolved = [];
  const add = (alias, kind, id) => {
    const list = (aliases[alias] ||= []);
    if (!list.some((x) => x.kind === kind && x.id === id)) list.push({ kind, id });
  };

  for (const row of rows) {
    const id = Number(row.id);
    const want = String(row.name || '').trim();
    let resolved = null;
    for (const [space, kind] of SPACES) {
      const name = (tables[space] || {})[id];
      if (name && name.trim() === want) { resolved = { kind, id }; break; }
    }
    if (!resolved && (tables.collectibles || {})[id]?.trim()) resolved = { kind: 'collectible', id };
    if (!resolved) { unresolved.push(row); continue; }
    for (const alias of row.parts || []) {
      if (!alias || alias === row.name) continue;
      add(alias, resolved.kind, resolved.id);
    }
  }
  return { aliases, unresolved };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/names.test.mjs scripts/tests/aliases.test.mjs`
Expected: 9 tests PASS（names 3 + aliases 6）。

- [ ] **Step 6: 生成三个数据快照**

Create `scripts/snapshot-data.mjs`:
```js
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
```

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node scripts/snapshot-data.mjs
```
Expected（已实测）：
```
name counts { collectibles: 732, trinkets: 189, cards: 97, pills: 51 }
desc counts { collectibles: 732, trinkets: 189, cards: 97, pills: 51 }
guru 1146 aliases 178 unresolved 0
```
若 `unresolved` 非 0 或名称数量不足，停止并检查解析器，不要用空映射继续。

- [ ] **Step 7: 校验快照关键条目**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node -e "
const e=require('./scripts/data/eid-names.json'), a=require('./scripts/data/aliases.json');
const must=[['collectibles',59,'彼列之书'],['collectibles',269,'无头宝宝'],['collectibles',656,'达摩克里斯之剑'],['trinkets',169,'儿童涂鸦'],['cards',40,'空白符文']];
for(const [k,id,n] of must){ if(e[k][id]!==n) throw new Error(k+' '+id+': got '+e[k][id]); }
if(!e.descriptions.collectibles[488]) throw new Error('missing desc 488');
if(!a.aliases['小汽车']) throw new Error('missing 小汽车');
if(!a.aliases['狗头']) throw new Error('missing 狗头');
if(!a.aliases['猫片']) throw new Error('missing 猫片');
console.log('OK', Object.keys(a.aliases).length, 'aliases');
"
```
Expected: `OK 178 aliases`（±2）。注意「妈刀」「猫爪」**不在**别名表里 —— 它们由子序列匹配覆盖（「妈…刀」出现在「妈妈的菜刀」中、「猫…爪」出现在「嗝屁猫的爪子」中），不要在这条校验里断言别名表包含它们。

- [ ] **Step 8: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add scripts/lib scripts/tests scripts/snapshot-data.mjs scripts/data/eid-names.json scripts/data/guru-items.json scripts/data/aliases.json
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(scripts): 建立 EID/Guru/别名数据快照与解析器"
```

---

### Task 4: 图集生成器（成就 / 道具 / 饰品 / 卡牌 / 符文 / 胶囊）

**Files:**
- Create: `scripts/gen-assets.mjs`
- Create: `scripts/data/rune-images/`（8 个 64×64 webp，从 `.scratch/guru-decoded/` 复制）
- Create: `public/assets/manifest.json`（生成物）
- Test: `scripts/tests/gen-assets.test.mjs`

**Interfaces:**
- Produces `public/assets/manifest.json`（行数由 IPOS 实际覆盖范围决定，下面是一次典型生成结果）:
```json
{
  "version": "2026-11-16.1",
  "atlas-ach":   { "file": "atlas-ach.png",   "cell": 40, "cols": 20, "rows": 33, "w": 800, "h": 1320 },
  "item-collect":{ "file": "item-collect.webp","cell": 32, "cols": 20, "rows": 37, "w": 640, "h": 1184 },
  "item-trinket":{ "file": "item-trinket.webp","cell": 32, "cols": 20, "rows": 10, "w": 640, "h": 320 },
  "item-cards":  { "file": "item-cards.webp",  "cell": 32, "cols": 20, "rows": 5,  "w": 640, "h": 160 },
  "item-runes":  { "file": "item-runes.webp",  "cell": 32, "cols": 8,  "rows": 1,  "w": 256, "h": 32 },
  "item-pills":  { "file": "item-pills.webp",  "cell": 32, "cols": 10, "rows": 5,  "w": 320, "h": 160 }
}
```

- [ ] **Step 1: 写失败测试（纯函数部分）**

Create `scripts/tests/gen-assets.test.mjs`:
```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/gen-assets.test.mjs`
Expected: FAIL（`cardCellMap is not a function`）。

- [ ] **Step 3: 在 `scripts/lib/atlas.mjs` 追加映射函数**

```js
// Guru 精灵表里卡牌 1–97 是连续排列的：cell = 908 + id
// （1→909 愚者 … 22→930 世界，23→931 黑桃A … 31→939 小丑，40→948 空白符文，
//   41→949 黑符文，... 97→1005 雅各与以扫魂石）。唯一例外是符文 32–39：
//   Guru 的 940–947 是空格，符文图来自 scripts/data/rune-images/。
export function cardCellMap() {
  const m = {};
  for (let id = 1; id <= 97; id++) {
    if (id >= 32 && id <= 39) continue;
    m[id] = 908 + id;
  }
  return m;
}

export function pillCellMap() {
  const m = {};
  for (let id = 0; id <= 49; id++) m[id] = 1006 + id;
  return m;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/gen-assets.test.mjs`
Expected: 2 tests PASS。

- [ ] **Step 5: 准备符文原图**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
mkdir -p scripts/data/rune-images
cp .scratch/guru-decoded/Rune-32-Hagalaz.webp .scratch/guru-decoded/Rune-33-Jera.webp .scratch/guru-decoded/Rune-34-Ehwaz.webp .scratch/guru-decoded/Rune-35-Dagaz.webp .scratch/guru-decoded/Rune-36-Ansuz.webp .scratch/guru-decoded/Rune-37-Perthro.webp .scratch/guru-decoded/Rune-38-Berkano.webp .scratch/guru-decoded/Rune-39-Algiz.webp scripts/data/rune-images/
ls scripts/data/rune-images
```
Expected: 8 个 webp。

- [ ] **Step 6: 实现 `scripts/gen-assets.mjs`**

```js
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardCellMap, pillCellMap, cellOf } from './lib/atlas.mjs';

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
```

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node scripts/gen-assets.mjs && ls -la public/assets
```
Expected: 6 个图集 + manifest.json；`atlas-ach.png` 约 350–420 KB，`item-cards.webp` 含 97 格。

- [ ] **Step 7: 目检图集**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node -e "
const sharp=require('sharp');
(async()=>{
 for (const f of ['atlas-ach.png','item-cards.webp','item-pills.webp','item-runes.webp']) {
   const b=await sharp('public/assets/'+f).resize({width:Math.min(1200, (await sharp('public/assets/'+f).metadata()).width*2), kernel:'nearest'}).png().toFile('outputs-check-'+f.replace(/\.\w+$/,'.png'));
   console.log('wrote', b);
 }
})();
"
```
打开 `outputs-check-item-cards.png`，确认：第 1 格是愚者、第 22 格是世界、第 32 格（索引 31）为空、第 40 格是空白符文、第 81 格是以撒魂石。打开 `outputs-check-item-pills.png` 确认 50 个胶囊图案各不相同。打开 `outputs-check-item-runes.png` 确认 8 个符文图案（不是空白/塔罗牌）。

- [ ] **Step 8: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add scripts/gen-assets.mjs scripts/lib/atlas.mjs scripts/tests/gen-assets.test.mjs scripts/data/rune-images public/assets
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(assets): 生成外置图集并修正卡牌/符文/胶囊图标"
```

---

### Task 5: 图鉴数据生成（codex.json）

**Files:**
- Create: `scripts/lib/codex.mjs`
- Create: `scripts/gen-codex.mjs`
- Create: `public/data/codex.json`
- Test: `scripts/tests/codex.test.mjs`

**Interfaces:**
- Produces `public/data/codex.json`:
```json
{
  "version": "2026-11-16.1",
  "items": [
    { "id": 488, "kind": "collectible", "sheet": "item-collect", "cell": 42,
      "name": "节拍器", "en": "Metronome", "type": "active", "quality": 1,
      "pools": ["treasure","greedShop","craneGame"], "tags": ["offensive"],
      "desc": "使用后……", "wiki": "/wiki/C488", "py": "jiepaiqi", "ini": "jpq" }
  ],
  "aliases": { "小汽车": [{ "kind": "collectible", "id": 488 }] }
}
```
- Produces `buildCodex({blocks, eid, guru, aliases}) -> {version, items, aliases}`（纯函数，供单测）。

- [ ] **Step 1: 写失败测试**

Create `scripts/tests/codex.test.mjs`:
```js
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

test('buildCodex 产出道具/饰品/卡牌/胶囊四类', () => {
  const r = buildCodex({ blocks, eid, guru, aliases });
  const kinds = r.items.reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {});
  assert.equal(kinds.collectible, 4);   // 4 / 59 / 269 / 656
  assert.equal(kinds.trinket, 1);       // T47 空名被跳过
  assert.equal(kinds.card, 2);
  assert.equal(kinds.pill, 1);
});

test('buildCodex 计算格子、wiki、拼音', () => {
  const r = buildCodex({ blocks, eid, guru, aliases });
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
  const r = buildCodex({ blocks, eid, guru, aliases });
  const c59 = r.items.find(i => i.kind === 'collectible' && i.id === 59);
  assert.equal(c59.name, '彼列之书');
  assert.equal(c59.quality, 2);
  assert.equal(c59.en, 'The Book of Belial');
});

test('buildCodex 卡牌 32–39 指向符文图集', () => {
  const r = buildCodex({ blocks, eid, guru, aliases });
  const rune = r.items.find(i => i.kind === 'card' && i.id === 36);
  assert.equal(rune.sheet, 'item-runes');
  assert.equal(rune.cell, 4);
  assert.equal(rune.type, 'rune');
});

test('buildCodex 胶囊使用 pills 图集', () => {
  const r = buildCodex({ blocks, eid, guru, aliases });
  const p = r.items.find(i => i.kind === 'pill' && i.id === 0);
  assert.equal(p.sheet, 'item-pills');
  assert.equal(p.cell, 0);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/codex.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `scripts/lib/codex.mjs`**

```js
import { cellOf, cardCellMap, pillCellMap } from './atlas.mjs';

const NON_PICKUP = new Set([43, 61, 235, 587, 613, 620, 630, 648, 662, 666, 718]);
// Guru 缺 C59 / C656 两条，用同名道具补元数据
const INHERIT = new Map([[59, 'c34'], [656, 'c577']]);

export function buildCodex({ blocks, eid, guru, aliases, pinyin }) {
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
      name, en: meta.name || '', type: meta.main_type || meta.type || '',
      quality: meta.quality ?? null,
      pools: meta.pools || [], tags: meta.tags || [],
      desc: eid.descriptions.collectibles[id] || '',
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
      desc: eid.descriptions.trinkets[id] || '', wiki: '/wiki/T' + id,
    });
  }

  // 卡牌 K1–K97（32–39 → 符文图集）
  const cardMap = cardCellMap();
  for (let id = 1; id <= 97; id++) {
    const name = eid.cards[id];
    if (!name) continue;
    const isRune = id >= 32 && id <= 39;
    items.push({
      id, kind: 'card', sheet: isRune ? 'item-runes' : 'item-cards',
      cell: isRune ? id - 32 : cardMap[id],
      name, en: '', type: isRune ? 'rune' : 'tarot', quality: null,
      pools: [], tags: [], desc: eid.descriptions.cards[id] || '', wiki: '/wiki/K' + id,
    });
  }

  // 胶囊 P1–P50（药效 ID 0–49）
  const pillMap = pillCellMap();
  for (let id = 0; id <= 49; id++) {
    const name = eid.pills[id];
    if (!name) continue;
    items.push({
      id, kind: 'pill', sheet: 'item-pills', cell: pillMap[id],
      name, en: '', type: 'pill', quality: null,
      pools: [], tags: [], desc: eid.descriptions.pills[id] || '', wiki: '/wiki/P' + id,
    });
  }

  for (const item of items) {
    const p = pinyin(item.name);
    item.py = p.full;
    item.ini = p.initials;
  }

  return { version: '2026-11-16.1', items, aliases: aliases.aliases };
}
```

- [ ] **Step 4: 实现 `scripts/gen-codex.mjs`（含拼音）**

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';
import { buildCodex } from './lib/codex.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blocks = JSON.parse(readFileSync(resolve(root, 'scripts/data/raw/blocks.json'), 'utf8'));
const eid = JSON.parse(readFileSync(resolve(root, 'scripts/data/eid-names.json'), 'utf8'));
const guru = JSON.parse(readFileSync(resolve(root, 'scripts/data/guru-items.json'), 'utf8'));
const aliases = JSON.parse(readFileSync(resolve(root, 'scripts/data/aliases.json'), 'utf8'));

function py(name) {
  const full = pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/\s+/g, '');
  const initials = pinyin(name, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').replace(/\s+/g, '');
  return { full, initials };
}

const codex = buildCodex({ blocks, eid, guru, aliases, pinyin: py });
const json = JSON.stringify(codex);
mkdirSync(resolve(root, 'public/data'), { recursive: true });
writeFileSync(resolve(root, 'public/data/codex.json'), json);

const byKind = codex.items.reduce((a, i) => (a[i.kind] = (a[i.kind] || 0) + 1, a), {});
console.log(byKind, 'bytes', json.length, 'aliases', Object.keys(codex.aliases).length);
const noPools = codex.items.filter(i => i.kind === 'collectible' && i.quality == null);
console.log('collectibles without quality:', noPools.map(i => i.id));
```

- [ ] **Step 5: 安装 pinyin-pro 并运行测试**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && npm install --save-dev pinyin-pro@^3
node --test scripts/tests/codex.test.mjs
```
Expected: 5 tests PASS。

- [ ] **Step 6: 生成 codex.json 并核对数量**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node scripts/gen-codex.mjs
```
Expected: `{ collectible: 721, trinket: 188, card: 97, pill: 50 }`，`collectibles without quality: []`（C59 / C656 通过 `INHERIT` 继承 C34 / C577 的品质），文件大小 300–400 KB。

> 数量推导：EID 名称表 T1–T189 共 189 条，其中 **T47 是空名**（不可拾取），因此饰品图鉴条目是 **188** 条，与 Guru 的 188 条 t 条目一致。道具同理：C1–C732 名称表中 11 个空名（43、61、235、587、613、620、630、648、662、666、718）被 `NON_PICKUP` 跳过，剩 **721** 条。

- [ ] **Step 7: 抽查图鉴内容**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node -e "
const c=require('./public/data/codex.json');
const f=(k,id)=>c.items.find(i=>i.kind===k&&i.id===id);
for(const [k,id] of [['collectible',488],['collectible',269],['collectible',656],['trinket',169],['card',40],['card',36],['pill',0],['pill',49]]) {
  const i=f(k,id); console.log(k,id,i&&i.name,i&&i.sheet,i&&i.cell,i&&i.py,i&&i.quality);
}
console.log('aliases', Object.keys(c.aliases).length);
"
```
Expected: 节拍器 / 无头宝宝 / 达摩克里斯之剑 / 儿童涂鸦 / 空白符文 / 某符文 / 剧毒臭屁 / 实验性胶囊，sheet 与 cell 均存在，拼音非空。

- [ ] **Step 8: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add scripts/lib/codex.mjs scripts/gen-codex.mjs scripts/tests/codex.test.mjs public/data/codex.json package.json package-lock.json
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(codex): 生成道具图鉴数据 codex.json（含拼音与别名）"
```

---

### Task 6: 搜索匹配库（精确 / 模糊）

**Files:**
- Create: `scripts/lib/search.mjs`（浏览器与 Node 共用的纯函数，ESM）
- Test: `scripts/tests/search.test.mjs`

**Interfaces:**
- Produces:
  - `buildSearchIndex(items, aliases) -> IndexedItem[]`，`IndexedItem = Item & { _name, _en, _alias: string[] }`
  - `searchExact(index, q) -> IndexedItem[]`：q 是名称/英文名/ID 的连续子串（别名**不**进精确栏）
  - `searchFuzzy(index, q, excludeKeys) -> IndexedItem[]`：别名、子序列、拼音（全拼/首字母）、拼音编辑距离 ≤1；`excludeKeys` 是 `Set<'kind:id'>`（不是纯 ID，因为不同分类的 ID 会重复）
  - `isSubsequence(q, text) -> boolean`

- [ ] **Step 1: 写失败测试**

Create `scripts/tests/search.test.mjs`:
```js
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
    [...items, { id: 488, kind: 'trinket', name: '测试饰品', en: '', py: 'ceshishipin', ini: 'cssp' }],
    {},
  );
  const ex = new Set(searchExact(mixed, '488').map(i => i.kind + ':' + i.id));
  assert.equal(ex.has('collectible:488'), true);
  assert.equal(ex.has('trinket:488'), false);
});
test('isSubsequence', () => {
  assert.equal(isSubsequence('猫爪', '嗝屁猫的爪子'), true);
  assert.equal(isSubsequence('爪猫', '嗝屁猫的爪子'), false);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/search.test.mjs`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `scripts/lib/search.mjs`**

```js
export function isSubsequence(q, text) {
  let i = 0;
  for (const ch of text) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return q.length === 0;
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const isAscii = s => /^[\x00-\x7f]+$/.test(s);

export function buildSearchIndex(items, aliases) {
  const byTarget = new Map();
  for (const [alias, list] of Object.entries(aliases || {})) {
    for (const { kind, id } of list) {
      const key = kind + ':' + id;
      if (!byTarget.has(key)) byTarget.set(key, []);
      byTarget.get(key).push(alias);
    }
  }
  return items.map(it => {
    const aliasList = byTarget.get(it.kind.replace(/s$/, '') + ':' + it.id) || [];
    return Object.assign({}, it, {
      _name: String(it.name || '').toLowerCase(),
      _en: String(it.en || '').toLowerCase(),
      _alias: aliasList,
    });
  });
}

export function searchExact(index, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return [];
  return index.filter(it =>
    it._name.includes(s) ||
    (it._en && it._en.includes(s)) ||
    String(it.id) === s
  );
}

export function searchFuzzy(index, q, excludeKeys = new Set()) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return [];
  const hits = [];
  for (const it of index) {
    if (excludeKeys.has((it.kind || '') + ':' + it.id)) continue;
    let hit = false;
    if (it._alias.some(a => a.toLowerCase() === s)) hit = true;
    if (!hit && s.length >= 2 && isSubsequence(s, it.name)) hit = true;
    if (!hit && it.py && it.py.startsWith(s)) hit = true;
    if (!hit && it.ini && it.ini.startsWith(s)) hit = true;
    if (!hit && isAscii(s) && it.py && editDistance(s, it.py) <= 1) hit = true;
    if (hit) hits.push(it);
  }
  return hits;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /d/ai/workspace/work/isaac-achievements-v2 && node --test scripts/tests/search.test.mjs`
Expected: 13 tests PASS。

- [ ] **Step 5: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add scripts/lib/search.mjs scripts/tests/search.test.mjs
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(search): 精确/模糊搜索匹配库（别名/子序列/拼音/错字）"
```

---

### Task 7: 构建管线——public 平铺、_headers、service worker、HTML 图集外置

**Files:**
- Modify: `scripts/build.mjs`
- Create: `scripts/patch-html.mjs`
- Modify: `index.html`（head、数据块、常量、生成图标函数）
- Create: `public/_headers`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `public/assets/manifest.json`、`public/data/codex.json`（Task 4/5）
- Produces: `ASSETS` 常量（浏览器全局）形状与 manifest 一致；
  `iconStyle(sheet, cell) -> string`（返回内联 style，供 `cardHtml` 使用）。

- [ ] **Step 1: 修改 `scripts/build.mjs`——把 public/* 平铺到 build/ 根**

```js
// 构建脚本：把前端静态资源 + functions + lib 组装进 build/ 目录
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, 'build');

rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });

// 1. 前端静态资源：index.html + public/ 内容平铺到根（sw.js、pwa/、assets/、data/、_headers）
cpSync(resolve(root, 'index.html'), resolve(build, 'index.html'));
cpSync(resolve(root, 'public'), build, { recursive: true });

// 2. functions/ 目录（Cloudflare Pages Functions）
cpSync(resolve(root, 'functions'), resolve(build, 'functions'), { recursive: true });

// 3. lib/ 目录（functions 运行时代码依赖）
cpSync(resolve(root, 'lib'), resolve(build, 'lib'), { recursive: true });

execSync('find lib -name "*.test.ts" -delete', { cwd: build });

console.log('✅ build/ 已生成：');
for (const entry of readdirSync(build)) console.log(`   - ${entry}`);
```

- [ ] **Step 2: 创建 `public/_headers`**

```
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/data/codex.json
  Cache-Control: public, max-age=3600
```

- [ ] **Step 3: 重写 `public/sw.js`**

```js
/* 以撒成就清单 - Service Worker
 * 页面 network-first（尽快拿到新版本），图集/数据 cache-first（体积大且按内容命名）。
 */
const CACHE_NAME = 'isaac-checklist-v4';
const CORE = ['/', '/index.html', '/pwa/manifest.json'];
const PRECACHE = [
  '/assets/atlas-ach.png',
  '/assets/item-collect.webp',
  '/assets/item-trinket.webp',
  '/assets/item-cards.webp',
  '/assets/item-runes.webp',
  '/assets/item-pills.webp',
  '/data/codex.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE.concat(PRECACHE)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  const url = new URL(request.url);
  const cacheFirst = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/data/');

  if (cacheFirst) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res && res.status === 200) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html')))
  );
});
```

- [ ] **Step 4: 写 `scripts/patch-html.mjs`（幂等）**

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'index.html');
let html = readFileSync(file, 'utf8');

// 1) 删除内嵌图集块与其常量行（只删 4 个图片块，ipos-json/pos-json 保留在页面里）
for (const id of ['atlas-json', 'collect-b64', 'cards-b64', 'trinket-b64']) {
  const re = new RegExp(`<script type="application/json" id="${id}">[\\s\\S]*?</script>\\n?`);
  html = html.replace(re, '');
}
html = html.replace(/^const (ATLAS_B64|COLLECT_B64|CARDS_B64|TRINKET_B64) = document\.getElementById\('[a-z0-9-]+'\)\.textContent\.trim\(\);\n/gm, '');

// 2) 注入 ASSETS 常量（若尚未存在）
const manifest = JSON.parse(readFileSync(resolve(root, 'public/assets/manifest.json'), 'utf8'));
const marker = 'const ASSETS = ';
if (!html.includes(marker)) {
  const anchor = "const DATA = JSON.parse(document.getElementById('data-json').textContent);";
  if (!html.includes(anchor)) throw new Error('找不到 DATA 解析锚点');
  html = html.replace(anchor, anchor + '\n' + marker + JSON.stringify(manifest) + ';');
}

// 3) 首屏必需图集预加载（成就卡片图标）
const preload = '<link rel="preload" as="image" href="/assets/atlas-ach.png" fetchpriority="high">\n';
if (!html.includes('/assets/atlas-ach.png')) html = html.replace('</head>', preload + '</head>');

writeFileSync(file, html);
console.log('index.html patched:', (html.length / 1024).toFixed(0), 'KB');
```

- [ ] **Step 5: 运行 patch 并核对体积**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node scripts/patch-html.mjs && ls -la index.html
gzip -c index.html | wc -c
```
Expected: index.html 约 330–360 KB，gzip 约 115–135 KB。若仍 > 1 MB，检查 4 个图片块与 4 行常量是否都已删除。

- [ ] **Step 6: 替换图标生成逻辑为 CSS 裁剪**

在 `index.html` 中找到 `const state = {`（约 948 行原有位置），在它前面插入：

```js
/* ---------- 外置图集裁剪 ---------- */
function iconStyle(sheetName, cell) {
  const sheet = ASSETS[sheetName];
  if (!sheet) return '';
  const col = cell % sheet.cols;
  const row = Math.floor(cell / sheet.cols);
  const scale = 64 / sheet.cell;            // 图标显示尺寸固定 64
  return 'background-image:url(/assets/' + sheet.file + ');' +
    'background-size:' + (sheet.w * scale) + 'px ' + (sheet.h * scale) + 'px;' +
    'background-position:-' + (col * sheet.cell * scale) + 'px -' + (row * sheet.cell * scale) + 'px;' +
    'background-repeat:no-repeat;';
}
```

然后删除 `generateWikiIcons()` 整个函数体（约 1069–1137 行），改为：

```js
function generateWikiIcons() {
  // 堕化角色头像仍用内嵌 base64（体积小）
  const charNameToIdx = ['堕化以撒','堕化抹大拉','堕化该隐','堕化犹大','堕化???','堕化夏娃','堕化参孙','堕化阿撒泻勒','堕化拉撒路','堕化伊甸','堕化游魂','堕化莉莉丝','堕化店主','堕化亚玻伦','堕化遗骸','堕化伯大尼','堕化雅各'];
  const nameIdx = {};
  charNameToIdx.forEach((n, i) => nameIdx[n] = i);
  for (const [id, cname] of Object.entries(TAINTED_MAP)) {
    const idx = nameIdx[cname];
    if (idx === undefined || !TAINTED_CHARS[idx]) continue;
    state.charIcons[id] = 'data:image/png;base64,' + TAINTED_CHARS[idx];
  }
  state.wikiReady = true;
}
```

将 `cardHtml(item)` 中的图标分支改为：

```js
  let img, hasImg = false;
  if (state.icons[item.id]) {
    img = '<img src="' + state.icons[item.id] + '" alt="">';
    hasImg = true;
  } else if (state.charIcons[item.id]) {
    img = '<img src="' + state.charIcons[item.id] + '" alt="">';
    hasImg = true;
  } else if (item.wicon && item.wicon_id && wiconCell(item)) {
    img = '<div class="atlas-icon" style="' + wiconStyle(item) + '"></div>';
    hasImg = true;
  } else if (POS[item.id]) {
    img = '<div class="atlas-icon" style="' + iconStyle('atlas-ach', cellOf(POS[item.id], 64, 20)) + '"></div>';
    hasImg = true;
  } else {
    img = '<div class="icon-placeholder ' + gradClass(+item.id) + '">' + esc(item.title.slice(0,1)) + '</div>';
  }
```

并在 `cardHtml` 前加入两个辅助函数：

```js
function cellOf(pos, size, cols) {
  return (Math.abs(pos[1]) / size) * cols + Math.abs(pos[0]) / size;
}
function clampCell(sheetName, cell) {
  const sheet = ASSETS[sheetName];
  return Math.max(0, Math.min(sheet.cols * sheet.rows - 1, cell));
}
function wiconCell(item) {
  const type = item.wicon, id = item.wicon_id;
  if (!type || id === undefined || id === null || id === '') return null;
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  if (type === 'collectibles') {
    const pos = IPOS.collectibles[String(n).padStart(3, '0')];
    return pos ? { sheet: 'item-collect', cell: clampCell('item-collect', cellOf(pos, 32, 20)) } : null;
  }
  if (type === 'trinket') {
    const pos = IPOS.trinkets[String(n).padStart(3, '0')];
    return pos ? { sheet: 'item-trinket', cell: clampCell('item-trinket', cellOf(pos, 32, 20)) } : null;
  }
  if (type === 'cards') {
    if (n >= 32 && n <= 39) return { sheet: 'item-runes', cell: n - 32 };
    // item-cards.webp 按 id 1–97 顺序铺格（32–39 保留空格），格号 = id-1
    return { sheet: 'item-cards', cell: clampCell('item-cards', n - 1) };
  }
  if (type === 'pills') return { sheet: 'item-pills', cell: clampCell('item-pills', n) };
  return null;
}
function wiconStyle(item) {
  const c = wiconCell(item);
  return c ? iconStyle(c.sheet, c.cell) : '';
}
```

`IPOS`（`ipos-json`，17.7 KB，5 个分类）继续留在页面里，Task 7 Step 4 的 patch 不删除它，因此无需新增 `IPOS_SAVED`。

- [ ] **Step 7: 校验删除后的图集常量不再被引用**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && grep -n "ATLAS_B64\|COLLECT_B64\|CARDS_B64\|TRINKET_B64\|loadImage(" index.html
```
Expected: 无输出（`loadImage` 也随之删除；若仍被引用，说明 Step 6 未删干净）。

- [ ] **Step 8: 构建并验证资源按根路径发布**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && npm run build && find build -maxdepth 2 -type f | sort | head -30
```
Expected: `build/sw.js`、`build/pwa/manifest.json`、`build/assets/*.webp`、`build/assets/atlas-ach.png`、`build/data/codex.json`、`build/_headers` 都在根层级（不再有 `build/public/`）。`npm run build` 里的 `tsc --noEmit` 也应通过。

- [ ] **Step 9: 启动本地服务器目检**

Run（后台）:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2/build && npx --yes serve -l 4173 .
```
打开 `http://localhost:4173/`，确认：页面正常、首屏卡片有图标（成就/道具/饰品）、控制台无 404。重点看 #89–#96（符文成就）现在显示的是符文而不是塔罗牌面。

- [ ] **Step 10: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add scripts/build.mjs scripts/patch-html.mjs index.html public/_headers public/sw.js
git -c user.name="local" -c user.email="local@localhost" commit -m "perf: 图集外置 + 构建平铺 public + PWA/缓存修复"
```

---

### Task 8: 首屏分片渲染 + `npm run build` 不再重复 patch

**Files:**
- Modify: `index.html`（`renderAll`、`applyFilter`、`switchTab` 逻辑）
- Modify: `package.json`（build 脚本）

**Interfaces:**
- Consumes: `currentTab`、`TAB_DEFS`、`buildGroups`
- Produces: `renderTab(tabId)`（首次切换时渲染该面板）、`ensurePanel(tabId)`

- [ ] **Step 1: 把 `renderAll()` 改为惰性渲染**

将 `index.html` 中现有的 `renderAll()`（`function renderAll() { ... }`，约 1271–1328 行，函数体是 `main.innerHTML=''` 后遍历 `TAB_DEFS` 建 `.tabpanel`）**整体替换**为下面四个函数。`renderPanel(tab)` 就是原 `renderAll()` 循环体的一份，只是把 `for (const tab of TAB_DEFS)` 变成「只渲染传入的这一个 tab」：

```js
const renderedPanels = new Set();

function renderPanel(tab) {
  if (renderedPanels.has(tab.id)) return;
  renderedPanels.add(tab.id);

  const panel = document.createElement('section');
  panel.className = 'tabpanel' + (tab.id === currentTab ? ' active' : '');
  panel.id = 'panel-' + tab.id;

  const desc = document.createElement('div');
  desc.className = 'panel-desc';
  desc.textContent = tab.desc;
  panel.appendChild(desc);

  for (const [gname, items] of buildGroups(tab)) {
    const sec = document.createElement('div');
    sec.className = 'group-section';
    sec.dataset.group = gname || 'main';
    if (gname) {
      const hdr = document.createElement('div');
      hdr.className = 'group-header';
      const nm = document.createElement('h3');
      nm.className = 'group-name';
      const av = document.createElement('span');
      av.className = 'group-avatar';
      av.textContent = gname === '全角色' ? '★' : gname.slice(0,1);
      nm.appendChild(av);
      nm.appendChild(document.createTextNode(gname));
      hdr.appendChild(nm);
      const bar = document.createElement('div');
      bar.className = 'group-bar';
      bar.innerHTML = '<div class="group-fill"></div>';
      hdr.appendChild(bar);
      const cnt = document.createElement('span');
      cnt.className = 'group-count';
      hdr.appendChild(cnt);
      const collapseG = document.createElement('button');
      collapseG.className = 'group-collapse';
      collapseG.type = 'button';
      collapseG.title = '收起 / 展开该分栏';
      collapseG.innerHTML = '<span class="gc-ico">▾</span>';
      hdr.appendChild(collapseG);
      sec.appendChild(hdr);
    }
    const grid = document.createElement('div');
    grid.className = 'ach-grid';
    grid.innerHTML = items.map(cardHtml).join('');
    sec.appendChild(grid);
    panel.appendChild(sec);
  }

  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.id = 'empty-' + tab.id;
  empty.innerHTML = '<div class="e-icon">🔎</div>没有找到匹配的成就，试试其他关键词吧';
  panel.appendChild(empty);
  main.appendChild(panel);
}

function renderAll() {
  main.innerHTML = '';
  renderedPanels.clear();
  for (const tab of TAB_DEFS) {
    if (tab.id === currentTab) renderPanel(tab);
  }
  ensureActivePanel();
}

function switchTab(id) {
  currentTab = id;
  ensureActivePanel();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  applyFilter();
}

function ensureActivePanel() {
  const tab = TAB_DEFS.find(t => t.id === currentTab) || TAB_DEFS[0];
  renderPanel(tab);
  document.querySelectorAll('.tabpanel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + currentTab));
}
```

> `switchTab()` 末尾调用 `applyFilter()`：虽然 `generateWikiIcons()` 在 Task 7 之后已同步填充 `state.wikiIcons`/`state.rewardIcons`（卡片用图集 div 渲染，见 Task 7 Step 6），但搜索/筛选状态需要立即作用到新渲染的面板上。

- [ ] **Step 2: 标签切换与搜索跳转时确保面板已渲染**

把 `index.html` 现有的「标签切换」监听（`tabsEl.addEventListener('click', ...)`，约 1583–1591 行，内部直接切 class）改为：

```js
tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  currentTab = btn.dataset.tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
  ensureActivePanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
```

并在 `applyFilter()` 的「自动跳转到第一个匹配标签页」分支里，把直接切换 class 的代码替换为：

```js
  if (q && firstMatchTab && firstMatchTab !== currentTab) {
    currentTab = firstMatchTab;
    renderPanel(TAB_DEFS.find(t => t.id === currentTab));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === firstMatchTab));
    document.querySelectorAll('.tabpanel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + firstMatchTab));
  }
```

但 `applyFilter()` 需要在未渲染面板上也能判断匹配——因此把搜索判断从遍历 DOM 改为在 `DATA` 上计算：

```js
function applyFilter() {
  const q = searchEl.value.trim().toLowerCase();
  const pri = priEl.value;
  const visibleByTab = {};
  for (const tab of TAB_DEFS) {
    const ids = new Set();
    for (const item of DATA) {
      if (!tab.types.includes(item.type)) continue;
      let show = true;
      if (q) {
        const hay = (item.title + ' ' + item.reward + ' ' + item.cond + ' ' + (item.char || '')).toLowerCase();
        show = hay.includes(q);
      }
      if (show && pri) {
        const p = effectivePri(item);
        show = pri === 'none' ? p === '' : p === pri;
      }
      if (show && hideDone && state.completed.has(String(item.id))) show = false;
      if (show) ids.add(String(item.id));
    }
    visibleByTab[tab.id] = ids;
  }

  // 已渲染的面板更新可见性
  document.querySelectorAll('.tabpanel').forEach(panel => {
    const tid = panel.id.replace('panel-', '');
    const ids = visibleByTab[tid] || new Set();
    let panelHas = false;
    panel.querySelectorAll('.group-section').forEach(sec => {
      let groupHas = false;
      sec.querySelectorAll('.ach-card').forEach(card => {
        const on = ids.has(card.dataset.id);
        card.classList.toggle('hidden', !on);
        if (on) groupHas = true;
      });
      sec.classList.toggle('hidden', !groupHas);
      if (groupHas) panelHas = true;
    });
    const empty = panel.querySelector('.empty-state');
    if (empty) empty.classList.toggle('show', !panelHas);
  });

  const matchTabs = new Set(Object.entries(visibleByTab).filter(([, ids]) => ids.size).map(([id]) => id));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('has-match', !!q && matchTabs.has(b.dataset.tab)));

  if (q && matchTabs.size) {
    const first = TAB_DEFS.find(t => matchTabs.has(t.id)).id;
    if (first !== currentTab) {
      currentTab = first;
      renderPanel(TAB_DEFS.find(t => t.id === first));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === first));
      ensureActivePanel();
    }
  }
}
```

- [ ] **Step 3: 更新 `package.json` 的 build 流水线**

```json
"scripts": {
  "dev": "vite",
  "build": "npm run build:clean && npm run build:copy && npm run build:check",
  "build:clean": "rimraf build",
  "build:copy": "node scripts/build.mjs",
  "build:check": "tsc --noEmit -p tsconfig.app.json",
  "gen": "node scripts/extract-sources.mjs && node scripts/snapshot-data.mjs && node scripts/gen-assets.mjs && node scripts/gen-codex.mjs && node scripts/patch-html.mjs",
  "test": "vitest run && node --test scripts/tests/*.test.mjs",
  "test:watch": "vitest"
}
```

> `patch-html.mjs` 只放进 `gen`（一次性迁移），不进 `build`；`build.mjs` 只做复制，保持幂等。

- [ ] **Step 4: 验证测试与构建**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && npm test && npm run build
```
Expected: vitest + node:test 全部 PASS，build 成功。

- [ ] **Step 5: 浏览器验证惰性渲染**

启动 `npx serve -l 4173 build`，打开页面：
- 首屏只出现「普通角色成就」面板（DevTools Elements 里只有 1 个 `.tabpanel`）；
- 点击「挑战成就」后该面板出现；
- 搜索「节拍器」能自动跳到「其余成就」并显示匹配。

- [ ] **Step 6: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add index.html package.json
git -c user.name="local" -c user.email="local@localhost" commit -m "perf: 标签页惰性渲染，搜索改为基于 DATA 计算"
```

---

### Task 9: iOS「回到上次位置」

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `openWiki(url, context)`、`saveView()`、`restoreView()`、`sessionStorage['isaac_last_view']`
- 所有 wiki `<a>` 统一经 `wikiLink(url)` 生成，点击时调用 `openWiki`

- [ ] **Step 1: 增加视图保存/恢复与 openWiki**

在 `index.html` 的 `/* ---------- 工具 ---------- */` 区域（`function wikiUrl` 附近）加入：

```js
const VIEW_KEY = 'isaac_last_view';

function currentViewState() {
  return {
    scrollY: window.scrollY,
    tab: currentTab,
    search: searchEl ? searchEl.value : '',
    pri: priEl ? priEl.value : '',
    hideDone,
    codexOpen: typeof codexIsOpen === 'function' ? codexIsOpen() : false,
    codex: typeof codexViewState === 'function' ? codexViewState() : null,
    at: Date.now(),
  };
}

function saveView() {
  try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(currentViewState())); } catch (e) {}
}

function restoreView(state) {
  if (!state) return;
  if (state.search && searchEl) searchEl.value = state.search;
  if (state.pri && priEl) priEl.value = state.pri;
  hideDone = !!state.hideDone;
  if (state.tab && TAB_DEFS.some(t => t.id === state.tab)) {
    currentTab = state.tab;
    ensureActivePanel();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
  }
  applyFilter();
  if (state.codexOpen && typeof codexOpen === 'function' && state.codex) codexRestore(state.codex);
  window.scrollTo({ top: state.scrollY || 0 });
}

function openWiki(url) {
  saveView();
  window.location.href = url + (url.includes('?') ? '&' : '?') + 'from=isaac';
}

function wikiLink(url) {
  return '<a href="' + url + '" data-wiki="1" rel="noopener">';
}
```

- [ ] **Step 2: 替换所有 wiki 链接生成点**

- `cardHtml` 中标题链接：`'<a class="ach-title-text" href="' + titleHref(item) + '" target="_blank" rel="noopener">'` → `'<a class="ach-title-text" href="' + titleHref(item) + '" data-wiki="1" rel="noopener">'`（去掉 `target`）
- `autoLink` 与 `linkChallengeCond` 的 `<a class="inline-link" href="... target="_blank" rel="noopener">` → 去掉 `target="_blank"`，保留 `rel="noopener"`，并加 `data-wiki="1"`

- [ ] **Step 3: 统一拦截 wiki 点击**

在 `/* ---------- 初始化 ---------- */` 之前加入：

```js
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[data-wiki]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!href.startsWith('https://isaac.huijiwiki.com')) return;   // 站内/其它链接不拦截
  ev.preventDefault();
  openWiki(href);
}, true);

window.addEventListener('pageshow', (ev) => {
  let raw = null;
  try { raw = sessionStorage.getItem(VIEW_KEY); } catch (e) {}
  if (!raw) return;
  let st = null;
  try { st = JSON.parse(raw); } catch (e) { return; }
  // 首次加载也会触发 pageshow，但那时并没有「离开」，不要恢复/提示
  if (!ev.persisted && performance.now() < 1000) return;
  restoreView(st);
  toast('已回到上次浏览位置');
});
```

- [ ] **Step 4: 顶栏「↩ 回到上次位置」按钮**

在 `index.html` 的 `.toolbar` 内（`#resetBtn` 之后、两个 hidden `<input type="file">` 之前）插入：

```html
<button class="tool-btn" id="backToViewBtn" title="回到上次浏览位置" style="display:none"><span class="t-icon">↩</span><span class="tb-text">回到上次位置</span></button>
```

初始化时：

```js
const backBtn = document.getElementById('backToViewBtn');
function refreshBackBtn() {
  let has = false;
  try { has = !!sessionStorage.getItem(VIEW_KEY); } catch (e) {}
  if (backBtn) backBtn.style.display = has ? '' : 'none';
}
backBtn && backBtn.addEventListener('click', () => {
  try { restoreView(JSON.parse(sessionStorage.getItem(VIEW_KEY))); } catch (e) {}
});
refreshBackBtn();
window.addEventListener('pagehide', refreshBackBtn);
```

- [ ] **Step 5: 同步 manifest 的 `start_url` 为根路径**

把 `public/pwa/manifest.json` 中 `"start_url": "./index.html"` 改为 `"start_url": "/"`，`"scope": "./"` 改为 `"scope": "/"`；图标 `src` 改为 `"/pwa/new-icon-192.png"`、`"/pwa/new-icon-512.png"`。

同时把 `index.html` 的 `<link rel="manifest" href="pwa/manifest.json">` 改为 `href="/pwa/manifest.json"`，`navigator.serviceWorker.register('sw.js')` 改为 `register('/sw.js')`。

- [ ] **Step 6: 浏览器验证返回逻辑**

Run: `npm run build && npx serve -l 4173 build`，在 Chrome DevTools 里：
1. 滚动到「挑战成就」标签页中间，点击某个成就标题（会跳转 wiki；因为本机访问 wiki 会 403，属于预期）；
2. 浏览器后退；
3. 断言：页面回到同一标签页、同一滚动位置，并出现「已回到上次浏览位置」toast。

- [ ] **Step 7: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add index.html public/pwa/manifest.json public/sw.js
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(ios): 从 wiki 返回时恢复标签页/滚动/筛选位置"
```

---

### Task 10: 图鉴悬浮窗（UI + 排序 + 索引条 + 品质筛选）

**Files:**
- Modify: `index.html`（CSS + HTML 容器 + 图鉴模块）
- Create: `scripts/lib/codex-ui.js`？—— **不建**。图鉴 UI 必须内联在 index.html（单文件应用），搜索逻辑专用 `scripts/lib/search.mjs` 的算法已复制进页面（见 Step 3 的 `searchCore`）。为避免双份实现，改为：`scripts/lib/search.mjs` 导出纯函数，**构建时**把该文件内联进 index.html 的 `searchCore` 段。具体：在 `index.html` 里放 `<script id="search-core">/*BUNDLED_SEARCH*/</script>`，`scripts/patch-html.mjs` 把 `search.mjs` 源码（去掉 `export`）注入。

**Interfaces:**
- Produces: `codexOpen()`, `codexClose()`, `codexIsOpen()`, `codexViewState()`, `codexRestore(state)`（Task 9 已调用）
- 数据：`fetch('/data/codex.json')` 懒加载，缓存在 `codexState.items`

- [ ] **Step 1: 在 `scripts/patch-html.mjs` 中加入 search.mjs 内联**

```js
// 4) 内联搜索库（浏览器与 Node 共用同一份源码）——幂等：替换占位注释
const searchSrc = readFileSync(resolve(root, 'scripts/lib/search.mjs'), 'utf8')
  .replace(/^export\s+/gm, '');
const core = '<script id="search-core">\n' + searchSrc + '\n</script>';
if (html.includes('<!-- SEARCH_CORE -->')) {
  html = html.replace('<!-- SEARCH_CORE -->', core);
} else if (!html.includes('id="search-core"')) {
  throw new Error('缺少 <!-- SEARCH_CORE --> 占位注释，且未内联过搜索库');
}
```

> 注意：`<script>` 标签只能出现在 HTML 头部/主体，不能嵌在已有 `<script>` 里。因此把注入点选在**主脚本开始之前**：在 `index.html` 中主脚本 `<script>` 的上一行留占位注释 `<!-- SEARCH_CORE -->`，patch 时替换为 `<script id="search-core">…</script>`。

- [ ] **Step 2: 在 `index.html` 主 `<script>` 前加占位注释**

在 `<!-- ========== 主脚本 ========== -->`（或主 `<script>` 标签）上方插入 `<!-- SEARCH_CORE -->`。

- [ ] **Step 3: 加入图鉴 CSS（插在 `</style>` 前）**

```css
/* ============ 图鉴悬浮窗 ============ */
.codex-fab {
  position: fixed; right: 16px; bottom: 96px; z-index: 400;
  width: 58px; height: 58px; border-radius: 50%;
  background: var(--accent); color: #fff; border: none;
  box-shadow: 0 6px 20px rgba(0,0,0,.28);
  font-size: 13px; font-weight: 700; cursor: grab;
  touch-action: none; user-select: none;
}
.codex-fab:active { cursor: grabbing; }
.codex-overlay {
  position: fixed; inset: 0; z-index: 450; background: rgba(0,0,0,.45);
  display: none; align-items: stretch; justify-content: center;
}
.codex-overlay.open { display: flex; }
.codex-panel {
  background: var(--surface); color: var(--text);
  width: min(760px, 100%); height: 100%; display: flex; flex-direction: column;
  box-shadow: var(--shadow);
}
@media (min-width: 900px) {
  .codex-overlay { align-items: stretch; justify-content: flex-end; }
  .codex-panel { width: 460px; height: 100%; }
}
.codex-head { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.codex-head input {
  flex: 1; min-width: 0; padding: 8px 10px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text);
}
.codex-close { border: none; background: transparent; color: var(--text-2); font-size: 22px; cursor: pointer; }
.codex-tabs { display: flex; gap: 6px; padding: 10px 14px 0; overflow-x: auto; }
.codex-tab {
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2);
  border-radius: 999px; padding: 5px 12px; font-size: 13px; white-space: nowrap; cursor: pointer;
}
.codex-tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.codex-tools { display: flex; gap: 8px; padding: 8px 14px; flex-wrap: wrap; align-items: center; }
.codex-tools select {
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text);
  border-radius: 8px; padding: 5px 8px; font-size: 13px;
}
.codex-quality { display: flex; gap: 4px; }
.codex-quality button {
  width: 30px; height: 26px; border-radius: 7px; font-size: 12px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); cursor: pointer;
}
.codex-quality button.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.codex-body { flex: 1; overflow-y: auto; padding: 4px 10px 40px; position: relative; }
.codex-group-h { position: sticky; top: 0; background: var(--surface); padding: 6px 6px 4px; font-weight: 700; font-size: 13px; color: var(--text-2); z-index: 2; }
.codex-item {
  display: flex; align-items: center; gap: 10px; padding: 7px 6px; border-bottom: 1px solid var(--border);
  text-decoration: none; color: inherit;
}
.codex-item:hover { background: var(--surface-2); }
.codex-icon { flex: none; width: 46px; height: 46px; border-radius: 8px; background-color: var(--surface-3); }
.codex-icon.lg { width: 64px; height: 64px; }
.codex-meta { min-width: 0; }
.codex-name { font-size: 14px; font-weight: 600; }
.codex-sub { font-size: 12px; color: var(--text-3); }
.codex-q { font-size: 11px; padding: 1px 6px; border-radius: 6px; background: var(--surface-3); color: var(--text-2); margin-left: 6px; }
.codex-index {
  position: sticky; right: 0; top: 0; align-self: flex-end;
  display: none; flex-direction: column; gap: 1px;
  padding: 8px 4px; font-size: 10px; color: var(--text-3);
  height: 100%; overflow: hidden; user-select: none;
}
.codex-index.show { display: flex; }
.codex-index span { cursor: pointer; padding: 0 2px; }
.codex-index span.active { color: var(--accent); font-weight: 700; }
.codex-section-title { font-size: 12px; color: var(--text-3); padding: 8px 14px 2px; }
.codex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 8px; padding: 6px 14px 20px; }
.codex-grid .codex-icon { width: 56px; height: 56px; cursor: pointer; }
.codex-detail { padding: 16px 18px; }
.codex-detail h3 { font-size: 17px; margin-bottom: 6px; }
.codex-detail p { font-size: 13px; color: var(--text-2); margin-bottom: 10px; white-space: pre-wrap; }
```

- [ ] **Step 4: 加入图鉴 HTML 容器（插在 `</body>` 前、主 script 后）**

```html
<button id="codexFab" class="codex-fab" aria-label="打开道具图鉴">道具</button>
<div id="codexOverlay" class="codex-overlay">
  <div class="codex-panel" role="dialog" aria-modal="true" aria-label="道具图鉴">
    <div class="codex-head">
      <input id="codexSearch" type="search" placeholder="搜索道具名称 / ID / 别名 / 拼音">
      <button id="codexClose" class="codex-close" aria-label="关闭">×</button>
    </div>
    <div class="codex-tabs" id="codexTabs"></div>
    <div class="codex-tools">
      <select id="codexSort">
        <option value="letter">首字母排序</option>
        <option value="id">ID 排序</option>
      </select>
      <div class="codex-quality" id="codexQuality">
        <button data-q="" class="active">全部</button>
        <button data-q="0">0</button><button data-q="1">1</button>
        <button data-q="2">2</button><button data-q="3">3</button><button data-q="4">4</button>
      </div>
    </div>
    <div class="codex-section-title" id="codexSectionTitle"></div>
    <div class="codex-body" id="codexBody"></div>
    <div class="codex-index" id="codexIndex"></div>
  </div>
</div>
```

- [ ] **Step 5: 图鉴模块 JS（插在主 script 的初始化之前）**

```js
/* ---------- 道具图鉴 ---------- */
const CODEX = {
  loaded: false,
  loading: null,
  items: [],
  aliases: {},
  index: [],
  kind: 'collectible',
  sort: 'letter',
  quality: '',
  query: '',
  scrollTop: 0,
};
const CODEX_TABS = [
  { id: 'collectible', label: '道具' },
  { id: 'trinket', label: '饰品' },
  { id: 'pill', label: '胶囊' },
  { id: 'card', label: '卡牌·符文' },
];

function codexIsOpen() { return document.getElementById('codexOverlay').classList.contains('open'); }

async function codexLoad() {
  if (CODEX.loaded) return;
  if (!CODEX.loading) {
    CODEX.loading = fetch('/data/codex.json').then(r => r.json()).then(data => {
      CODEX.items = data.items;
      CODEX.aliases = data.aliases;
      CODEX.index = buildSearchIndex(CODEX.items, data.aliases);
      CODEX.byId = new Map(CODEX.items.map(i => [i.kind + ':' + i.id, i]));
      CODEX.loaded = true;
    });
  }
  return CODEX.loading;
}

function codexIconStyle(item, big) {
  return 'style="' + iconStyle(item.sheet, item.cell) + '" class="codex-icon' + (big ? ' lg' : '') + '"';
}

function codexItemHtml(item) {
  return '<div class="codex-item" data-kind="' + item.kind + '" data-id="' + item.id + '">' +
    '<div ' + codexIconStyle(item) + '></div>' +
    '<div class="codex-meta">' +
      '<div class="codex-name">' + esc(item.name) +
        (item.quality != null ? '<span class="codex-q">Q' + item.quality + '</span>' : '') + '</div>' +
      '<div class="codex-sub">' + esc(item.en || '') + (item.en ? ' · ' : '') + '#' + item.id + '</div>' +
    '</div>' +
  '</div>';
}

function codexFiltered() {
  const q = CODEX.query.trim();
  let items = CODEX.items.filter(i => i.kind === CODEX.kind);
  if (CODEX.quality !== '' && (CODEX.kind === 'collectible' || CODEX.kind === 'trinket')) {
    items = items.filter(i => String(i.quality) === CODEX.quality);
  }
  if (!q) return { exact: [], fuzzy: [], list: items };
  const sub = CODEX.index.filter(i => i.kind === CODEX.kind);
  const exact = searchExact(sub, q);
  const exKeys = new Set(exact.map(i => i.kind + ':' + i.id));
  const fuzzy = searchFuzzy(sub, q, exKeys);
  return { exact, fuzzy, list: [] };
}

function codexRender() {
  const body = document.getElementById('codexBody');
  const idxEl = document.getElementById('codexIndex');
  const titleEl = document.getElementById('codexSectionTitle');
  const { exact, fuzzy, list } = codexFiltered();
  const sortSel = document.getElementById('codexSort');
  const showIndex = CODEX.sort === 'letter' && !CODEX.query;
  idxEl.classList.toggle('show', showIndex);
  document.getElementById('codexQuality').style.display =
    (CODEX.kind === 'collectible' || CODEX.kind === 'trinket') ? '' : 'none';

  if (CODEX.query) {
    titleEl.textContent = '精确查找 ' + exact.length + ' 条 · 模糊搜索 ' + fuzzy.length + ' 条';
    let html = '<div class="codex-section-title">精确查找</div>';
    html += exact.length ? exact.map(codexItemHtml).join('') : '<div class="codex-sub" style="padding:0 14px">无</div>';
    html += '<div class="codex-section-title">模糊搜索（点击图标查看详情）</div>';
    html += '<div class="codex-grid">' + (fuzzy.length
      ? fuzzy.map(i => '<div ' + codexIconStyle(i) + ' data-kind="' + i.kind + '" data-id="' + i.id + '" title=""></div>').join('')
      : '<div class="codex-sub" style="padding:0 14px">无</div>') + '</div>';
    body.innerHTML = html;
    idxEl.innerHTML = '';
    return;
  }

  titleEl.textContent = CODEX_TABS.find(t => t.id === CODEX.kind).label + ' · 共 ' + list.length + ' 条';
  if (CODEX.sort === 'id') {
    list.sort((a, b) => b.id - a.id);
    body.innerHTML = list.map(codexItemHtml).join('');
    idxEl.innerHTML = '';
    return;
  }

  // 首字母排序
  const groups = new Map();
  for (const it of list) {
    const ch = (it.ini || '#')[0].toUpperCase();
    const key = /[A-Z]/.test(ch) ? ch : (/\d/.test(ch) ? '0-9' : '#');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const order = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
  let html = '';
  for (const k of order) {
    const g = groups.get(k);
    if (!g) continue;
    g.sort((a, b) => a.py.localeCompare(b.py) || a.id - b.id);
    html += '<div class="codex-group-h" id="cg-' + encodeURIComponent(k) + '">' + k + '（' + g.length + '）</div>';
    html += g.map(codexItemHtml).join('');
  }
  body.innerHTML = html;
  idxEl.innerHTML = order.filter(k => groups.has(k)).map(k => '<span data-k="' + k + '">' + k + '</span>').join('');
}

function codexOpenDetail(kind, id) {
  const item = CODEX.byId.get(kind + ':' + id);
  if (!item) return;
  const body = document.getElementById('codexBody');
  const pools = item.pools && item.pools.length ? '<p>道具池：' + item.pools.join('、') + '</p>' : '';
  const q = item.quality != null ? '<p>品质：' + '★'.repeat(item.quality) + '</p>' : '';
  const desc = item.desc ? '<p>' + esc(item.desc) + '</p>' : '<p>暂无摘要，点击名称查看 wiki。</p>';
  body.innerHTML = '<div class="codex-detail">' +
    '<button class="codex-close" id="codexBack" aria-label="返回">×</button>' +
    '<div ' + codexIconStyle(item, true) + '></div>' +
    '<h3>' + esc(item.name) + '</h3>' +
    '<p class="codex-sub">' + esc(item.en || '') + ' · #' + item.id + '</p>' +
    q + pools + desc +
    '<p><a href="https://isaac.huijiwiki.com' + item.wiki + '" data-wiki="1">在 wiki 查看 →</a></p>' +
    '</div>';
}

function codexViewState() {
  return { kind: CODEX.kind, sort: CODEX.sort, quality: CODEX.quality, query: CODEX.query, scrollTop: document.getElementById('codexBody').scrollTop };
}

function codexRestore(st) {
  if (!st) return;
  CODEX.kind = st.kind || 'collectible';
  CODEX.sort = st.sort || 'letter';
  CODEX.quality = st.quality || '';
  CODEX.query = st.query || '';
  codexLoad().then(() => {
    document.getElementById('codexSearch').value = CODEX.query;
    document.getElementById('codexSort').value = CODEX.sort;
    document.querySelectorAll('#codexQuality button').forEach(b => b.classList.toggle('active', b.dataset.q === CODEX.quality));
    document.querySelectorAll('.codex-tab').forEach(b => b.classList.toggle('active', b.dataset.kind === CODEX.kind));
    codexRender();
    document.getElementById('codexBody').scrollTop = st.scrollTop || 0;
  });
  document.getElementById('codexOverlay').classList.add('open');
}

function codexInit() {
  const tabs = document.getElementById('codexTabs');
  tabs.innerHTML = CODEX_TABS.map(t => '<button class="codex-tab' + (t.id === CODEX.kind ? ' active' : '') + '" data-kind="' + t.id + '">' + t.label + '</button>').join('');

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.codex-tab');
    if (!b) return;
    CODEX.kind = b.dataset.kind;
    tabs.querySelectorAll('.codex-tab').forEach(x => x.classList.toggle('active', x === b));
    codexRender();
  });

  document.getElementById('codexSearch').addEventListener('input', (e) => { CODEX.query = e.target.value; codexRender(); });
  document.getElementById('codexSort').addEventListener('change', (e) => { CODEX.sort = e.target.value; codexRender(); });
  document.getElementById('codexQuality').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    CODEX.quality = b.dataset.q;
    document.querySelectorAll('#codexQuality button').forEach(x => x.classList.toggle('active', x === b));
    codexRender();
  });
  document.getElementById('codexClose').addEventListener('click', codexClose);
  document.getElementById('codexOverlay').addEventListener('click', (e) => { if (e.target.id === 'codexOverlay') codexClose(); });
  document.getElementById('codexBody').addEventListener('click', (e) => {
    const back = e.target.closest('#codexBack');
    if (back) { codexRender(); return; }
    const el = e.target.closest('[data-kind][data-id]');
    if (!el) return;
    codexOpenDetail(el.dataset.kind, +el.dataset.id);
  });
  const idx = document.getElementById('codexIndex');
  idx.addEventListener('click', (e) => {
    const sp = e.target.closest('span'); if (!sp) return;
    const target = document.getElementById('cg-' + encodeURIComponent(sp.dataset.k));
    if (target) target.scrollIntoView({ block: 'start' });
  });
  document.getElementById('codexBody').addEventListener('scroll', () => {
    if (CODEX.sort !== 'letter' || CODEX.query) return;
    const heads = Array.from(document.querySelectorAll('.codex-group-h'));
    let active = null;
    for (const h of heads) {
      if (h.getBoundingClientRect().top < 120) active = h.id.replace('cg-', '');
    }
    idx.querySelectorAll('span').forEach(s => s.classList.toggle('active', s.dataset.k === decodeURIComponent(active || '')));
  });

  // 悬浮按钮拖动
  const fab = document.getElementById('codexFab');
  let drag = null;
  fab.addEventListener('pointerdown', (e) => {
    fab.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, moved: false };
  });
  fab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) {
      fab.style.left = Math.max(4, Math.min(window.innerWidth - 62, fab.offsetLeft + dx)) + 'px';
      fab.style.top = Math.max(60, Math.min(window.innerHeight - 66, fab.offsetTop + dy)) + 'px';
      fab.style.right = 'auto'; fab.style.bottom = 'auto';
      drag.x = e.clientX; drag.y = e.clientY;
    }
  });
  fab.addEventListener('pointerup', () => {
    const moved = drag && drag.moved;
    drag = null;
    if (moved) {
      try { localStorage.setItem('isaac_codex_fab', JSON.stringify({ left: fab.style.left, top: fab.style.top })); } catch (err) {}
    } else {
      codexOpen();
    }
  });
  try {
    const saved = JSON.parse(localStorage.getItem('isaac_codex_fab') || 'null');
    if (saved) { fab.style.left = saved.left; fab.style.top = saved.top; fab.style.right = 'auto'; fab.style.bottom = 'auto'; }
  } catch (err) {}
}

function codexOpen() {
  document.getElementById('codexOverlay').classList.add('open');
  codexLoad().then(codexRender);
}
function codexClose() {
  CODEX.scrollTop = document.getElementById('codexBody').scrollTop;
  document.getElementById('codexOverlay').classList.remove('open');
}
```

- [ ] **Step 6: 初始化时调用 `codexInit()`，并在 `saveView` 中保存图鉴状态**

在 `/* ---------- 初始化 ---------- */` 段末尾（`generateWikiIcons();` 之后）加：

```js
codexInit();
```

- [ ] **Step 7: 浏览器验证**

Run: `npm run build && npx serve -l 4173 build`，打开 `http://localhost:4173/`：
1. 点击右下「道具」按钮 → 图鉴打开、「道具」标签默认选中，721 条；
2. 搜索「节拍器」→ 精确栏出现「节拍器 #488」；搜索「小汽车」→ 精确栏无、模糊栏一格图标；
3. 搜索「猫爪」「妈刀」「jpq」→ 模糊栏分别出现对应图标；
4. 切「ID 排序」→ 索引条消失；切回「首字母排序」→ 索引条出现且可点击跳转；
5. 「胶囊」「卡牌·符文」标签页各有 50 / 97 条，图标正确（不是文字占位）；
6. 品质筛选 3 → 只剩 3 星道具。

- [ ] **Step 8: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add index.html scripts/patch-html.mjs
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(codex): 道具图鉴悬浮窗（四标签页/首字母索引/品质筛选/精确模糊搜索）"
```

---

### Task 11: 主页面搜索改为精确/模糊两栏（成就）

**Files:**
- Modify: `index.html`（主搜索 UI 与 `applyFilter`）
- Modify: `index.html` 样式

**Interfaces:**
- Consumes: `searchCore`（`buildSearchIndex`/`searchExact`/`searchFuzzy` 已在页面内）
- Produces: `achievementSearchIndex`（启动时构建）

- [ ] **Step 1: 在启动时构建成就搜索索引**

在 `DATA` 加载后、`saveView` 附近加入：

```js
let achievementSearchIndex = null;
function getAchievementIndex() {
  if (achievementSearchIndex) return achievementSearchIndex;
  const items = DATA.map(d => ({
    id: +d.id, kind: 'achievement', name: d.title, en: d.en || '',
    py: '', ini: '', desc: d.cond || '', reward: d.reward || '',
  }));
  // 成就拼音在构建期不可用，这里用 Intl.Collator 排序代替；拼音匹配对成就降级为子序列匹配
  achievementSearchIndex = buildSearchIndex(items, {});
  return achievementSearchIndex;
}
```

> 成就的 `py/ini` 为空，因此 `searchFuzzy` 对成就只走「子序列」分支；这是可接受的降级（成就以中文名为主，别名表只覆盖道具）。

- [ ] **Step 2: 搜索结果双栏渲染**

在主页面 `#main` 之前插入一个结果容器（`index.html`）：

```html
<div id="searchResults" class="search-results" hidden>
  <div class="search-results-head">
    <span id="searchResultsTitle"></span>
    <button id="searchResultsClose" class="btn">返回清单</button>
  </div>
  <div id="searchResultsExact"></div>
  <div id="searchResultsFuzzy"></div>
</div>
```

样式：

```css
.search-results { max-width: 1480px; margin: 0 auto; padding: 14px 20px 40px; }
.search-results-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.search-results h3 { font-size: 14px; color: var(--text-2); margin: 14px 0 8px; }
.search-exact-item { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
.search-fuzzy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; }
```

- [ ] **Step 3: 改写主搜索入口**

在 `searchEl.addEventListener('input', ...)` 处改为：

```js
function runMainSearch() {
  const q = searchEl.value.trim();
  const box = document.getElementById('searchResults');
  if (!q) { box.hidden = true; document.getElementById('main').hidden = false; applyFilter(); return; }

  const idx = getAchievementIndex();
  const exact = searchExact(idx, q);
  const exKeys = new Set(exact.map(i => i.kind + ':' + i.id));
  const fuzzy = searchFuzzy(idx, q, exKeys);

  document.getElementById('main').hidden = true;
  box.hidden = false;
  document.getElementById('searchResultsTitle').textContent = '搜索「' + q + '」：精确 ' + exact.length + ' · 模糊 ' + fuzzy.length;

  document.getElementById('searchResultsExact').innerHTML = '<h3>精确查找</h3>' +
    (exact.length ? exact.map(i => {
      const d = DATA.find(x => +x.id === i.id);
      return '<div class="search-exact-item">' +
        '<div class="codex-icon"' + ' style="' + achIconStyle(d) + '"></div>' +
        '<a class="ach-title-text" href="' + titleHref(d) + '" data-wiki="1">' + esc(d.title) + '</a>' +
        '<span class="codex-sub">' + esc(d.reward || '') + '</span></div>';
    }).join('') : '<div class="codex-sub">无</div>');

  document.getElementById('searchResultsFuzzy').innerHTML = '<h3>模糊搜索（图标即结果）</h3>' +
    '<div class="search-fuzzy-grid">' + (fuzzy.length ? fuzzy.map(i => {
      const d = DATA.find(x => +x.id === i.id);
      return '<div class="codex-icon" title="" style="' + achIconStyle(d) + '" data-ach="' + d.id + '"></div>';
    }).join('') : '<div class="codex-sub">无</div>') + '</div>';
}

function achIconStyle(item) {
  if (item.wicon && item.wicon_id !== undefined && item.wicon_id !== null && item.wicon_id !== '') {
    const c = wiconCell(item);
    if (c) return iconStyle(c.sheet, c.cell);
  }
  if (POS[item.id]) return iconStyle('atlas-ach', cellOf(POS[item.id], 64, 20));
  return '';
}

searchEl.addEventListener('input', runMainSearch);
document.getElementById('searchResultsClose').addEventListener('click', () => {
  searchEl.value = '';
  runMainSearch();
});
document.getElementById('searchResultsFuzzy').addEventListener('click', (e) => {
  const el = e.target.closest('[data-ach]');
  if (!el) return;
  const d = DATA.find(x => +x.id === +el.dataset.ach);
  if (d) el.insertAdjacentHTML('afterend', '<div class="codex-sub" style="grid-column:1/-1">' + esc(d.title) + '：' + esc(d.cond || '') + '</div>');
});
```

- [ ] **Step 4: 删除旧的「自动跳标签页」逻辑**

在 `applyFilter()` 中删除 `firstMatchTab`/`matchTabs` 相关代码与 `has-match` 高亮（`runMainSearch` 不再调用 `applyFilter` 处理查询词，只处理优先级/隐藏已完成）。保留 `applyFilter` 在无搜索词时对清单的过滤。

- [ ] **Step 5: 浏览器验证**

Run: `npm run build && npx serve -l 4173 build`：
- 输入「抹大拉」→ 精确栏列出成就，模糊栏为空或少量图标；
- 输入「mdl」→ 精确无；模糊栏为空（成就无拼音），属预期；
- 输入「无头」→ 精确栏显示「无头宝宝」；
- 点「返回清单」→ 清空搜索并回到清单。

- [ ] **Step 6: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add index.html
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(search): 主页面搜索改为精确/模糊两栏（模糊仅显示图标）"
```

---

### Task 12: 忏悔+ 成就 638–641

**Files:**
- Modify: `scripts/patch-html.mjs`？—— **不**。直接修改 `index.html` 的 `data-json` 块（它是内联 JSON，仍保留在页面里）。
- Modify: `index.html`

**Interfaces:**
- Produces: `DATA.length === 641`

- [ ] **Step 1: 在 `data-json` 末尾追加 4 条**

用脚本追加（避免手工改超长单行）：

```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node -e "
const fs=require('fs');
let s=fs.readFileSync('index.html','utf8');
const m=s.match(/<script type=\"application\/json\" id=\"data-json\">([\s\S]*?)<\/script>/);
const data=JSON.parse(m[1]);
if(data.some(d=>d.id>=638&&d.id<=641)){console.log('already present');process.exit(0);}
data.push(
 {id:638,title:'游玩联机模式',en:'Play Online',type:'其余成就',char:'',priority:'',reward:'无奖励',cond:'游玩一次联机模式。',wicon:null,wicon_id:null,wlink:null},
 {id:639,title:'通关联机模式',en:'Win Online',type:'其余成就',char:'',priority:'',reward:'无奖励',cond:'通关一次联机模式。',wicon:null,wicon_id:null,wlink:null},
 {id:640,title:'通关联机每日挑战',en:'Win Online Daily',type:'其余成就',char:'',priority:'',reward:'无奖励',cond:'通关一次联机每日挑战。',wicon:null,wicon_id:null,wlink:null},
 {id:641,title:'读它！',en:'Item Descriptions',type:'其余成就',char:'',priority:'',reward:'无奖励',cond:'在常规游玩中击败妈妈，解锁内置道具说明。',wicon:null,wicon_id:null,wlink:null}
);
s=s.replace(m[0],'<script type=\"application/json\" id=\"data-json\">'+JSON.stringify(data)+'</script>');
fs.writeFileSync('index.html',s);
console.log('now',data.length);
"
```
Expected: `now 641`。

- [ ] **Step 2: 校验字段结构与既有条目一致**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node -e "
const fs=require('fs');const s=fs.readFileSync('index.html','utf8');
const d=JSON.parse(s.match(/id=\"data-json\">([\s\S]*?)<\/script>/)[1]);
const keys=Object.keys(d[0]).sort().join(',');
for(const x of d.filter(x=>x.id>=638)){ if(Object.keys(x).sort().join(',')!==keys) throw new Error('field mismatch '+x.id); }
const o=d.filter(x=>x.type==='其余成就').length;
console.log('total',d.length,'其余成就',o);
"
```
Expected: `total 641 其余成就 93`。

- [ ] **Step 3: 浏览器验证**

`npm run build && npx serve -l 4173 build` → 「其余成就」标签页出现 4 条新成就，图标分别为联机/金屎/沙漏/书。

- [ ] **Step 4: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add index.html
git -c user.name="local" -c user.email="local@localhost" commit -m "feat(data): 新增忏悔+ 成就 638–641（总数 641）"
```

---

### Task 13: wiki 链接只改两处 + README 更新

**Files:**
- Modify: `index.html`（`data-json` 中 #253、#432 的 `wlink`）
- Modify: `README.md`

- [ ] **Step 1: 精确修改两处 wlink**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node -e "
const fs=require('fs');let s=fs.readFileSync('index.html','utf8');
const m=s.match(/<script type=\"application\/json\" id=\"data-json\">([\s\S]*?)<\/script>/);
const d=JSON.parse(m[1]);
const a=d.find(x=>x.id===253), b=d.find(x=>x.id===432);
if(!a||!b) throw new Error('missing 253/432');
console.log('before', a.wlink, b.wlink);
a.wlink='/wiki/C269'; b.wlink='/wiki/C656';
const c=d.find(x=>x.id===603); if(c.wlink!=='/wiki/金胶囊') console.log('WARN 603 changed from expected:', c.wlink);
s=s.replace(m[0],'<script type=\"application/json\" id=\"data-json\">'+JSON.stringify(d)+'</script>');
fs.writeFileSync('index.html',s);
console.log('after', a.wlink, b.wlink);
"
```
Expected: `before /wiki/合作模式 /wiki/C577`，`after /wiki/C269 /wiki/C656`，且没有 603 的 WARN。

- [ ] **Step 2: 校验只有这两处变化**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && node -e "
const fs=require('fs');
const cur=JSON.parse(fs.readFileSync('index.html','utf8').match(/id=\"data-json\">([\s\S]*?)<\/script>/)[1]);
const old=JSON.parse(fs.readFileSync('scripts/data/raw/blocks.json','utf8')['data-json'].toString());
" 2>/dev/null || node -e "
const fs=require('fs');
const cur=JSON.parse(fs.readFileSync('index.html','utf8').match(/id=\"data-json\">([\s\S]*?)<\/script>/)[1]);
const raw=JSON.parse(fs.readFileSync('scripts/data/raw/blocks.json','utf8'));
const old=raw['data-json'];
const diffs=[];
for(const o of old){const n=cur.find(x=>x.id===o.id); if(!n){diffs.push(o.id+' missing');continue;} if(n.wlink!==o.wlink) diffs.push(o.id+': '+o.wlink+' -> '+n.wlink);}
console.log(diffs.join('\n')||'no wlink diffs');
"
```
Expected: 恰好输出 `253: /wiki/合作模式 -> /wiki/C269` 和 `432: /wiki/C577 -> /wiki/C656` 两行（638–641 是新增，不在旧数据里）。

- [ ] **Step 3: 更新 README**

把 README 中：
- 「**全部 637 项成就**」→「**全部 641 项成就**」
- 「含普通角色 241、堕化角色 120、完成挑战 89、Boss 击败 48 等分类」→「含普通角色 242、堕化角色 119、其余成就 93、完成挑战 48、Boss 击败 38 等分类」
- 功能列表新增一行：

```markdown
- **道具图鉴**：右下角「道具」按钮打开，含道具 721 / 饰品 188 / 胶囊 50 / 卡牌·符文 97，支持首字母索引、ID 排序、品质筛选，以及精确/模糊两栏搜索（别名、拼音、错字）
- **回到上次位置**：从 wiki 返回后自动恢复标签页与滚动位置
```

- 文末新增数据来源：

```markdown
## 数据来源

- 物品图标与元数据：[IsaacGuru](https://isaacguru.com/)
- 中文名称与描述：[External Item Descriptions](https://github.com/wofsauge/External-Item-Descriptions)（社区维护）
- wiki 链接：灰机 wiki
```

- [ ] **Step 4: 提交**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add index.html README.md
git -c user.name="local" -c user.email="local@localhost" commit -m "fix(wiki): #253→C269、#432→C656；README 同步 641 项与新功能"
```

---

### Task 14: 端到端验收与性能测量

**Files:**
- Create: `scripts/measure.mjs`（可选，用 Playwright？—— 项目未装，改用 Lighthouse CLI 手动）
- 仅验证，无产品代码修改

- [ ] **Step 1: 全量测试**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2 && npm test && npm run build
```
Expected: 全部 PASS；build 输出 `index.html`、`sw.js`、`_headers`、`assets/`、`data/`、`pwa/`、`functions/`、`lib/`。

- [ ] **Step 2: 测量体积**

Run:
```bash
cd /d/ai/workspace/work/isaac-achievements-v2
echo "index.html: $(gzip -c build/index.html | wc -c) B gzip"
du -ch build/assets/* | tail -1
du -h build/data/codex.json
```
Expected: `index.html` gzip ≤ 140 KB；assets 合计 ≤ 700 KB（含 atlas-ach ~372 KB + 5 个 WebP ~190 KB）；codex.json ≤ 420 KB。

- [ ] **Step 3: 本地服务器 + 浏览器验收清单**

Run: `npx serve -l 4173 build`

逐项确认并截图记录：
1. 首屏（普通角色成就）正常渲染，图标正确；
2. `/sw.js` 返回 JS、`/pwa/manifest.json` 返回 JSON（DevTools Network 检查 Content-Type）；
3. `/assets/item-cards.webp` 中 #89–#96 符文图标正确；
4. 图鉴四个标签页数量正确、ID/首字母排序切换时索引条显示/隐藏正确；
5. 搜索：节拍器 / 小汽车 / 猫爪 / 妈刀 / jpq / jiepaiqz 各命中预期；
6. 从图鉴点「在 wiki 查看」后（DevTools 阻止跳转或模拟），返回后图鉴恢复；
7. 回归：卡片图标优先级与旧版一致 —— #253、#432 的卡片显示的是达摩克里斯之剑等**奖励图标**，不是成就图；带 `wicon` 的 8 个符文成就（#89–#96）显示符文图标；其余 7 个胶囊成就显示胶囊图标（这两类原先缺失/错误）；
8. #253、#432 的成就卡片标题链接指向 `/wiki/C269`、`/wiki/C656`（右键复制链接）；
9. #603 金胶囊仍是 `/wiki/金胶囊`；
10. 「其余成就」显示 638–641；
11. 导入旧 `localStorage` 进度仍被识别（DevTools Application → Local Storage 保留旧 key 值刷新）。

- [ ] **Step 4: 汇总验收结果给用户**

以清单形式报告：通过项、需要注意的项（如本机无法访问 wiki 导致 403，需要在真实手机/网络上验证 iOS 返回）。

- [ ] **Step 5: 提交验收脚本（如有）**

```bash
cd /d/ai/workspace/work/isaac-achievements-v2
git add -A
git -c user.name="local" -c user.email="local@localhost" commit -m "chore: 端到端验收记录"
```

---

## Self-Review

**1. Spec coverage**

| Spec 章节 | 对应任务 |
|---|---|
| §2.1 图集外置 / CSS 裁剪 / 卡片映射修正 | Task 2、4、7 |
| §2.2 public 平铺 / `_headers` / sw.js / 绝对路径 | Task 7 |
| §2.3 首屏分片 | Task 8 |
| §2.4 图集体积 | Task 4（验收在 Task 14） |
| §2.5 验收指标 | Task 14 |
| §3 iOS 返回 | Task 9 |
| §4.1 四标签页 / 悬浮按钮 | Task 10 |
| §4.2 codex.json 模型 | Task 5 |
| §4.3 图标来源（胶囊/符文） | Task 4、5、10 |
| §4.4 首字母排序 + 索引条 / ID 排序无索引条 | Task 10 |
| §4.5 品质筛选 | Task 10 |
| §4.6 精确/模糊搜索 | Task 6、10、11 |
| §4.7 别名解析（名称优先/ID 兜底） | Task 3、5 |
| §4.8 性能（懒加载 JSON） | Task 5、10 |
| §5 链接只改 #253/#432 | Task 13 |
| §6 638–641 | Task 12 |
| §7 脚本 / build / README | Task 7、13 |
| §8 测试与验收 | Task 14 |

**2. Placeholder scan**：无 TBD/TODO。所有代码步骤均给出可运行代码。

**3. Type consistency**：
- `iconStyle(sheetName, cell)` 在 Task 7 定义，Task 10/11 使用 —— 一致。
- `cellOf(pos, size, cols)` 在 index.html 中定义为 `(pos,size,cols)`，Node 版 `scripts/lib/atlas.mjs` 的 `cellOf(pos, size=32, cols=20)` 签名一致。
- `cardCellMap/pillCellMap` 在 Task 4 定义，Task 5 使用 —— 一致（符文 32–39 不走 `cardCellMap`，由 `id - 32` 指向 `item-runes`）。
- `buildSearchIndex/searchExact/searchFuzzy(index, q, excludeKeys)` 在 Task 6 定义，Task 10/11 调用 —— 一致（`excludeKeys` 为 `Set<'kind:id'>`）。
- `codexViewState/codexRestore/codexIsOpen/codexOpen` 在 Task 10 定义，Task 9 的 `saveView/restoreView` 调用 —— 一致。
- `IPOS`（`ipos-json`）保留在页面中，Task 7 的 `wiconCell` 直接使用 —— 一致（不存在 `IPOS_SAVED`）。

**4. 已知取舍（需在验收时告知用户）**
- 成就搜索的拼音/错字匹配降级为子序列匹配（成就名未预生成拼音）；图鉴完整支持拼音。
- 本机 `isaac.huijiwiki.com` 返回 403，iOS 返回逻辑需要在真实网络/手机上复测。
- `ResourceExtractor.exe` 不可用，图集全部来自 IsaacGuru/EID 快照（已在 spec §1.6 记录）。

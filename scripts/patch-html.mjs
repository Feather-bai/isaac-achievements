// 一次性/可重复执行的 index.html 性能补丁：
// 1) 删除内嵌图集（改为 public/assets/ 外置文件）
// 2) 注入 ASSETS 常量（与 public/assets/manifest.json 形状一致）
// 3) 首屏预加载成就图集
// 幂等：重复运行不会重复注入，也不会因块已被删除而失败。
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

// 2) 注入/更新 ASSETS 常量（以 public/assets/manifest.json 为唯一版本源）
const manifest = JSON.parse(readFileSync(resolve(root, 'public/assets/manifest.json'), 'utf8'));
const assetsLine = 'const ASSETS = ' + JSON.stringify(manifest) + ';';
const assetsRe = /^const ASSETS = .*;$/m;
if (assetsRe.test(html)) {
  html = html.replace(assetsRe, () => assetsLine);
} else {
  const anchor = "const DATA = JSON.parse(document.getElementById('data-json').textContent);";
  if (!html.includes(anchor)) throw new Error('找不到 DATA 解析锚点');
  html = html.replace(anchor, () => anchor + '\n' + assetsLine);
}

// 3) 首屏必需图集预加载（成就卡片图标）；URL 必须与 assetUrl() 逐字节一致
const preloadRe = /<link rel="preload" as="image" href="\/assets\/atlas-ach\.png[^"]*"[^>]*>\n?/;
const preload = '<link rel="preload" as="image" href="/assets/atlas-ach.png?v=' + manifest.version + '" fetchpriority="high">\n';
html = preloadRe.test(html) ? html.replace(preloadRe, () => preload) : html.replace('</head>', () => preload + '</head>');

writeFileSync(file, html);
console.log('index.html patched:', (html.length / 1024).toFixed(0), 'KB');

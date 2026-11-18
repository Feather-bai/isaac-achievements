// 一次性/可重复执行的 index.html 性能补丁：
// 1) 删除内嵌图集（改为 public/assets/ 外置文件）
// 2) 注入 ASSETS 常量（与 public/assets/manifest.json 形状一致）
// 3) 首屏预加载成就图集
// 4) 内联通用搜索库（scripts/lib/search.mjs → <script id="search-core">）
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

// 4) 内联搜索库（浏览器与 Node 共用同一份源码）
// 两个 classic <script> 共享全局作用域：把箭头函数常量 isAscii 改成函数声明，
// 避免与未来同名 const 冲突，也避免重复注入时同一块内出现重复声明。
let searchSrc = readFileSync(resolve(root, 'scripts/lib/search.mjs'), 'utf8')
  .replace(/^export\s+/gm, '');
searchSrc = searchSrc.replace(
  /^const isAscii = s => (.+);$/m,
  (m, expr) => 'function isAscii(s) { return ' + expr + '; }'
);
if (!/\bfunction isAscii\b/.test(searchSrc)) {
  throw new Error('search.mjs 中未找到 isAscii 箭头函数，无法转换为函数声明');
}
const core = '<script id="search-core">\n' + searchSrc + '\n</script>';
// 只匹配 search-core 起始标签 + 到最近 </script> 为止；不要用非贪婪 [\s\S]*?，否则页面里
// 任何出现 id="search-core" 的注释都会被当成块起点，一路吞到主脚本结尾。
const coreRe = /<script id="search-core">[\s\S]*?<\/script>/;
if (coreRe.test(html)) {
  // 幂等：已注入则整块替换，保证与 search.mjs 同步
  html = html.replace(coreRe, () => core);
} else if (html.includes('<!-- SEARCH_CORE -->')) {
  html = html.replace('<!-- SEARCH_CORE -->', () => core);
} else {
  throw new Error('缺少 <!-- SEARCH_CORE --> 占位注释，且未内联过搜索库');
}
// 防御：注入后必须恰好一个 search-core 块，且 main 脚本仍在
const coreCount = (html.match(/<script id="search-core">/g) || []).length;
if (coreCount !== 1) throw new Error('search-core 块数量异常: ' + coreCount);
if (!html.includes('"use strict";')) throw new Error('注入后主脚本丢失');

writeFileSync(file, html);
console.log('index.html patched:', (html.length / 1024).toFixed(0), 'KB');

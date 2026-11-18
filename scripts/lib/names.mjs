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
// EID 描述用 `#` 表示换行。
const cleanDesc = (s) => clean(s).replace(/#/g, '\n');

export function parseEidDescriptions(...luaTexts) {
  const out = { collectibles: {}, trinkets: {}, cards: {}, pills: {} };
  for (const lua of luaTexts) {
    // 新版描述表有两种形态，均以 kind 结尾、首字母大小写不一：
    //   rep/  `local repCollectibles={ ... }`；rep+/ `local collectibles = { ... }`、`local horsepills = { ... }`。
    // 大小写不敏感 + 惰性前缀即可覆盖，horsepills 由结尾的 pills 归入胶囊。
    const tableRe = /local\s+[A-Za-z]*?(Collectibles|Trinkets|Cards|Pills)\s*=\s*\{([\s\S]*?)\n\}/gi;
    let t;
    while ((t = tableRe.exec(lua))) {
      const kind = t[1].toLowerCase();
      const rowRe = /^\s*\[(\d+)\]\s*=\s*\{\s*"([^"]*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/gm;
      let r;
      while ((r = rowRe.exec(t[2]))) {
        out[kind][Number(r[2] || r[1])] = { name: clean(r[3]), desc: cleanDesc(r[4]) };
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
        if (!out[kind][id]) out[kind][id] = { name: clean(r[2]), desc: cleanDesc(r[3]) };
      }
    }
  }
  return out;
}

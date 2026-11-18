export function readBlocks(html) {
  const out = {};
  const re = /<script type="application\/json" id="([^"]+)">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[2];
    try {
      out[m[1]] = JSON.parse(raw);
    } catch {
      out[m[1]] = raw.trim();
    }
  }
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

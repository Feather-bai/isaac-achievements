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

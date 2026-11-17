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

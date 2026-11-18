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

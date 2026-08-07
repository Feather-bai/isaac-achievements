/**
 * 以撒的结合全成就完成清单 — Cloudflare Worker
 *
 * 职责：
 *   1) 静态资源路由 —— 通过 env.ASSETS 绑定提供 index.html / sw.js / pwa/* 等文件；
 *   2) API 转发    —— /api/steam?q=... 拉取 Steam 成就 XML，规范化为 {ok, unlocked} JSON。
 *
 * 部署方式见项目根目录 README.md。前端 index.html 通过 getSteamProxy()
 * 自动推导出「当前域名」作为代理地址，因此网页与 API 同源即可直接使用。
 */
const GAME_APPID = '250900';                 // 以撒的结合：重生
const STEAM_BASE = 'https://steamcommunity.com';
const STEAM_PREFIX = '7656119';              // SteamID64 固定前缀（非此前缀会被 Steam 拒绝）

// Steam 返回的错误文案 → 统一错误码
const ERROR_MAP = {
  'steam_id_is_private': 'private',
  'could_not_find_player': 'notfound',
  'profile_could_not_be_found': 'notfound',
  'could_not_find_this_profile': 'notfound',
};

// 通用取值正则：兼容 <tag>text</tag> 与 <tag><![CDATA[text]]></tag>
const RE_VAL = (tag) => new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([^<]*?)(?:\\]\\]>)?</${tag}>`);

// 短链解析成功标志：能匹配到 17 位数字 steamID64
const RE_STEAMID64 = /<steamID64>\s*(\d{17})/;

function cors(json, status) {
  return new Response(JSON.stringify(json), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * 把用户输入解析成 steamID64。
 * 支持：17 位数字 / profiles 链接 / 自定义短链 / 传统 STEAM_x 与 SteamID3 / 短数字 ID / 自定义 URL 名
 */
async function resolveSteamId(input) {
  const q = String(input || '').trim();
  if (!q) return { error: 'badinput' };
  // 已是 17 位数字
  if (/^\d{17}$/.test(q)) {
    if (!q.startsWith(STEAM_PREFIX)) return { error: 'badinput' };
    return { steamid: q };
  }
  // profiles/7656119... 链接
  let m = q.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (m) return { steamid: m[1] };
  // 自定义短链链接 steamcommunity.com/id/<name>
  m = q.match(/steamcommunity\.com\/id\/([A-Za-z0-9_-]+)/i);
  if (m) return resolveVanity(m[1]);
  // 文本里藏着的 17 位数字
  m = q.match(/(7656119\d{10})/);
  if (m) return { steamid: m[1] };
  // 传统 STEAM_0:x:y
  m = q.match(/^STEAM_([0-5]):([01]):(\d+)$/i);
  if (m) {
    const z = (m[3] * 2) + +m[2];
    const steamid = 76561197960265728 + z; // 76561197960265729 是公开资料显示的最早账号之一
    return { steamid: String(steamid) };
  }
  // SteamID3 [U:1:n]
  m = q.match(/^\[?U:1:(\d+)\]?$/i);
  if (m) {
    const steamid = 76561197960265728 + +m[1];
    return { steamid: String(steamid) };
  }
  // 短数字 ID 或自定义 URL 名：交给短链解析
  const name = q.replace(/^\/+|\/+$/g, '');
  if (/^[A-Za-z0-9_-]{2,32}$/.test(name)) {
    return resolveVanity(name);
  }
  return { error: 'badinput' };
}

/** 自定义短链解析：steamcommunity.com/id/<name>?xml=1 → steamID64 */
async function resolveVanity(name) {
  try {
    const resp = await fetch(`${STEAM_BASE}/id/${encodeURIComponent(name)}?xml=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (isaac-achievement-checklist)' },
    });
    const xml = await resp.text();
    const found = xml.match(RE_STEAMID64);
    if (!found) return { error: 'notfound' };
    if (!found[1].startsWith(STEAM_PREFIX)) return { error: 'badinput' };
    return { steamid: found[1] };
  } catch (e) {
    return { error: 'unknown' };
  }
}

/** 拉取并解析某用户《以撒》的成就 XML，返回已解锁的成就 apiname 列表 */
async function fetchUnlocked(steamid) {
  let resp;
  try {
    resp = await fetch(`${STEAM_BASE}/profiles/${steamid}/stats/${GAME_APPID}/?xml=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (isaac-achievement-checklist)' },
    });
  } catch (e) {
    return { error: 'unknown' };
  }

  let text = '';
  try { text = await resp.text(); } catch (e) { return { error: 'unknown' }; }

  // 上游非 200：返回 HTML/错误页（如 WAF 拦截、限流），按 unknown 处理
  if (!resp.ok || /^\s*<!DOCTYPE|^\s*<html/i.test(text)) {
    return { error: 'unknown' };
  }

  // 隐私限制
  const priv = text.match(RE_VAL('privacyState'));
  const vis = text.match(RE_VAL('visibilityState'));
  if (priv && priv[1].trim() === 'private') return { error: 'private' };
  if (vis && vis[1].trim() !== '3') return { error: 'private' };

  // <error> 节点（短链解析失败等）
  const errMatch = text.match(/<error>\s*(?:<!\[CDATA\[)?([^<]*?)(?:\]\]>)?\s*<\/error>/);
  if (errMatch) {
    return { error: ERROR_MAP[errMatch[1].trim()] || 'unknown' };
  }

  // 提取所有 closed="1" 的成就 apiname（closed="1" 表示已解锁）
  // 逐块匹配 <achievement closed="1">...</achievement>，再从中取 <apiname>
  const unlocked = [];
  const RE_ACH_BLOCK = /<achievement\b[^>]*\bclosed="1"[^>]*>([\s\S]*?)<\/achievement>/g;
  const RE_APINAME = /<apiname>(?:<!\[CDATA\[)?([^<]*?)(?:\]\]>)?<\/apiname>/;
  let block;
  while ((block = RE_ACH_BLOCK.exec(text)) !== null) {
    const m = block[1].match(RE_APINAME);
    if (m) unlocked.push(m[1]);
  }
  return { unlocked };
}

/** /api/steam 处理器 */
async function handleSteam(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return cors({ ok: false, error: 'method' }, 405);
  }
  const q = url.searchParams.get('q');
  if (!q || !q.trim()) return cors({ ok: false, error: 'badinput' }, 400);

  const resolved = await resolveSteamId(q);
  if (resolved.error) {
    const status = resolved.error === 'badinput' ? 400 : 404;
    return cors({ ok: false, error: resolved.error }, status);
  }

  const result = await fetchUnlocked(resolved.steamid);
  if (result.error) {
    const status = result.error === 'private' ? 403 : result.error === 'unknown' ? 502 : 404;
    return cors({ ok: false, error: result.error }, status);
  }
  return cors({ ok: true, unlocked: result.unlocked });
}

/** 兼容性：`/steam-achievements`（旧版路径）→ 重定向到新接口 */
function handleLegacySteam(request, url) {
  const steamid = url.searchParams.get('steamid');
  const q = steamid || '';
  const redirect = new URL('/api/steam', url);
  redirect.searchParams.set('q', q);
  return Response.redirect(redirect.toString(), 308);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // API 路由优先（静态资源由 env.ASSETS 直接服务）
    if (pathname === '/api/steam' || pathname === '/api/steam/') {
      return handleSteam(request, url);
    }
    // 旧路径兼容（可选，如不需要可删除）
    if (pathname === '/steam-achievements' || pathname === '/steam-achievements/') {
      return handleLegacySteam(request, url);
    }

    // 其余请求交给静态资源绑定：index.html / sw.js / pwa/* 等
    return env.ASSETS.fetch(request);
  },
};

import { Ctx } from '../types';

/**
 * Steam 成就代理服务
 * 绕过 Steam API 的 CORS 限制，把 steamcommunity.com 的成就 XML 规范化为
 * { ok, unlocked } JSON，供前端 fetch 拉取《以撒的结合》(appid 250900) 已解锁成就。
 */
const GAME_APPID = '250900';
const STEAM_BASE = 'https://steamcommunity.com';
const STEAM_PREFIX = '7656119'; // SteamID64 固定前缀（实测非此前缀会被 Steam 拒）

const ERROR_MAP: Record<string, string> = {
  steam_id_is_private: 'private',
  could_not_find_player: 'notfound',
  profile_could_not_be_found: 'notfound',
  could_not_find_this_profile: 'notfound',
};

// 通用取值正则：兼容 <tag>text</tag> 与 <tag><![CDATA[text]]></tag>
const RE_VAL = (tag: string) =>
  new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([^<]*?)(?:\\]\\]>)?</${tag}>`);

// 短链解析成功标志：能匹配到 17 位数字 steamID64
const RE_STEAMID64 = /<steamID64>\s*(\d{17})/;

const UA = { 'User-Agent': 'Mozilla/5.0 (isaac-achievement-checklist)' };

export default class SteamService {
  /** 自定义短链解析：steamcommunity.com/id/<name>?xml=1 → steamID64 */
  static resolveVanity = async (name: string): Promise<string | null> => {
    try {
      const resp = await fetch(`${STEAM_BASE}/id/${encodeURIComponent(name)}?xml=1`, {
        headers: UA,
      });
      const xml = await resp.text();
      const found = xml.match(RE_STEAMID64);
      return found && found[1] ? found[1] : null;
    } catch {
      return null;
    }
  };

  /** 拉取并解析某用户《以撒》的成就 XML，返回已解锁的成就 apiname 列表 */
  static fetchUnlocked = async (steamid: string) => {
    let resp: Response;
    try {
      resp = await fetch(`${STEAM_BASE}/profiles/${steamid}/stats/${GAME_APPID}/?xml=1`, {
        headers: UA,
      });
    } catch {
      return { error: 'unknown' };
    }

    let text = '';
    try {
      text = await resp.text();
    } catch {
      return { error: 'unknown' };
    }

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
    const unlocked: string[] = [];
    const RE_ACH_BLOCK = /<achievement\b[^>]*\bclosed="1"[^>]*>([\s\S]*?)<\/achievement>/g;
    const RE_APINAME = /<apiname>(?:<!\[CDATA\[)?([^<]*?)(?:\]\]>)?<\/apiname>/;
    let block: RegExpExecArray | null;
    while ((block = RE_ACH_BLOCK.exec(text)) !== null) {
      const m = block[1].match(RE_APINAME);
      if (m) unlocked.push(m[1]);
    }
    return { unlocked };
  };

  /** 把用户输入解析成 steamID64，返回 { steamid } 或 { error } */
  static resolveSteamId = async (input: string) => {
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
    if (m) {
      const sid = await SteamService.resolveVanity(m[1]);
      if (!sid) return { error: 'notfound' };
      if (!sid.startsWith(STEAM_PREFIX)) return { error: 'badinput' };
      return { steamid: sid };
    }
    // 文本里藏着的 17 位数字
    m = q.match(/(7656119\d{10})/);
    if (m) return { steamid: m[1] };
    // 传统 STEAM_0:x:y
    m = q.match(/^STEAM_([0-5]):([01]):(\d+)$/i);
    if (m) {
      const z = Number(m[3]) * 2 + Number(m[2]);
      return { steamid: String(76561197960265728 + z) };
    }
    // SteamID3 [U:1:n]
    m = q.match(/^\[?U:1:(\d+)\]?$/i);
    if (m) {
      return { steamid: String(76561197960265728 + Number(m[1])) };
    }
    // 短数字 ID 或自定义 URL 名：交给短链解析
    const name = q.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9_-]{2,32}$/.test(name)) {
      const sid = await SteamService.resolveVanity(name);
      if (!sid) return { error: 'notfound' };
      if (!sid.startsWith(STEAM_PREFIX)) return { error: 'badinput' };
      return { steamid: sid };
    }
    return { error: 'badinput' };
  };

  /** 处理器：输入 → 统一 JSON 响应 */
  static handle = async (ctx: Ctx) => {
    const q = ctx.req.query('q');
    if (!q || !q.trim()) {
      return ctx.json({ ok: false, error: 'badinput' }, 400);
    }

    const resolved = await SteamService.resolveSteamId(q);
    if (resolved.error) {
      const status = resolved.error === 'badinput' ? 400 : 404;
      return ctx.json({ ok: false, error: resolved.error }, status);
    }

    const result = await SteamService.fetchUnlocked(resolved.steamid);
    if (result.error) {
      const status =
        result.error === 'private' ? 403 : result.error === 'unknown' ? 502 : 404;
      return ctx.json({ ok: false, error: result.error }, status);
    }
    return ctx.json({ ok: true, unlocked: result.unlocked });
  };

  /** 兼容旧路径 /steam-achievements?steamid=<id>（早期版本前端使用） */
  static handleLegacy = async (ctx: Ctx) => {
    const steamid = ctx.req.query('steamid');
    if (!steamid || !steamid.trim()) {
      return ctx.json({ ok: false, error: 'badinput' }, 400);
    }
    const resolved = await SteamService.resolveSteamId(steamid);
    if (resolved.error) {
      const status = resolved.error === 'badinput' ? 400 : 404;
      return ctx.json({ ok: false, error: resolved.error }, status);
    }
    const result = await SteamService.fetchUnlocked(resolved.steamid);
    if (result.error) {
      const status =
        result.error === 'private' ? 403 : result.error === 'unknown' ? 502 : 404;
      return ctx.json({ ok: false, error: result.error }, status);
    }
    return ctx.json({ ok: true, unlocked: result.unlocked });
  };
}

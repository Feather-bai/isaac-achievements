import { describe, expect, it } from 'vitest';

import SteamService from './steamService';

describe('SteamService', () => {
  describe('resolveSteamId', () => {
    it('接受 17 位 SteamID64', async () => {
      const r = await SteamService.resolveSteamId('76561198015863878');
      expect(r).toEqual({ steamid: '76561198015863878' });
    });

    it('接受非 7656119 前缀的 17 位数字（拒绝）', async () => {
      const r = await SteamService.resolveSteamId('12345678901234567');
      expect(r.error).toBe('badinput');
    });

    it('接受 profiles 链接', async () => {
      const r = await SteamService.resolveSteamId(
        'https://steamcommunity.com/profiles/76561198015863878'
      );
      expect(r.steamid).toBe('76561198015863878');
    });

    it('接受文本中的 SteamID64', async () => {
      const r = await SteamService.resolveSteamId('我的ID是76561198015863878求加');
      expect(r.steamid).toBe('76561198015863878');
    });

    it('接受传统 STEAM_0:1:123', async () => {
      const r = await SteamService.resolveSteamId('STEAM_0:1:123');
      expect(r.steamid).toBe(String(76561197960265728 + 123 * 2 + 1));
    });

    it('接受 SteamID3 [U:1:123]', async () => {
      const r = await SteamService.resolveSteamId('[U:1:123]');
      expect(r.steamid).toBe(String(76561197960265728 + 123));
    });

    it('拒绝无法识别的输入', async () => {
      const r = await SteamService.resolveSteamId('@@@不认识的输入@@@');
      expect(r.error).toBe('badinput');
    });
  });

  describe('fetchUnlocked 解析', () => {
    it('正确提取 closed="1" 的成就 apiname', async () => {
      const xml = `<?xml version="1.0"?><playerstats><achievements>
<achievement closed="1"><name><![CDATA[Magdalene]]></name><apiname><![CDATA[1]]></apiname><description><![CDATA[Unlocked a new character.]]></description></achievement>
<achievement closed="0"><name><![CDATA[Cain]]></name><apiname><![CDATA[2]]></apiname><description><![CDATA[Unlocked a new character.]]></description></achievement>
<achievement closed="1"><name><![CDATA[Monstro]]></name><apiname><![CDATA[3]]></apiname></achievement>
</achievements></playerstats>`;

      // 通过 mock fetch 注入 XML
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () =>
        new Response(xml, { status: 200 })) as typeof fetch;
      try {
        const r = await SteamService.fetchUnlocked('76561198015863878');
        expect(r.unlocked).toEqual(['1', '3']);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('隐私资料返回 private', async () => {
      const xml = `<playerstats><privacyState>private</privacyState></playerstats>`;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () =>
        new Response(xml, { status: 200 })) as typeof fetch;
      try {
        const r = await SteamService.fetchUnlocked('76561198015863878');
        expect(r.error).toBe('private');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('非 200 上游按 unknown 处理', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () =>
        new Response('blocked', { status: 403 })) as typeof fetch;
      try {
        const r = await SteamService.fetchUnlocked('76561198015863878');
        expect(r.error).toBe('unknown');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

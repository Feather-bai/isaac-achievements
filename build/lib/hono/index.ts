import { Hono } from 'hono';

import { Bindings } from './types';
import SteamService from './service/steamService';

const app = new Hono<{ Bindings: Bindings }>();

// 新版 API：GET /api/steam?q=<SteamID / 链接 / 自定义短链>
app.get('/api/steam', SteamService.handle);

// 兼容旧路径：/steam-achievements?steamid=<id> → 交给同一个处理器
// （早期版本前端用 STEAM_WORKER_URL 指向 /steam-achievements，保留不破坏）
app.get('/steam-achievements', SteamService.handleLegacy);

// 未匹配的 API 路由统一 404
app.all('/api/*', (ctx) => ctx.json({ ok: false, error: 'notfound' }, 404));

export default app;

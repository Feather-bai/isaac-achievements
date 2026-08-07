# 以撒的结合全成就完成清单 — Cloudflare Worker 部署

一个 Cloudflare Worker 项目，同时承载：

1. **静态页面**：`index.html`（单文件应用，内嵌全部 CSS / JS / 图标）、`sw.js`（Service Worker）、`pwa/`（manifest 与图标）
2. **API 转发**：`/api/steam?q=...` 拉取 Steam 成就 XML 并规范化为 `{ok, unlocked}` JSON，供前端 Steam 导入功能使用

前端 `index.html` 的 `getSteamProxy()` 会自动把「当前域名」当作代理地址，因此网页和 API 同源部署即可直接使用，无需改任何前端代码。

## 目录结构

```
worker-project/
├── src/
│   └── index.js        # Worker 主逻辑（静态路由 + /api/steam 转发）
├── public/             # 静态资源目录（由 env.ASSETS 绑定托管）
│   ├── index.html      # 网页本体（从源项目复制）
│   ├── sw.js           # Service Worker（离线缓存 / PWA）
│   └── pwa/
│       ├── manifest.json
│       ├── new-icon-192.png
│       └── new-icon-512.png
├── wrangler.jsonc      # Wrangler 配置
├── package.json
└── README.md
```

## 一、用 Wrangler 部署（推荐，命令行方式）

前置要求：已安装 Node.js（≥18）和 Wrangler（≥4.0）。本项目使用 Wrangler 4.119.0。

### 1. 登录 Cloudflare

```bash
wrangler login
```

会打开浏览器，授权你的 Cloudflare 账号。

### 2. 本地预览（可选）

在 `worker-project` 目录下执行：

```bash
npx wrangler dev
```

打开 `http://localhost:8787` 即可看到网页，`/api/steam?q=<steamid>` 也可在本机测试。

### 3. 部署

```bash
npx wrangler deploy
```

部署成功后终端会显示一个 `*.workers.dev` 地址，例如：

```
https://isaac-achievement.<你的子域>.workers.dev
```

### 4. 验证

```bash
# 网页
curl -I https://isaac-achievement.<你的子域>.workers.dev/

# API（换成你自己的 SteamID）
curl "https://isaac-achievement.<你的子域>.workers.dev/api/steam?q=76561198015863878"
```

API 应返回 `{"ok":true,"unlocked":["1","2",...]}`。

## 二、用 Cloudflare 面板部署（无命令行方式）

1. 打开 https://dash.cloudflare.com → **Workers & Pages** → **创建** → **Worker**
2. 给 Worker 起名（如 `isaac-achievement`），点击 **编辑代码**
3. 在左侧新建文件 `index.js`，把 `src/index.js` 的内容粘贴进去
4. **静态资源**：点击「设置」→「变量与绑定」→「静态资源」，上传 `public/` 目录（index.html + sw.js + pwa/）
5. 点击 **部署**
6. 访问 `https://isaac-achievement.<你的子域>.workers.dev` 验证

> 面板方式每上传一次静态资源需要重新上传，命令行 `wrangler deploy` 一条命令即可完成，长期维护建议用命令行。

## 三、绑定自定义域名（可选）

在 Cloudflare 控制台 → 你的 Worker → **设置** → **域和路由** → **添加自定义域名**，可把 `steam.19x19.top` 之类的域名指向这个 Worker（需该域名托管在 Cloudflare）。

绑定后前端无需任何改动即可通过新域名访问。

## API 说明

### `GET /api/steam?q=<输入>`

- `q` 支持：17 位 SteamID64、`steamcommunity.com/profiles/<id>` 链接、`steamcommunity.com/id/<name>` 自定义链接、`STEAM_x:y:z` / `[U:1:n]`、自定义 URL 名。
- 成功返回：`{"ok":true,"unlocked":["<apiname>",...]}`（`apiname` 对应 Steam 成就内部 ID，即网页 DATA 中的 `id`）。
- 失败返回（HTTP 400/403/404/502）：
  - `{"ok":false,"error":"badinput"}` 输入无法识别
  - `{"ok":false,"error":"private"}` 成就 / 资料私密
  - `{"ok":false,"error":"notfound"}` 用户不存在
  - `{"ok":false,"error":"unknown"}` 上游异常（如 Steam 限流）

### 旧路径兼容

`/steam-achievements?steamid=<id>` 会 308 重定向到 `/api/steam?q=<id>`（早期版本的 Worker 使用旧路径，保留兼容）。

## 更新网页

改完 `index.html` 后，把它复制到 `public/index.html`，然后重新执行：

```bash
npx wrangler deploy
```

**注意**：网页引用 `pwa/manifest.json` 和 `sw.js`，若这两个文件有更新也要同步复制到 `public/`。改动 `sw.js` 时记得把里面的 `CACHE_NAME` 版本号 +1，避免浏览器使用旧缓存。

## 常见问题

- **网页能打开但 Steam 导入失败**：先确认 API 可访问（`curl /api/steam?q=...`），再确认网页是通过 http(s) 打开的（`file://` 本地打开时会走硬编码的 `STEAM_PROXY_URL`）。
- **`npx wrangler login` 打不开浏览器**：可改用 `npx wrangler login` 生成的令牌手动登录，或在控制台 `API 令牌` 里生成令牌后用 `CLOUDFLARE_API_TOKEN` 环境变量。
- **部署报 `compatibility_date` 相关错误**：把 `wrangler.jsonc` 里的 `compatibility_date` 改为更新一点的日期（比如今天往前 30 天内的某个日期）。

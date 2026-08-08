# 以撒的结合全成就完成清单（Cloudflare Pages + Functions）

按照 [ailuoku6/gy_nav](https://github.com/ailuoku6/gy_nav) 的架构模板重构。

## 架构

采用 **Cloudflare Pages + Functions**（而非 Workers 静态资源），API 层用 **Hono**：

```
isaac-pages/
├── index.html                    # 前端（自包含单文件应用，含全部 CSS/JS/数据/图标）
├── public/                       # PWA 资源（由 Pages 托管）
│   ├── sw.js                     # Service Worker（离线缓存）
│   └── pwa/                      # manifest.json + 图标
├── functions/
│   └── api/
│       └── [[routes]].ts         # API 唯一入口 → handle(app)
├── lib/
│   └── hono/
│       ├── index.ts              # Hono 应用（定义 /api/steam 路由）
│       ├── types/index.ts        # Bindings / Ctx 类型
│       └── service/
│           ├── steamService.ts   # Steam 成就代理逻辑
│           └── steamService.test.ts
├── scripts/
│   └── build.mjs                 # 构建脚本（组装 build/）
├── wrangler.toml                 # Pages 部署配置
├── package.json
├── vitest.config.ts
└── tsconfig*.json
```

## 与模板的对应关系

| gy_nav 模板 | 本项目 |
|---|---|
| `functions/api/[[routes]].ts` → `handle(app)` | 相同（唯一 API 入口） |
| `lib/hono/index.ts`（Hono app） | 相同，只保留 `/api/steam` 路由 |
| `lib/hono/service/*Service.ts`（业务类） | `steamService.ts` |
| `lib/hono/types/index.ts`（Bindings/Ctx） | 相同（本项目无持久化绑定） |
| `wrangler.toml` `pages_build_output_dir = "build"` | 相同 |
| build 脚本：`cp -r functions build/ && cp -r lib build/` | `scripts/build.mjs` 完成同样组装 |

## API

### `GET /api/steam?q=<输入>`

- `q` 支持：17 位 SteamID64、`/profiles/` 链接、`/id/` 自定义短链、`STEAM_x:y:z` / `[U:1:n]`、自定义 URL 名
- 成功：`{"ok":true,"unlocked":["1","2",...]}`
- 失败：`{"ok":false,"error":"badinput|private|notfound|unknown"}`（HTTP 400/403/404/502）

### `GET /steam-achievements?steamid=<id>`（旧路径兼容）

早期版本前端使用的路径，保留不破坏。

## 本地开发

```bash
npm install

# 单元测试
npm test

# 构建产物（生成 build/）
npm run build

# 本地预览（Pages + Functions 一起跑）
npm run preview-api   # = npm run build && wrangler pages dev
```

打开 `http://localhost:8788` 即可看到网页，`/api/steam` 也可本机测试。

## 部署

```bash
# 登录（首次）
npx wrangler login

# 部署到 Cloudflare Pages
npm run deploy        # = npm run build && wrangler pages deploy build
```

或把本仓库推到 GitHub 后，在 Cloudflare Dashboard → **Workers & Pages** → **创建 → Pages → 连接 Git 仓库**，构建命令填 `npm run build`，输出目录填 `build`，之后每次 push 自动重新部署。

> 注意：前端 `getSteamProxy()` 会自动把「当前域名」作为代理地址，网页与 API 同源即可直接使用 Steam 导入，无需改前端代码。

## 常见问题

- **页面能开但 Steam 导入失败**：确认 `/api/steam` 可访问（`curl "https://<你的域名>/api/steam?q=<steamid>"`）。
- **`wrangler pages dev` 端口占用**：用 `--port` 指定（如 `wrangler pages dev --port 8788`）。
- **部署后域名想绑定自定义域**：在 Pages 项目 → **自定义域** 中添加 `isaac-achievement.19x19.top`（需该域名托管在 Cloudflare 或改 NS 指向 Cloudflare）。

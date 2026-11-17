# 以撒的结合 全成就完成清单

> 《The Binding of Isaac》全成就 / 全角色通关进度追踪工具 · 支持 Steam 成就导入与存档解析

一个开箱即用的静态网页工具，帮你逐项追踪《以撒的结合》**全部 637 项成就**的完成情况（含普通角色 241、堕化角色 120、完成挑战 89、Boss 击败 48 等分类）。所有数据保存在浏览器本地，无需注册登录，离线可用。

**在线体验**：<https://isaac-achievement.19x19.top/>

---

## ✨ 功能特性

- **完整成就清单**：按 9 大分类整理全部 637 项成就（角色解锁 / 通关 / 挑战 / Boss 等），每条附解锁条件，点击可跳转灰机 Wiki 详情
- **进度追踪**：勾选即自动保存到浏览器 `localStorage`，下次打开进度还在
- **Steam 成就导入**：粘贴 Steam 资料链接 / 17 位 ID / 自定义短链，一键拉取已解锁成就自动勾选（两种模式）
- **存档导入**：直接导入游戏本地存档文件（`persistentgamedata2.dat`），自动解析已解锁成就
- **优先级标记**：自定义标记哪些成就「想先做」，导出 / 导入优先级预设
- **主题切换**：深色 / 浅色 / 跟随系统
- **完全离线**：单文件应用，全部数据、图标、素材内嵌，断网也能用；支持 PWA 安装到主屏幕

## 🚀 快速使用

1. 打开网页（[在线版](https://isaac-achievement.19x19.top/) 或本地双击 `index.html`）
2. 对照清单勾选你已完成的成就
3. 想从 Steam 同步？在「更多操作」里粘贴你的 Steam 资料链接，点 **从 Steam 导入**，已解锁的成就会自动打勾
4. 定期导出备份，换设备时导入即可恢复

### Steam 导入支持两种模式

| 模式 | 说明 |
|---|---|
| **合并导入**（默认） | 保留你当前已勾选的，把 Steam 已解锁的并集打勾 |
| **完全同步** | 以 Steam 为准，Steam 未解锁的成就会被取消勾选 |

勾选「记住我的 Steam 账号」后，下次打开面板自动回填。

### 支持的输入格式

- 17 位 SteamID64（如 `76561198015863878`）
- Steam 资料页链接（`steamcommunity.com/profiles/<id>` / `/id/<name>`）
- 自定义 URL 名（如 `multiplayerachievements`）
- 传统 `STEAM_x:y:z`、SteamID3 `[U:1:n]`

## 🛠 技术说明

| 项目 | 说明 |
|---|---|
| **前端** | 自包含单文件 HTML，全部 CSS / JS / 数据 / 图标内嵌（base64），无任何外部依赖，离线可用 |
| **数据来源** | 成就条件参考[灰机 Wiki《以撒的结合》](https://isaac.huijiwiki.com/wiki/%E6%88%90%E5%B0%B1) |
| **进度存储** | 浏览器 `localStorage`（`isaac_achieve_state_v1`），清除浏览器数据会丢失，请定期导出备份 |
| **Steam 导入** | 通过 Cloudflare Pages Function 代理拉取 `steamcommunity.com` 成就数据（绕过浏览器跨域限制） |
| **部署** | Cloudflare Pages（静态托管 + Functions 转发） |

### 架构

```
functions/api/[[routes]].ts    # API 入口（Hono）
lib/hono/service/steamService.ts   # Steam 成就代理逻辑
public/                        # PWA 资源（sw.js / manifest / 图标）
index.html                     # 网页本体（单文件应用）
wrangler.toml                  # Pages 部署配置（pages_build_output_dir = "build"）
```

> ⚠️ **隐私提示**：Steam 导入需要读取你的 Steam 成就数据。Steam 资料设为**公开**才能正常导入；若资料私密，会返回「成就私密」提示。进度与 Steam ID 均只保存在你自己的浏览器本地，不会上传到任何服务器。

## 📦 本地开发 / 部署

```bash
# 安装依赖
npm install

# 单元测试（SteamID 解析、成就 XML 解析等）
npm test

# 构建产物（生成 build/）
npm run build

# 本地预览（静态页 + API 一起跑）
npm run preview-api

# 部署到 Cloudflare Pages
npm run deploy
```

也可以把仓库推到 GitHub，在 Cloudflare Dashboard → **Workers & Pages → 创建 → Pages → 连接 Git 仓库**，构建命令填 `npm run build`，输出目录填 `build`，之后每次 push 自动重新部署。

## 📄 数据说明

- 共 **637 项成就**，按类型分为：普通角色 241 · 堕化角色 120 · 其余成就 89 · 完成挑战 48 · Boss 击败 38 · 解锁挑战 34 · 角色解锁 33 · 通过关卡 20 · 解锁关卡 14
- 成就 ID 与 Steam 内部 `apiname` 对应，用于 Steam 导入时匹配

## 📃 License

MIT

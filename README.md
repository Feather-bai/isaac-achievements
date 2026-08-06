# 以撒的结合 全成就完成清单

一个静态网页工具，用于追踪《以撒的结合》全角色通关 / 全成就完成进度，支持优先级标记、存档导入导出。

## 功能

- 完整成就清单（按类型 / 角色分类）
- 进度追踪，自动保存到浏览器本地（localStorage）
- 存档导出 / 导入（备份进度）
- 优先级标记
- 全自包含单文件，无任何外部依赖，离线可用

## 使用方式

直接打开 `index.html` 即可使用。

### 部署到 GitHub Pages

本仓库已开启 GitHub Pages（Settings → Pages → Branch: `main` → `/ (root)`）。部署后访问：

```
https://<你的用户名>.github.io/<仓库名>/
```

## 技术说明

- 单文件 HTML，所有数据、图标、manifest 均内嵌（base64），无网络请求
- 进度保存在浏览器 `localStorage` 中，清除浏览器数据会丢失进度，请定期导出存档备份
- 成就条件数据参考《以撒的结合》灰机 wiki（https://isaac.huijiwiki.com）

## 文件结构

```
index.html   # 全部内容（网页本体）
README.md    # 本说明
```

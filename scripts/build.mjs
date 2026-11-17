// 构建脚本：把前端静态资源 + functions + lib 组装进 build/ 目录
// Cloudflare Pages 会按约定编译 functions/ 目录中的函数，并托管 build/ 里的静态资源
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, 'build');

// 清理旧的 build 目录
rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });

// 1. 前端静态资源（自包含单文件应用 + PWA 资源）
cpSync(resolve(root, 'index.html'), resolve(build, 'index.html'));
cpSync(resolve(root, 'public'), resolve(build, 'public'), { recursive: true });

// 2. functions/ 目录（Cloudflare Pages Functions）
cpSync(resolve(root, 'functions'), resolve(build, 'functions'), { recursive: true });

// 3. lib/ 目录（functions 运行时代码依赖）
cpSync(resolve(root, 'lib'), resolve(build, 'lib'), { recursive: true });

// 移除 lib 中的测试文件（模板同样做法：find build/lib -name '*.test.ts' -delete）
execSync('find lib -name "*.test.ts" -delete', { cwd: build });

console.log('✅ build/ 已生成：');
for (const entry of readdirSync(build)) {
  console.log(`   - ${entry}`);
}

# 第一桶金

一个网页小游戏，一局几分钟。玩家是老板，从五万块起步，把中国的货卖到马来西亚，经营两年（8 个季度），每半年选一条路线，看能不能赚到一百万。

- 在线试玩：https://test.prismice.cn
- 旧版（按季度、三个功能区）在标签 `旧版-季度制`，网页里加 `?old=1` 也能打开。

> 这一份由 Claude Code 按规则包第 1 版开发，用来试验规则包能不能把游戏做到理想的效果。
> 规则见 `AGENTS.md` 和 `docs/`。

## 下载源码并在自己电脑上运行

需要先装好 [Git](https://git-scm.com/) 和 [Node.js](https://nodejs.org/) 20 或更高版本，然后在终端里依次运行：

```bash
git clone https://github.com/zhubing20011218-hub/first-gold.git
cd first-gold
npm install
npm run dev
```

终端里会出现一个 `http://localhost:` 开头的网址，用浏览器打开就能玩。以后要拿到最新的代码，在 `first-gold` 文件夹里运行 `git pull`。

## 命令

| 命令 | 作用 |
|---|---|
| `npm install` | 安装依赖，同时打开提交之前的自动检查 |
| `npm run dev` | 本地开发 |
| `npm run build` | 类型检查，再打包到 `dist/` |
| `npm run test` | 运行全部测试 |
| `npm run preview` | 在本地预览打包结果 |
| `npm run check` | 自动检查 K1 到 K5 |
| `npm run check:full` | 自动检查 K1 到 K8 |
| `bash deploy/deploy.sh` | 部署到 https://test.prismice.cn（主站香港服务器，只传改过的文件） |

## 运行环境

Node.js 20 或更高（开发时用的是 24.14.1）。

## 主要依赖的版本（2026-11-20 安装）

| 依赖 | 版本 |
|---|---|
| react、react-dom | 19.3.1 |
| vite | 8.3.8 |
| @vitejs/plugin-react | 6.3.0 |
| typescript | 7.0.2 |
| tailwindcss、@tailwindcss/vite | 4.3.5 |
| vitest | 5.1.1 |

## 自动拦截

- 提交之前：`.githooks/pre-commit` 运行 `npm run check`。`npm install` 时 `prepare` 会把 git 的钩子目录设成 `.githooks`。
- 助手停下来之前：`scripts/check/stop-hook.mjs`。配置写在 `.qoder/settings.json`（Qoder）和 `.claude/settings.json`（Claude Code），两份内容一样。
- 检查员的定义：`.qoder/agents/inspector.md`（规则包里的原件）；`.claude/agents/inspector.md` 是给 Claude Code 用的同一份内容。

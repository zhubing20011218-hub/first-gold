// 自动截图和画面检查（docs/11 第四节）：npm run shots。
// 打开本地预览，依次进入每个页面，在 5 种窗口大小下截图，同时运行页面自检（src/ui/dev/selfcheck.ts，和 ?debug=1 共用）。
// Playwright 只在开发时用，不会进入发布的网站。
import { chromium, type ConsoleMessage, type Page } from "playwright";
import { preview } from "vite";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "过程截图", "自动");
const SIZES: [number, number][] = [
  [1440, 800],
  [1440, 680],
  [1280, 720],
  [1920, 1080],
  [390, 844],
];

/** 要截图的页面：名字、网址参数；scrolls 表示可以上下滚动（不查 S2）；world 表示要等世界画好。
 *  任务 06 第一步只有展示页，第二、三步再加世界和各个页面。 */
export const PAGES: { name: string; query: string; scrolls?: boolean; world?: boolean }[] = [{ name: "gallery", query: "?gallery=1", scrolls: true }];

interface CheckResult {
  id: string;
  pass: boolean;
  offenders: string[];
}

interface PageResult {
  page: string;
  size: string;
  failures: string[];
}

async function waitWorld(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __worldReady?: boolean }).__worldReady === true, undefined, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

async function checkPage(page: Page, scrolls: boolean, w: number, h: number): Promise<string[]> {
  const failures: string[] = [];
  const results = (await page.evaluate(() => {
    const f = (window as unknown as { __selfcheck?: () => CheckResult[] }).__selfcheck;
    return f ? f() : null;
  })) as CheckResult[] | null;
  if (!results) failures.push("页面没有提供 window.__selfcheck");
  for (const r of results ?? []) if (!r.pass) failures.push(`${r.id}：${r.offenders.join("；")}`);
  // S2：1440 × 800 时没有上下滚动
  if (!scrolls && w === 1440 && h === 800) {
    const sh = await page.evaluate(() => document.documentElement.scrollHeight);
    if (sh > h) failures.push(`S2：页面高 ${sh}，超过 ${h}`);
  }
  // S10：世界的画布不是空的
  const sample = await page.evaluate(() => {
    const f = (window as unknown as { __worldSample?: () => string[] }).__worldSample;
    return f ? f() : null;
  });
  if (sample && new Set(sample).size < 2) failures.push("S10：世界的画布是空的");
  return failures;
}

/** 开发时只截一部分：SHOTS_SIZE=390x844、SHOTS_PAGE=decide（可以用逗号分开写几个）。完整检查不要设 */
function pick<T>(list: T[], env: string | undefined, key: (x: T) => string): T[] {
  if (!env) return list;
  const want = env.split(",");
  return list.filter((x) => want.includes(key(x)));
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const sizes = pick(SIZES, process.env.SHOTS_SIZE, ([w, h]) => `${w}x${h}`);
  const pages = pick(PAGES, process.env.SHOTS_PAGE, (p) => p.name);
  const partial = sizes.length !== SIZES.length || pages.length !== PAGES.length;
  const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: "error" });
  const base = "http://localhost:4179/";
  const browser = await chromium.launch();
  const all: PageResult[] = [];
  try {
    for (const [w, h] of sizes) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      for (const p of pages) {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("console", (m: ConsoleMessage) => {
          if (m.type() === "error") errors.push(m.text());
        });
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(base + p.query, { waitUntil: "networkidle" });
        if (p.world) await waitWorld(page);
        await page.evaluate(() => document.fonts.ready);
        // S6：页面加载完成（字体、脚本都下载完）之后没有任何网络请求。停 2 秒看有没有新的请求
        const late: string[] = [];
        page.on("request", (r) => late.push(r.url()));
        await page.waitForTimeout(2000);
        const failures = await checkPage(page, Boolean(p.scrolls), w, h);
        if (errors.length > 0) failures.push(`S5：控制台报错 ${errors.slice(0, 3).join("；")}`);
        if (late.length > 0) failures.push(`S6：加载之后还有网络请求 ${late.slice(0, 3).join("；")}`);
        // 可以滚动的页面（展示页）是在里面的一层滚动，整页截图截不到下面：先检查，再把窗口拉到内容的全高截图
        if (p.scrolls) {
          const full = await page.evaluate(() => {
            const box = document.querySelector("[data-gallery]")?.parentElement;
            return box ? box.scrollHeight : 0;
          });
          if (full > h) {
            await page.setViewportSize({ width: w, height: full });
            await page.waitForTimeout(300);
          }
        }
        await page.screenshot({ path: join(OUT, `${p.name}-${w}x${h}.png`) });
        all.push({ page: p.name, size: `${w}x${h}`, failures });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
  const bad = all.filter((r) => r.failures.length > 0);
  for (const r of all) console.log(`${r.failures.length === 0 ? "通过  " : "不通过"} ${r.page} ${r.size}${r.failures.length ? `\n    ${r.failures.join("\n    ")}` : ""}`);
  // 只截了一部分时不覆盖完整检查的结果
  if (!partial) {
    if (PAGES.some((p) => p.name === "decide")) writeComparePage();
    writeFileSync(join(OUT, "结果.json"), `${JSON.stringify(all, null, 2)}\n`);
  }
  console.log(`画面检查${partial ? "（只截了一部分）" : ""}：${all.length} 张截图，${bad.length} 张不通过`);
  process.exit(bad.length === 0 ? 0 : 1);
}

/** 对照页（docs/13 第七节）：左边是参考图，右边是实际截图 */
function writeComparePage(): void {
  const pairs: [string, string[]][] = [
    ["1-做决定.png", ["decide-1440x800.png"]],
    ["2-弹窗.png", ["popup-bulk-1440x800.png"]],
    ["3-四个季节.png", ["season-0-1440x800.png", "season-1-1440x800.png", "season-2-1440x800.png", "season-3-1440x800.png"]],
    ["4-世界的质感.png", ["season-1-1440x800.png"]],
  ];
  const rows = pairs
    .map(([ref, shots]) => {
      const right = shots.filter((s) => existsSync(join(OUT, s))).map((s) => `<img src="${s}" alt="${s}">`).join("");
      return `<section><div><h2>参考图 ${ref}</h2><img src="../../参考图/${ref}" alt="${ref}"></div><div><h2>实际</h2>${right}</div></section>`;
    })
    .join("\n");
  writeFileSync(
    join(OUT, "对照.html"),
    `<!doctype html><meta charset="utf-8"><title>对照</title><style>body{font-family:sans-serif;margin:16px}section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px}img{width:100%;border:1px solid #ccc;margin-bottom:8px}</style><h1>参考图和实际截图</h1>${rows}\n`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

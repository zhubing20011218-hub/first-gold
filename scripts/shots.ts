// 自动截图和画面检查（docs/11 第四节）：npm run shots。
// 打开本地预览，依次进入每个页面，在 docs/11 第 4.1 节的 7 种窗口大小下截图，同时运行页面自检（src/ui/dev/selfcheck.ts，和 ?debug=1 共用）。
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
  [1024, 768],
  [390, 844],
  [360, 780],
];

/** 要截图的页面：名字、网址参数；scrolls 表示可以上下滚动（不查 S2）；world 表示要等世界画好。
 *  任务 06 第二步：展示页（含世界和每一样模型）和四个季节；第三步再加各个页面。 */
export const PAGES: { name: string; query: string; scrolls?: boolean; world?: boolean }[] = [
  { name: "gallery", query: "?gallery=1", scrolls: true, world: true },
  ...["home", "setup", "decide", "popup-stock", "popup-retail", "popup-bulk", "popup-risk", "popup-push", "popup-source", "play", "settle", "settle-bankrupt", "popup-bill", "popup-desk", "popup-bulkshort", "ending-goal", "ending-survive", "ending-bankrupt", "ending-banned", "panel", "season-0", "season-1", "season-2", "season-3"].map(
    (n) => ({ name: n, query: `?demo=${n}`, world: true }),
  ),
];

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

/** 等世界画完第一帧（或者显示了替代图）。等不到返回 false */
async function waitWorld(page: Page): Promise<boolean> {
  const ok = await page
    .waitForFunction(() => (window as unknown as { __worldReady?: boolean }).__worldReady === true, undefined, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(300);
  return ok;
}

async function checkPage(page: Page, scrolls: boolean, w: number, h: number, world = false): Promise<string[]> {
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
  // 有世界的页面：既没有画布可以取颜色，也没有替代图，就是世界没出来
  if (world && !sample) {
    const fallback = await page.evaluate(() => document.querySelectorAll("[data-world-fallback]").length);
    if (fallback === 0) failures.push("S10：世界的画布取不到颜色，也没有替代图");
  }
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
  // 端口可以用 SHOTS_PORT 换（两个文件夹同时跑截图时不撞）
  const port = Number(process.env.SHOTS_PORT ?? 4179);
  const server = await preview({ preview: { port, strictPort: true }, logLevel: "error" });
  const base = `http://localhost:${port}/`;
  const browser = await chromium.launch();
  const all: PageResult[] = [];
  try {
    for (const [w, h] of sizes) {
      // 截图时用"减少动态效果"：世界里什么都不动（docs/10 第六节），每次截出来都一样
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      for (const p of pages) {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("console", (m: ConsoleMessage) => {
          if (m.type() === "error") errors.push(m.text());
        });
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(base + p.query, { waitUntil: "networkidle" });
        const worldOk = p.world ? await waitWorld(page) : true;
        await page.evaluate(() => document.fonts.ready);
        // S6：页面加载完成（字体、脚本都下载完）之后没有任何网络请求。停 2 秒看有没有新的请求
        const late: string[] = [];
        page.on("request", (r) => late.push(r.url()));
        await page.waitForTimeout(2000);
        const failures = await checkPage(page, Boolean(p.scrolls), w, h, Boolean(p.world));
        if (!worldOk) failures.push("S10：15 秒内世界没有画好");
        if (p.world && (await page.evaluate(() => document.querySelectorAll("[data-world-fallback]").length)) > 0) failures.push("S10：能用 WebGL，却显示了替代图");
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
        // S9：能关的弹窗按 Esc 能关上（P9 大单货不够、付不起时的报表不能关，不查）
        if (p.name.startsWith("popup-") && p.name !== "popup-bulkshort") {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          const left = await page.evaluate(() => document.querySelectorAll("[data-popup]").length);
          if (left > 0) failures.push("S9：按 Esc 关不上弹窗");
        }
        all.push({ page: p.name, size: `${w}x${h}`, failures });
        await page.close();
      }
      await context.close();
    }
    // S10 的后一半：关掉 WebGL 再打开有世界的页面，要看到静态的替代图，页面不报错
    if (!process.env.SHOTS_SIZE) {
      const no3d = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
      for (const [nw, nh] of [[1440, 800], [1920, 1080], [390, 844], [360, 780]] as const) {
        const context = await no3d.newContext({ viewport: { width: nw, height: nh }, deviceScaleFactor: 1, reducedMotion: "reduce" });
        for (const p of pages.filter((x) => x.world)) {
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("console", (m: ConsoleMessage) => {
            if (m.type() === "error") errors.push(m.text());
          });
          page.on("pageerror", (e) => errors.push(e.message));
          await page.goto(base + p.query, { waitUntil: "networkidle" });
          await waitWorld(page);
          await page.evaluate(() => document.fonts.ready);
          const failures = await checkPage(page, Boolean(p.scrolls), nw, nh);
          const fallback = await page.evaluate(() => document.querySelectorAll("[data-world-fallback]").length);
          if (fallback === 0) failures.push("S10：关掉 WebGL 之后没有显示替代图");
        // 地点的名字要对准图上的地点：名字的下边中点和图上的位置相差不超过 2 像素
        const off = await page.evaluate(() => {
          const out: string[] = [];
          for (const map of Array.from(document.querySelectorAll("[data-fallback-map]"))) {
            const svg = map.querySelector("svg");
            if (!svg) continue;
            const r = svg.getBoundingClientRect();
            // viewBox 1440 × 520，xMidYMid meet：图按比例放进去并居中
            const s = Math.min(r.width / 1440, r.height / 520);
            const ox = r.left + (r.width - 1440 * s) / 2;
            const oy = r.top + (r.height - 520 * s) / 2;
            for (const el of Array.from(map.querySelectorAll<HTMLElement>("[data-fx]"))) {
              const b = el.getBoundingClientRect();
              const ex = ox + Number(el.dataset.fx) * 1440 * s;
              const ey = oy + Number(el.dataset.fy) * 520 * s;
              const dx = (b.left + b.right) / 2 - ex;
              const dy = b.bottom - ey;
              if (Math.abs(dx) > 2 || Math.abs(dy) > 2) out.push(`${el.textContent ?? ""} 偏了 ${Math.round(dx)}, ${Math.round(dy)}`);
            }
          }
          return out;
        });
        if (off.length > 0) failures.push(`S10：替代图上的名字没对准地点 ${off.join("；")}`);
          if (errors.length > 0) failures.push(`S5：控制台报错 ${errors.slice(0, 3).join("；")}`);
          await page.screenshot({ path: join(OUT, `${p.name}-no3d-${nw}x${nh}.png`) });
          all.push({ page: `${p.name}（关掉 3D）`, size: `${nw}x${nh}`, failures });
          await page.close();
        }
        await context.close();
      }
      await no3d.close();
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

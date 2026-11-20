// 设计变量（docs/07 第二节、docs/08）：src/ui/theme/tokens.ts 和 Tailwind 的主题 src/ui/theme/theme.css 用的是同一组颜色，
// 并且和文档里写的一样（两边一起改错也能发现）。
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { areaColor, color, fontSize, space } from "../src/ui/theme/tokens";

const css = readFileSync(join(__dirname, "..", "src", "ui", "theme", "theme.css"), "utf8");

/** theme.css 里 --color-名字 的值，小写 */
function cssColor(name: string): string | undefined {
  return new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)?.[1].toLowerCase();
}

const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("设计变量", () => {
  it("tokens.ts 的每个颜色在 theme.css 里都有，值一样", () => {
    for (const [k, v] of Object.entries(color)) expect(cssColor(kebab(k)), k).toBe(v.toLowerCase());
    for (const [k, v] of Object.entries(areaColor)) expect(cssColor(`area-${k}`), `area-${k}`).toBe(v.toLowerCase());
  });
  it("theme.css 里的颜色都来自 tokens.ts（不多出别的颜色）", () => {
    const fromTokens = new Set([...Object.values(color), ...Object.values(areaColor)].map((v) => v.toLowerCase()));
    const inCss = [...css.matchAll(/--color-[a-z-]+:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase());
    expect(inCss.length).toBeGreaterThan(10);
    for (const v of inCss) expect(fromTokens.has(v), v).toBe(true);
  });
});

// ---------- 和文档一样（规则包第 12 版）：两边一起改错也要能发现 ----------
const ROOT = join(__dirname, "..");
const doc = (name: string): string => {
  const dir = join(ROOT, "docs");
  const file = readdirSync(dir).find((f) => f.startsWith(name));
  if (!file) throw new Error(`no ${name}`);
  return readFileSync(join(dir, file), "utf8");
};
const cssVar = (name: string): string | undefined => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1].trim();

describe("设计变量和文档一样", () => {
  it("颜色：docs/07 第二节的颜色表（和 docs/08 第五节）里每一个名字，tokens.ts 的值都一样", () => {
    const rows = [...doc("07-").matchAll(/^\| `([a-zA-Z]+)` \| `(#[0-9A-Fa-f]{6})` \|/gm), ...doc("08-").matchAll(/^\| `([a-zA-Z]+)` \| `(#[0-9A-Fa-f]{6})` \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(14);
    const c = color as Record<string, string>;
    for (const [, name, hex] of rows) expect(c[name]?.toLowerCase(), name).toBe(hex.toLowerCase());
    // 弹窗后面变暗用 ink（不透明度 40% 写在 Popup 里）
    expect(color.scrim).toBe(color.ink);
  });
  it("功能区的代表色和 docs/07 第二节一样", () => {
    const m = /进货 `(#[0-9A-F]{6})`，运营 `(#[0-9A-F]{6})`，财务 `(#[0-9A-F]{6})`/.exec(doc("07-"));
    expect(m).not.toBeNull();
    expect([areaColor.purchase, areaColor.ops, areaColor.finance]).toEqual([m?.[1], m?.[2], m?.[3]]);
  });
  it("字号：tokens.ts 和 theme.css 都只有 docs/08 第四节的 7 个", () => {
    const sec = doc("08-").split("## 四、文字")[1].split("## 五")[0];
    const fromDoc = [...sec.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
    expect(fromDoc).toEqual([12, 14, 16, 20, 28, 40, 56]);
    expect([...fontSize]).toEqual(fromDoc);
    const inCss = [...css.matchAll(/--text-[a-z]+:\s*(\d+)px;/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    expect(inCss).toEqual(fromDoc);
  });
  it("间距：tokens.ts 和 docs/08 第三节一样，Tailwind 一档是 4 像素", () => {
    const m = /间距只用这几个值（像素）：([\d、]+)。/.exec(doc("08-"));
    expect(m?.[1].split("、").map(Number)).toEqual([...space]);
    expect(cssVar("spacing")).toBe("4px");
  });
  it("圆角和厚度：可以点的东西 14、弹窗 18；厚度 3 到 4、弹窗 6（docs/07 第二节）", () => {
    expect(cssVar("radius-control")).toBe("14px");
    expect(cssVar("radius-dialog")).toBe("18px");
    expect(cssVar("shadow-solid")).toBe("0 4px 0 var(--color-ink)");
    expect(cssVar("shadow-solid-sm")).toBe("0 3px 0 var(--color-ink)");
    expect(cssVar("shadow-dialog")).toBe("0 6px 0 var(--color-ink)");
  });
  it("类名里的间距只用 docs/08 第三节的值（4、8、12、16、24、32、48，也就是 1、2、3、4、6、8、12 档）", () => {
    const list = (dir: string): string[] =>
      readdirSync(join(ROOT, dir)).flatMap((n) => {
        const p = join(ROOT, dir, n);
        return statSync(p).isDirectory() ? list(relative(ROOT, p)) : /\.(tsx|ts)$/.test(n) ? [relative(ROOT, p)] : [];
      });
    const allowed = new Set(["0", "1", "2", "3", "4", "6", "8", "12"]);
    const SPACE = /(?:^|[\s"'`:])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|bottom|left|right|translate-x|translate-y)-(\d+(?:\.\d+)?)(?![\w.])/g;
    const bad: string[] = [];
    for (const f of list("src/ui")) {
      const text = readFileSync(join(ROOT, f), "utf8");
      for (const m of text.matchAll(SPACE)) if (!allowed.has(m[1])) bad.push(`${f}: ${m[0].trim()}`);
    }
    expect(bad).toEqual([]);
  });
});

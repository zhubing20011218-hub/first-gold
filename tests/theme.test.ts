// 设计变量（docs/07 第二节、docs/08）：src/ui/theme/tokens.ts 和 Tailwind 的主题 src/ui/theme/theme.css 用的是同一组颜色。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { areaColor, color } from "../src/ui/theme/tokens";

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

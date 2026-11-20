// 规则检查：读取源代码的文字，查有没有违反约定（docs/11 第 2.2 节，docs/02 第八节第 5 条）。
// 这里有 R1、R2、R3、R5、R6、R7、R8。R4、R9、R10 在任务 06 出现对应代码时加上。
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const CODE_EXT = /\.(ts|tsx|mts|js|mjs|jsx)$/;

function listFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch (e) {
    // 只有"文件夹还不存在"时当作没有文件；其他错误照常报出来
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: string[] = [];
  for (const name of entries) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(relative(ROOT, p)));
    else if (CODE_EXT.test(name)) out.push(relative(ROOT, p));
  }
  return out;
}

/** 去掉注释，保留字符串。用来查"代码里"的内容，注释里写的不算。 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

function findHits(files: string[], pattern: RegExp, opts: { code?: boolean } = {}): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const raw = readFileSync(join(ROOT, file), "utf8");
    const text = opts.code ? stripComments(raw) : raw;
    text.split("\n").forEach((line, idx) => {
      if (pattern.test(line)) hits.push({ file, line: idx + 1, text: line.trim() });
    });
  }
  return hits;
}

function show(hits: Hit[]): string {
  return hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join("\n");
}

const engineFiles = listFiles("src/engine");
const staffFiles = listFiles("src/staff");
const allSrc = listFiles("src");
const uiLike = [...listFiles("src/ui"), ...listFiles("src/scene")];

/** 一个文件里所有 import 的路径 */
function importsOf(file: string): { spec: string; line: number }[] {
  const text = stripComments(readFileSync(join(ROOT, file), "utf8"));
  const out: { spec: string; line: number }[] = [];
  text.split("\n").forEach((line, idx) => {
    for (const m of line.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
      out.push({ spec: m[1], line: idx + 1 });
    }
  });
  return out;
}

function badImports(files: string[], banned: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    for (const { spec, line } of importsOf(file)) {
      if (banned.test(spec)) hits.push({ file, line, text: spec });
    }
  }
  return hits;
}

describe("规则检查", () => {
  it("找得到 src/engine、src/ui、src/params 里的文件（防止规则检查什么都没查）", () => {
    expect(engineFiles.length).toBeGreaterThan(0);
    expect(listFiles("src/ui").length).toBeGreaterThan(0);
    expect(listFiles("src/params").length).toBeGreaterThan(0);
  });

  it("R1 src/engine、src/staff 里没有 Math.random、Date.now、new Date", () => {
    const hits = findHits([...engineFiles, ...staffFiles], /Math\.random|Date\.now|new\s+Date\b/, { code: true });
    expect(hits, show(hits)).toEqual([]);
  });

  it("R2 src/engine 不引用 ui、scene、staff、text、react", () => {
    const hits = badImports(engineFiles, /(^|\/)(ui|scene|staff|text)(\/|$)|^react($|-|\/)/);
    expect(hits, show(hits)).toEqual([]);
  });

  it("R2 src/staff 不引用 ui、scene、text、react", () => {
    const hits = badImports(staffFiles, /(^|\/)(ui|scene|text)(\/|$)|^react($|-|\/)/);
    expect(hits, show(hits)).toEqual([]);
  });

  it("R2 src/engine 不使用浏览器接口", () => {
    const hits = findHits(
      engineFiles,
      /\b(window|document|localStorage|sessionStorage|navigator|location|performance)\s*[.[]/,
      { code: true },
    );
    expect(hits, show(hits)).toEqual([]);
  });

  it("R3 整个 src 里没有网络请求", () => {
    const hits = findHits(allSrc, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, { code: true });
    expect(hits, show(hits)).toEqual([]);
  });

  it("R5 src/ui、src/scene、src/engine、src/staff 的代码里没有中文（注释里可以有）", () => {
    const hits = findHits([...uiLike, ...engineFiles, ...staffFiles], /[㐀-鿿＀-￯　-〿]/, {
      code: true,
    });
    expect(hits, show(hits)).toEqual([]);
  });

  it("R6 整个 src 里没有真实平台和聊天软件的名字", () => {
    const names = [
      "tiktok",
      "抖音",
      "shopee",
      "虾皮",
      "lazada",
      "来赞达",
      "taobao",
      "淘宝",
      "tmall",
      "天猫",
      "京东",
      "jd\\.com",
      "amazon",
      "亚马逊",
      "拼多多",
      "pinduoduo",
      "temu",
      "aliexpress",
      "速卖通",
      "alibaba",
      "阿里巴巴",
      "shein",
      "小红书",
      "xiaohongshu",
      "whatsapp",
      "wechat",
      "微信",
      "telegram",
      "facebook",
      "instagram",
      "messenger",
    ];
    const hits = findHits(allSrc, new RegExp(names.join("|"), "i"));
    expect(hits, show(hits)).toEqual([]);
  });

  it("R7 整个 src 里没有 any 和 @ts-ignore", () => {
    const anyHits = findHits(allSrc, /:\s*any\b|\bas\s+any\b|<any>|\bany\[\]|<any,|,\s*any>/, { code: true });
    const ignoreHits = findHits(allSrc, /@ts-ignore|@ts-nocheck|@ts-expect-error/);
    expect([...anyHits, ...ignoreHits], show([...anyHits, ...ignoreHits])).toEqual([]);
  });

  it("R8 参数表里每个参数都有 value、unit、source、note、public，source 只能是 A、B、C", () => {
    const mods = import.meta.glob("../src/params/*.ts", { eager: true }) as Record<string, Record<string, unknown>>;
    const problems: string[] = [];
    let count = 0;

    const visit = (path: string, v: unknown): void => {
      if (typeof v !== "object" || v === null) {
        problems.push(`${path}：不是参数对象`);
        return;
      }
      const o = v as Record<string, unknown>;
      if (!("value" in o)) {
        // 一组参数，往下找
        for (const [k, child] of Object.entries(o)) visit(`${path}.${k}`, child);
        return;
      }
      count++;
      if (typeof o.value !== "number" || !Number.isFinite(o.value)) problems.push(`${path}.value 不是数字`);
      if (typeof o.unit !== "string" || o.unit === "") problems.push(`${path}.unit 缺少`);
      if (o.source !== "A" && o.source !== "B" && o.source !== "C") problems.push(`${path}.source 不是 A、B、C`);
      if (typeof o.note !== "string" || o.note === "") problems.push(`${path}.note 缺少`);
      if (typeof o.public !== "boolean") problems.push(`${path}.public 不是 true 或 false`);
      const extra = Object.keys(o).filter((k) => !["value", "unit", "source", "note", "public"].includes(k));
      if (extra.length > 0) problems.push(`${path} 多了字段 ${extra.join("、")}`);
    };

    for (const [file, mod] of Object.entries(mods)) {
      for (const [name, value] of Object.entries(mod)) visit(`${file}:${name}`, value);
    }
    expect(problems, problems.join("\n")).toEqual([]);
    expect(count).toBeGreaterThan(0);
  });
});

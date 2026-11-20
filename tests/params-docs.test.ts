// 参数表和文档一样（docs/03、docs/04 的参数表）：值、等级、说明（第一句）。规则改了文档，代码要跟着改。
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { malaysia } from "../src/params/malaysia";

const DOCS = join(__dirname, "..", "docs");
const P = malaysia as unknown as Record<string, { value: unknown; source: string; note: string }>;

interface Row {
  file: string;
  name: string;
  value: string;
  source: string;
  note: string;
}

function rows(): Row[] {
  const out: Row[] = [];
  for (const file of readdirSync(DOCS).filter((f) => f.endsWith(".md"))) {
    for (const line of readFileSync(join(DOCS, file), "utf8").split("\n")) {
      const m = /^\| `([a-zA-Z0-9]+)` \| ([^|]+) \| ([^|]+) \| ([ABC]) \| ([^|]+) \|$/.exec(line.trim());
      if (m && m[1] in P) out.push({ file, name: m[1], value: m[2].trim(), source: m[4], note: m[5].trim() });
    }
  }
  return out;
}

const plain = (s: string): string => s.replace(/`/g, "").replace(/\s+/g, "");

describe("参数表和文档一样", () => {
  const all = rows();
  it("文档里找得到参数表（防止什么都没查）", () => {
    expect(all.length).toBeGreaterThan(30);
  });
  it("值和等级一样", () => {
    const bad = all.filter((r) => {
      const v = P[r.name].value;
      const same = Array.isArray(v) ? plain(r.value) === plain(JSON.stringify(v)) : String(v) === r.value.replace(/,/g, "");
      return !same || P[r.name].source !== r.source;
    });
    expect(bad.map((r) => `${r.file} ${r.name}: 文档 ${r.value} ${r.source}，代码 ${JSON.stringify(P[r.name].value)} ${P[r.name].source}`)).toEqual([]);
  });
  // 两边都只比第一句：代码里可以多写补充，文档里可以多写"（任务 01 已经加过）"这种备注
  const first = (s: string): string => plain(s.split("。")[0].replace(/（任务[^）]*）$/, ""));
  it("说明和文档的第一句一样", () => {
    const bad = all.filter((r) => first(P[r.name].note) !== first(r.note));
    expect(bad.map((r) => `${r.file} ${r.name}: 文档「${first(r.note)}」，代码「${P[r.name].note}」`)).toEqual([]);
  });
});

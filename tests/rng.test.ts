import { describe, expect, it } from "vitest";
import { createRng } from "../src/engine/rng";

describe("rng", () => {
  it("同一个种子连续取 100 个数，两次结果完全相同", () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 100 }, () => a.next());
    const ys = Array.from({ length: 100 }, () => b.next());
    expect(xs).toEqual(ys);
  });

  it("不同的种子结果不同", () => {
    const a = createRng(1);
    const b = createRng(2);
    const xs = Array.from({ length: 100 }, () => a.next());
    const ys = Array.from({ length: 100 }, () => b.next());
    expect(xs).not.toEqual(ys);
  });

  it("next() 在 [0, 1) 之间", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int(1, 6) 取 1000 次，结果都在 1 到 6 之间，并且是整数", () => {
    const r = createRng(123);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const x = r.int(1, 6);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(6);
      seen.add(x);
    }
    // 1000 次里 1 到 6 都应该出现过
    expect(seen.size).toBe(6);
  });

  it("int 的参数不合法时报错", () => {
    const r = createRng(1);
    expect(() => r.int(6, 1)).toThrow();
    expect(() => r.int(1.5, 6)).toThrow();
  });
});

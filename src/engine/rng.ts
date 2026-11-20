// 带种子的随机数生成器（mulberry32）。engine 里的随机数只能来自这里。

export interface Rng {
  /** 返回 [0, 1) 之间的数 */
  next(): number;
  /** 返回 [min, max] 闭区间内的整数 */
  int(min: number, max: number): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`rng.int: invalid range ${min}, ${max}`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  return { next, int };
}

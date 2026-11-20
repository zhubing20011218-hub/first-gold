// 每一天、每一种用途各用一个独立的生成器（docs/04 第四节）
import { createRng, type Rng } from "./rng";

/** stream：1 市场热度，2 自然订单取整，3 广告订单取整，4 跨境送达天数，5 退货，6 开局安排，7 每季度风险 */
export function dayRng(seed: number, day: number, stream: number): Rng {
  const mixed =
    (Math.imul(seed ^ Math.imul(day + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(stream + 1, 0xc2b2ae35)) >>> 0;
  return createRng(mixed);
}

/** 把千分之一单变成整数单 */
export function roundMilli(milli: number, rng: Rng): number {
  return Math.floor(milli / 1000) + (rng.int(0, 999) < milli % 1000 ? 1 : 0);
}

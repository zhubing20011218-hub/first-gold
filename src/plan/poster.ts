// 纪念海报上桶里装多少金子（docs/10 第九节）
import type { Params } from "../engine/util";

export interface PosterNumbers {
  /** 桶里金子的高度，万分之几 */
  fillBp: number;
  /** 从桶口溢出来的金币个数，0 到 12 */
  overflow: number;
  /** 净资产是目标的几倍，乘以 10（16 表示 1.6 倍） */
  multipleE1: number;
}

export function posterNumbers(netWorthFen: number, params: Params): PosterNumbers {
  const goal = params.goalNetWorthFen.value;
  const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
  return {
    fillBp: clamp(Math.floor((netWorthFen * 10000) / goal), 0, 10000),
    overflow: clamp(Math.floor(((netWorthFen - goal) * 10) / goal), 0, 12),
    multipleE1: Math.floor((netWorthFen * 10) / goal),
  };
}

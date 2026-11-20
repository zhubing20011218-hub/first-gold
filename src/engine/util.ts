// engine 里共用的小工具
import type { MalaysiaParams } from "../params/malaysia";

/** engine 的函数都用这一份参数的类型。参数对象作为函数的参数传进去（docs/01 第四节）。 */
export type Params = MalaysiaParams;

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** 第 d 天属于第几个季度、第几个季节、第几年（docs/04 第一节） */
export function calendarOf(day: number): { quarter: number; season: number; year: number } {
  const quarter = Math.floor(day / 90);
  return { quarter, season: quarter % 4, year: Math.floor(quarter / 4) };
}

// 马来西亚的参数表。所有业务数值放在这里，每个带来源等级（docs/02 第五节）。
import type { Param } from "./types";

export const malaysia = {
  cnyPerRmE4: {
    value: 16500,
    unit: "E4",
    source: "C",
    note: "游戏里的固定汇率：1 林吉特 = 1.65 元。接近 2026 年 11 月的实际水平",
    public: true,
  },
  quartersPerGame: {
    value: 8,
    unit: "季度",
    source: "C",
    note: "一局的季度数",
    public: true,
  },
  startCashFen: {
    value: 500000,
    unit: "fen",
    source: "C",
    note: "启动资金",
    public: true,
  },
} satisfies Record<string, Param>;

export type MalaysiaParams = typeof malaysia;

// 游戏模型的占位版本（docs/01 第五节）。任务 03 换成完整的。

/** 跨境直发 | 本土店 */
export type Fulfillment = "cross" | "local";

export interface GameConfig {
  seed: number;
  /** 玩家开局时选，一局之内不变 */
  fulfillment: Fulfillment;
  startCashFen: number;
}

export interface GameState {
  config: GameConfig;
  /** 从 0 开始，每过一天加 1 */
  day: number;
  /** 手里的现金，人民币分 */
  cashFen: number;
}

export function createGame(config: GameConfig): GameState {
  return { config, day: 0, cashFen: config.startCashFen };
}

/** 往前走一天。返回新对象，不修改传进来的对象。 */
export function nextDay(state: GameState): GameState {
  return { ...state, day: state.day + 1 };
}

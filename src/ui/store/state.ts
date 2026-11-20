// 界面的状态（docs/09 第二节）。整个界面只有一个 store。
import type { Bill } from "../../engine/bills";
import type { GameEvent } from "../../engine/events";
import type { Fulfillment, GameState, QuarterDecision } from "../../engine/types";
import type { CashPlan } from "../../plan/cashPlan";
import type { Reminder } from "../../plan/reminders";

export type Stage = "home" | "setup" | "decide" | "play" | "settle" | "ending";
/** 三个功能区：进货、运营、财务（docs/06 第一节） */
export type Area = "purchase" | "ops" | "finance";
export const AREAS: readonly Area[] = ["purchase", "ops", "finance"];
export type PopupName = "stock" | "retail" | "bulk" | "risk" | "push" | "bill" | "source" | "desk" | "bulkShort";

export interface QuarterSummary {
  quarter: number;
  decision: QuarterDecision;
  plan: CashPlan;
  startCashFen: number;
  endCashFen: number;
  /** 季度开始和结束时的状态，报表要用 */
  startState: GameState;
  endState: GameState;
}

export interface UiState {
  stage: Stage;
  setup: { productId: string | null; fulfillment: Fulfillment | null; firstStockQty: number };
  seed: number;
  game: GameState | null;
  /** 这个季度正在定的决定 */
  decision: QuarterDecision;
  /** 三个功能区这个季度定了没有 */
  confirmed: Record<Area, boolean>;
  /** 是不是沿用上个季度的 */
  carried: Record<Area, boolean>;
  /** 季度开始时的现金计划，结算时用来对比 */
  plan: CashPlan | null;
  decisions: QuarterDecision[];
  events: GameEvent[];
  /** 这个季度每一天的事件（播放用） */
  quarterEvents: GameEvent[][];
  /** 这个季度每一天结束时的现金（播放和提醒用） */
  quarterCash: number[];
  quarterStartState: GameState | null;
  bills: Bill[][];
  billConfirmed: boolean;
  history: QuarterSummary[];
  reminders: Reminder[];
  popup: PopupName | null;
  deskArea: Area;
  playDay: number;
  coachStep: 0 | 1 | 2 | 3;
}

export function emptyDecision(): QuarterDecision {
  return { monthlyRestockQty: 0, priceSen: 0, adBidFen: 0, adDailyBudgetFen: 0, bulkQuotes: [], buyCompliance: false, upgradeToLocal: false };
}

export function initialUi(): UiState {
  return {
    stage: "home",
    setup: { productId: null, fulfillment: null, firstStockQty: 0 },
    seed: 0,
    game: null,
    decision: emptyDecision(),
    confirmed: { purchase: false, ops: false, finance: false },
    carried: { purchase: false, ops: false, finance: false },
    plan: null,
    decisions: [],
    events: [],
    quarterEvents: [],
    quarterCash: [],
    quarterStartState: null,
    bills: [],
    billConfirmed: false,
    history: [],
    reminders: [],
    popup: null,
    deskArea: "purchase",
    playDay: 0,
    coachStep: 0,
  };
}

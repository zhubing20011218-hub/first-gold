// 界面的状态（docs/09 第二节）。整个界面只有一个 store。
import type { Bill } from "../../engine/bills";
import type { GameEvent } from "../../engine/events";
import type { Fulfillment, GameState, QuarterDecision } from "../../engine/types";
import type { CashPlan } from "../../plan/cashPlan";
import type { Reminder } from "../../plan/reminders";
import type { CarryOver } from "../../engine/summary";
import type { Cause } from "../../plan/causes";
import type { PlanVsActual, QuarterResult, Verdict } from "../../plan/report";

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

/** 播放的一天：这一天的事件、结束时的现金和状态（docs/12 第四节"播放的做法"） */
export interface PlayDay {
  day: number;
  events: GameEvent[];
  cashAfterFen: number;
  state: GameState;
}

/** 正在播放的这个季度：模型先算到停下的地方（季度结束或者大单货不够），界面再一天一天放出来 */
export interface PlayRun {
  quarter: number;
  startState: GameState;
  plan: CashPlan;
  /** 这个季度的决定，季度中间的选择会记进 bulkShortChoices */
  decision: QuarterDecision;
  days: PlayDay[];
  /** 模型停在哪：end 是这个季度算完了；pending 是大单货不够，等玩家选 */
  stoppedAt: "end" | "pending";
}

/** 季度报表（弹窗 P6，docs/06 第五节） */
export interface QuarterReport {
  quarter: number;
  startCashFen: number;
  endCashFen: number;
  bills: Bill[];
  verified: boolean;
  planVsActual: PlanVsActual;
  carry: CarryOver;
  result: QuarterResult;
  causes: Cause[];
  verdict: Verdict;
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
  /** 正在播放的季度；不在播放时是 null */
  play: PlayRun | null;
  /** 已经放出来的天数（0 到 play.days.length） */
  playIndex: number;
  /** 最近一个季度的报表 */
  report: QuarterReport | null;
  /** 所有出现过的提醒（工作台里能翻到） */
  reminderLog: Reminder[];
  /** 两年里每一天结束时的现金（结局的现金曲线） */
  cashCurve: number[];
  /** 只给 ?demo= 用：播放停在某一天不往前走（截图每次一样） */
  playPaused: boolean;
  bills: Bill[][];
  billConfirmed: boolean;
  history: QuarterSummary[];
  reminders: Reminder[];
  popup: PopupName | null;
  deskArea: Area;
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
    play: null,
    playIndex: 0,
    report: null,
    reminderLog: [],
    playPaused: false,
    cashCurve: [],
    bills: [],
    billConfirmed: false,
    history: [],
    reminders: [],
    popup: null,
    deskArea: "purchase",
    coachStep: 0,
  };
}

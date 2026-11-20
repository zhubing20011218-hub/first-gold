// 界面的动作（docs/12 第四节）。每个动作都是"旧的界面状态 → 新的界面状态"，计算全部交给 engine 和 plan。
// store.ts 把它们接进 Zustand。每个动作都有测试（tests/ui-actions.test.ts）。
import { buildQuarterBills } from "../../engine/bills";
import { stepDay } from "../../engine/day";
import type { GameEvent } from "../../engine/events";
import { createGame } from "../../engine/game";
import { answerPending } from "../../engine/pending";
import { startQuarter } from "../../engine/quarter";
import type { Fulfillment, GameState, MidChoice, QuarterDecision } from "../../engine/types";
import { malaysia } from "../../params/malaysia";
import { getProduct } from "../../products/catalog";
import { cashPlan } from "../../plan/cashPlan";
import { decideReminders } from "../../plan/reminders";
import { defaultFirstStock } from "../../plan/setup";
import { AREAS, emptyDecision, initialUi, type Area, type PopupName, type UiState } from "./state";

const P = malaysia;

function quarterOf(game: GameState): number {
  return Math.floor(game.day / 90);
}

// ---------- 首页和开局 ----------

export function startNewGame(_ui: UiState, seed: number): UiState {
  return { ...initialUi(), stage: "setup", seed };
}

export function pickProduct(ui: UiState, id: string): UiState {
  const f = ui.setup.fulfillment;
  const qty = f ? defaultFirstStock(P.startCashFen.value, f, getProduct(id), P) : 0;
  return { ...ui, setup: { ...ui.setup, productId: id, firstStockQty: qty } };
}

export function pickFulfillment(ui: UiState, f: Fulfillment): UiState {
  const id = ui.setup.productId;
  const qty = id ? defaultFirstStock(P.startCashFen.value, f, getProduct(id), P) : 0;
  return { ...ui, setup: { ...ui.setup, fulfillment: f, firstStockQty: qty } };
}

export function setFirstStock(ui: UiState, qty: number): UiState {
  return { ...ui, setup: { ...ui.setup, firstStockQty: qty } };
}

export function backHome(ui: UiState): UiState {
  return { ...ui, stage: "home", popup: null };
}

/** 第 1 个季度，财务区"以后会用到"，不用定；跨境店升不起的季度，财务区也没有要决定的（仍然要显示升级要花多少） */
export function autoConfirmed(game: GameState): Area[] {
  return quarterOf(game) === 0 ? ["finance"] : [];
}

/** 进入某个季度的做决定 */
function enterDecide(ui: UiState, game: GameState, events: GameEvent[]): UiState {
  const product = getProduct(game.config.productId);
  const last = ui.decisions[ui.decisions.length - 1];
  const first = !last;
  const decision: QuarterDecision = {
    ...emptyDecision(),
    // 第一个季度打开时是起点（docs/09 第五节），以后沿用上个季度的值
    monthlyRestockQty: last?.monthlyRestockQty ?? 0,
    priceSen: last?.priceSen ?? product.refPriceSen,
    adBidFen: last?.adBidFen ?? 0,
    adDailyBudgetFen: last?.adDailyBudgetFen ?? 0,
  };
  const auto = autoConfirmed(game);
  const confirmed = { purchase: !first, ops: !first, finance: !first } as Record<Area, boolean>;
  for (const a of auto) confirmed[a] = true;
  return {
    ...ui,
    stage: "decide",
    game,
    events,
    decision,
    confirmed,
    carried: { purchase: !first, ops: !first, finance: !first },
    plan: null,
    quarterStartState: game,
    billConfirmed: false,
    reminders: decideReminders(game, product, P),
    popup: null,
  };
}

export function openShop(ui: UiState): UiState {
  const { productId, fulfillment, firstStockQty } = ui.setup;
  if (!productId || !fulfillment) throw new Error("setup not finished");
  const opening = createGame({ seed: ui.seed, productId, fulfillment, startCashFen: P.startCashFen.value, firstStockQty }, getProduct(productId), P);
  return { ...enterDecide(ui, opening.state, opening.events), coachStep: 1 };
}

// ---------- 做决定 ----------

/** 弹窗里点"就这样定"：改这一个功能区的值，标成"已定" */
export function setDecision(ui: UiState, area: Area, values: Partial<QuarterDecision>): UiState {
  return {
    ...ui,
    decision: { ...ui.decision, ...values },
    confirmed: { ...ui.confirmed, [area]: true },
    carried: { ...ui.carried, [area]: false },
    popup: null,
  };
}

export function allConfirmed(ui: UiState): boolean {
  return AREAS.every((a) => ui.confirmed[a]);
}

export function openPopup(ui: UiState, name: PopupName): UiState {
  return { ...ui, popup: name };
}

export function closePopup(ui: UiState): UiState {
  return { ...ui, popup: null };
}

export function openDesk(ui: UiState, area: Area): UiState {
  return { ...ui, popup: "desk", deskArea: area };
}

export function nextCoach(ui: UiState): UiState {
  return { ...ui, coachStep: ui.coachStep >= 3 ? 0 : ((ui.coachStep + 1) as 0 | 1 | 2 | 3) };
}

// ---------- 过一个季度 ----------

export interface QuarterRun {
  game: GameState;
  eventsByDay: GameEvent[][];
  cashByDay: number[];
  decision: QuarterDecision;
}

/** 调用 startQuarter，然后一天一天调用 stepDay，直到这个季度结束；第 8 个季度之后接着算收尾阶段 */
export function runQuarter(ui: UiState, chooser: (game: GameState) => MidChoice = () => "ignore"): QuarterRun {
  const game0 = ui.game;
  if (!game0 || !allConfirmed(ui)) throw new Error("decision not complete");
  const product = getProduct(game0.config.productId);
  const q = quarterOf(game0);
  const start = startQuarter(game0, ui.decision, product, P);
  let game = start.state;
  const eventsByDay: GameEvent[][] = [start.events];
  const cashByDay: number[] = [game.cashFen];
  const endDay = (q + 1) * 90;
  const choices: { inquiryId: string; choice: MidChoice }[] = [];
  while ((game.phase === "running" && game.day < endDay) || game.phase === "closing") {
    if (game.pending) {
      const choice = chooser(game);
      choices.push({ inquiryId: game.pending.inquiryId, choice });
      const r = answerPending(game, choice, product, P);
      game = r.state;
      eventsByDay[eventsByDay.length - 1].push(...r.events);
      continue;
    }
    const r = stepDay(game, product, P);
    game = r.state;
    eventsByDay.push(r.events);
    cashByDay.push(game.cashFen);
  }
  return { game, eventsByDay, cashByDay, decision: { ...ui.decision, bulkShortChoices: choices } };
}

/** 季度账单的季初现金：第 1 个季度是开局付开通费和第一批货之前的钱（docs/04 第十七节），以后是季度第一天的现金 */
export function quarterStartCashFen(game: GameState): number {
  return quarterOf(game) === 0 ? game.config.startCashFen : game.cashFen;
}

/** 任务 06 的临时做法：点主要按钮之后直接算完这个季度，不播放、不结算，直接进入下一个季度的做决定 */
export function startQuarterPlay(ui: UiState): UiState {
  const game0 = ui.game;
  if (!game0) return ui;
  const product = getProduct(game0.config.productId);
  const plan = cashPlan(game0, ui.decision, product, P);
  const run = runQuarter(ui);
  const q = quarterOf(game0);
  const events = [...ui.events, ...run.eventsByDay.flat()];
  const next: UiState = {
    ...ui,
    decisions: [...ui.decisions, run.decision],
    quarterEvents: run.eventsByDay,
    quarterCash: run.cashByDay,
    bills: [...ui.bills, buildQuarterBills(q, events, P)],
    history: [
      ...ui.history,
      { quarter: q, decision: run.decision, plan, startCashFen: quarterStartCashFen(game0), endCashFen: run.game.cashFen, startState: game0, endState: run.game },
    ],
    plan,
    coachStep: 0,
  };
  if (run.game.phase !== "running") return { ...next, game: run.game, events, stage: "ending", popup: null };
  return enterDecide(next, run.game, events);
}

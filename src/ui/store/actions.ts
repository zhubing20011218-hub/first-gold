// 界面的动作（docs/12 第四节）。每个动作都是"旧的界面状态 → 新的界面状态"，计算全部交给 engine 和 plan。
// store.ts 把它们接进 Zustand。每个动作都有测试（tests/ui-actions.test.ts）。
import { buildQuarterBills, verifyQuarter } from "../../engine/bills";
import { carryOver } from "../../engine/summary";
import { quarterCauses } from "../../plan/causes";
import { planVsActual, quarterResult, settleVerdict } from "../../plan/report";
import { stepDay } from "../../engine/day";
import type { GameEvent } from "../../engine/events";
import { createGame } from "../../engine/game";
import { answerPending } from "../../engine/pending";
import { startQuarter } from "../../engine/quarter";
import type { Fulfillment, GameState, MidChoice, QuarterDecision } from "../../engine/types";
import { malaysia } from "../../params/malaysia";
import { getProduct } from "../../products/catalog";
import { cashPlan } from "../../plan/cashPlan";
import { decideReminders, playReminders } from "../../plan/reminders";
import { defaultFirstStock } from "../../plan/setup";
import { AREAS, emptyDecision, initialUi, type Area, type PlayDay, type PopupName, type QuarterReport, type UiState } from "./state";

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

// ---------- 过一个季度：播放（docs/12 第四节） ----------

/** 季度账单的季初现金：第 1 个季度是开局付开通费和第一批货之前的钱（docs/04 第十七节），以后是季度第一天的现金 */
export function quarterStartCashFen(game: GameState): number {
  return quarterOf(game) === 0 ? game.config.startCashFen : game.cashFen;
}

/** 这个季度要算到第几天为止：季度结束；第 8 个季度之后接着算收尾阶段（docs/04 第十二节） */
function keepGoing(game: GameState, quarter: number): boolean {
  return (game.phase === "running" && game.day < (quarter + 1) * 90) || game.phase === "closing";
}

/** 从 game 往下算，直到这个季度结束或者遇到大单货不够。first 是要放进第一天最前面的事件（季度第一天的决定产生的） */
function runUntilStop(game: GameState, quarter: number, first: GameEvent[] = []): { days: PlayDay[]; stoppedAt: "end" | "pending" } {
  const product = getProduct(game.config.productId);
  const days: PlayDay[] = [];
  let g = game;
  let carry = first;
  while (keepGoing(g, quarter)) {
    if (g.pending) return { days, stoppedAt: "pending" };
    const day = g.day;
    const r = stepDay(g, product, P);
    g = r.state;
    days.push({ day, events: [...carry, ...r.events], cashAfterFen: g.cashFen, state: g });
    carry = [];
    if (g.pending) return { days, stoppedAt: "pending" };
  }
  return { days, stoppedAt: "end" };
}

/** 点"进入下一个季度"：记下季初的现金计划，调用 startQuarter，把模型算到停下的地方，然后开始播放 */
export function startQuarterPlay(ui: UiState): UiState {
  const game0 = ui.game;
  if (!game0 || ui.stage !== "decide" || !allConfirmed(ui)) return ui;
  const product = getProduct(game0.config.productId);
  const quarter = quarterOf(game0);
  const plan = cashPlan(game0, ui.decision, product, P);
  const start = startQuarter(game0, ui.decision, product, P);
  const run = runUntilStop(start.state, quarter, start.events);
  return {
    ...ui,
    stage: "play",
    popup: null,
    plan,
    play: { quarter, startState: game0, plan, decision: { ...ui.decision, bulkShortChoices: [] }, days: run.days, stoppedAt: run.stoppedAt },
    playIndex: 0,
    report: null,
    billConfirmed: false,
    coachStep: 0,
  };
}

/** 播放往前走 n 天。放到模型停下的地方：大单货不够就打开 P9；季度算完了就结算 */
export function tickPlay(ui: UiState, n = 1): UiState {
  const play = ui.play;
  if (ui.stage !== "play" || !play || ui.popup === "bulkShort") return ui;
  const playIndex = Math.min(play.days.length, ui.playIndex + n);
  const shown = playIndex > 0 ? play.days[playIndex - 1].state : ui.game;
  const next: UiState = { ...ui, playIndex, game: shown };
  if (playIndex < play.days.length) return next;
  return play.stoppedAt === "pending" ? { ...next, game: play.days.length > 0 ? play.days[play.days.length - 1].state : ui.game, popup: "bulkShort" } : finishPlay(next);
}

/** 点"跳过"：一直放到模型停下的地方 */
export function skipPlay(ui: UiState): UiState {
  return ui.play ? tickPlay(ui, ui.play.days.length) : ui;
}

/** 正在等玩家选择的那一刻的状态 */
function pendingState(ui: UiState): GameState | null {
  const play = ui.play;
  if (!play || play.stoppedAt !== "pending") return null;
  const g = play.days.length > 0 ? play.days[play.days.length - 1].state : null;
  return g?.pending ? g : null;
}

/** 大单货不够时玩家的选择（弹窗 P9）：调用 answerPending，把选择记进这个季度的决定里，继续往下算 */
export function answerBulkShort(ui: UiState, choice: MidChoice): UiState {
  const play = ui.play;
  const g = pendingState(ui);
  if (!play || !g?.pending) return ui;
  const product = getProduct(g.config.productId);
  const r = answerPending(g, choice, product, P);
  const days = [...play.days];
  const last = days[days.length - 1];
  days[days.length - 1] = { ...last, events: [...last.events, ...r.events], cashAfterFen: r.state.cashFen, state: r.state };
  const more = runUntilStop(r.state, play.quarter);
  // 停下的那一天还没算完：接着算的第一天和停下的是同一天，合成一天，不然现金曲线会多出一天
  const rest = more.days;
  if (rest.length > 0 && rest[0].day === days[days.length - 1].day) {
    const merged = days[days.length - 1];
    days[days.length - 1] = { ...rest[0], events: [...merged.events, ...rest[0].events] };
    rest.shift();
  }
  const decision = { ...play.decision, bulkShortChoices: [...(play.decision.bulkShortChoices ?? []), { inquiryId: g.pending.inquiryId, choice }] };
  return { ...ui, popup: null, game: r.state, play: { ...play, decision, days: [...days, ...rest], stoppedAt: more.stoppedAt } };
}

/** 播放结束：算这个季度的报表，去结算，打开季度报表（docs/06 第五节） */
export function finishPlay(ui: UiState): UiState {
  const play = ui.play;
  if (!play) return ui;
  const end = play.days.length > 0 ? play.days[play.days.length - 1].state : play.startState;
  const product = getProduct(end.config.productId);
  const q = play.quarter;
  const events = [...ui.events, ...play.days.flatMap((d) => d.events)];
  const bills = buildQuarterBills(q, events, P);
  const startCashFen = quarterStartCashFen(play.startState);
  const report: QuarterReport = {
    quarter: q,
    startCashFen,
    endCashFen: end.cashFen,
    bills,
    verified: verifyQuarter(startCashFen, bills, end.cashFen),
    planVsActual: planVsActual(play.plan, bills, end.cashFen),
    carry: carryOver(end),
    result: quarterResult(q, events, play.startState, end, P),
    causes: quarterCauses(q, events, play.startState, end, product, P),
    verdict: settleVerdict(end),
  };
  const played = playReminders(
    play.days.map((d) => ({ events: d.events, cashAfterFen: d.cashAfterFen })),
    play.startState.cashFen,
  );
  return {
    ...ui,
    stage: "settle",
    popup: "bill",
    game: end,
    events,
    decisions: [...ui.decisions, play.decision],
    bills: [...ui.bills, bills],
    history: [
      ...ui.history,
      { quarter: q, decision: play.decision, plan: play.plan, startCashFen, endCashFen: end.cashFen, startState: play.startState, endState: end },
    ],
    reminderLog: [...ui.reminderLog, ...played],
    cashCurve: [...ui.cashCurve, ...play.days.map((d) => d.cashAfterFen)],
    playIndex: play.days.length,
    report,
    billConfirmed: false,
  };
}

/** 点"确认报表"：核对成立、结论是继续时才有效 */
export function confirmBill(ui: UiState): UiState {
  const r = ui.report;
  if (ui.stage !== "settle" || !r || !r.verified || r.verdict !== "continue") return ui;
  return { ...ui, billConfirmed: true, popup: null };
}

/** 点"申请破产"：结论是 bankrupt 时才有效，去结局 */
export function declareBankruptcy(ui: UiState): UiState {
  if (ui.stage !== "settle" || ui.report?.verdict !== "bankrupt") return ui;
  return { ...ui, stage: "ending", popup: null };
}

/** 封店或一局结束：报表里点"看结果"，去结局 */
export function seeResult(ui: UiState): UiState {
  const v = ui.report?.verdict;
  if (ui.stage !== "settle" || (v !== "banned" && v !== "finished")) return ui;
  return { ...ui, stage: "ending", popup: null };
}

/** 点"进入下一个季度"：只在确认了报表之后有效 */
export function nextQuarter(ui: UiState): UiState {
  if (ui.stage !== "settle" || !ui.billConfirmed || !ui.game) return ui;
  if (ui.game.phase !== "running") return { ...ui, stage: "ending", popup: null };
  return { ...enterDecide({ ...ui, play: null, playIndex: 0 }, ui.game, ui.events), billConfirmed: false };
}

/** 同一局再试一次：用同一个种子回到开局，商品和发货方式照上一局选好（docs/12 第四节） */
export function retrySameSeed(ui: UiState): UiState {
  const g = ui.game;
  let u = startNewGame(ui, ui.seed);
  if (g) u = pickFulfillment(pickProduct(u, g.config.productId), g.config.fulfillment);
  return u;
}

/** 一口气把这个季度放完（大单货不够时用 chooser 选），确认报表，回到做决定或者去结局。测试和 ?demo= 用 */
export function playQuarterThrough(ui: UiState, chooser: (g: GameState) => MidChoice = () => "ignore"): UiState {
  let u = startQuarterPlay(ui);
  for (let guard = 0; guard < 50 && u.stage === "play"; guard++) {
    u = skipPlay(u);
    if (u.popup === "bulkShort") {
      const g = pendingState(u);
      u = answerBulkShort(u, g ? chooser(g) : "ignore");
    }
  }
  if (u.stage !== "settle") return u;
  if (u.report?.verdict === "continue") return nextQuarter(confirmBill(u));
  if (u.report?.verdict === "bankrupt") return declareBankruptcy(u);
  return seeResult(u);
}

// 测试用：随机生成合法的决定，并一天一天地玩完一局，记下季度开始和结束时的现金。
import type { Product } from "../../src/engine/product";
import { createRng, type Rng } from "../../src/engine/rng";
import { createGame } from "../../src/engine/game";
import { startQuarter } from "../../src/engine/quarter";
import { stepDay } from "../../src/engine/day";
import { answerPending } from "../../src/engine/pending";
import { rushOrder, affordableQty } from "../../src/engine/stock";
import type { GameEvent } from "../../src/engine/events";
import type { Fulfillment, GameConfig, GameState, MidChoice, QuarterDecision } from "../../src/engine/types";
import type { Params } from "../../src/engine/util";
import { buildSchedule } from "../../src/engine/schedule";

export function randomConfig(rng: Rng, seed: number, product: Product, params: Params, fulfillment: Fulfillment): GameConfig {
  // 启动资金在参数值的 1 到 4 倍之间变化，让更多的局能走到后面
  const startCashFen = params.startCashFen.value * rng.int(1, 4);
  const setup = fulfillment === "local" ? params.localSetupFeeFen.value : 0;
  const maxQty = Math.min(product.supplierMonthlyCap, affordableQty(startCashFen - setup, fulfillment, product, params));
  const firstStockQty = rng.int(product.moq, Math.max(product.moq, Math.floor(maxQty * 0.5)));
  return { seed, productId: product.id, fulfillment, startCashFen, firstStockQty };
}

export function randomDecisions(rng: Rng, seed: number, product: Product, params: Params, opts: { upgradeQuarter?: number } = {}): QuarterDecision[] {
  const schedule = buildSchedule(seed, product, params);
  const steps = (product.maxPriceSen - product.minPriceSen) / params.priceStepSen.value;
  const out: QuarterDecision[] = [];
  for (let q = 0; q < params.quartersPerGame.value; q++) {
    const restock = rng.next() < 0.2 ? 0 : rng.int(product.moq, Math.max(product.moq, Math.floor(product.supplierMonthlyCap * 0.4)));
    const bid = rng.next() < 0.25 ? 0 : rng.int(1, product.baseCpcFen * 3);
    out.push({
      monthlyRestockQty: restock,
      priceSen: product.minPriceSen + rng.int(0, steps) * params.priceStepSen.value,
      adBidFen: bid,
      adDailyBudgetFen: bid === 0 ? 0 : rng.int(0, 20000),
      bulkQuotes: schedule.inquiries
        .filter((i) => i.quarter === q && rng.next() < 0.6)
        .map((i) => ({ inquiryId: i.id, unitPriceSen: Math.max(1, Math.floor((product.bulkRefPriceSen * rng.int(80, 115)) / 100)) })),
      buyCompliance: rng.next() < 0.4,
      upgradeToLocal: opts.upgradeQuarter === q,
    });
  }
  return out;
}

export interface Played {
  state: GameState;
  events: GameEvent[];
  /** 每个季度开始（开局之前或 startQuarter 之前）和结束时的现金 */
  quarterCash: { startFen: number; endFen: number }[];
  /** 每个季度实际做过的季度中间的选择 */
  choices: { inquiryId: string; choice: MidChoice; quarter: number }[];
  /** 每一天结束时的状态（只在 keepStates 时记） */
  states: GameState[];
  pausedStepUnchanged: boolean;
}

/** 一天一天地玩。季度中间要选择时，按 chooser 选；加急补货付不起就改成不处理 */
export function playGame(
  config: GameConfig,
  decisions: QuarterDecision[],
  product: Product,
  params: Params,
  chooser: (rng: Rng) => MidChoice,
  rng: Rng,
  keepStates = false,
): Played {
  const opening = createGame(config, product, params);
  let state = opening.state;
  const events: GameEvent[] = [...opening.events];
  const quarterCash: { startFen: number; endFen: number }[] = [{ startFen: config.startCashFen, endFen: 0 }];
  const choices: Played["choices"] = [];
  const states: GameState[] = [];
  let started = -1;
  let pausedStepUnchanged = true;
  const quarters = params.quartersPerGame.value;
  while (state.phase === "running" || state.phase === "closing") {
    const q = Math.floor(state.day / 90);
    if (state.phase === "running" && state.day % 90 === 0 && started < q) {
      if (q > 0) {
        quarterCash[q - 1].endFen = state.cashFen;
        quarterCash[q] = { startFen: state.cashFen, endFen: 0 };
      }
      const r = startQuarter(state, decisions[q], product, params);
      state = r.state;
      events.push(...r.events);
      started = q;
    }
    if (state.pending !== null) {
      // 关系 11：pending 时 stepDay 不改状态
      const same = stepDay(state, product, params);
      if (same.state !== state || same.events.length > 0) pausedStepUnchanged = false;
      let choice = chooser(rng);
      if (choice === "rush" && rushOrder(state.pending.shortQty, state.fulfillment, product, params).totalFen > state.cashFen) {
        choice = "ignore";
      }
      choices.push({ inquiryId: state.pending.inquiryId, choice, quarter: q });
      const r = answerPending(state, choice, product, params);
      state = r.state;
      events.push(...r.events);
      continue;
    }
    const r = stepDay(state, product, params);
    state = r.state;
    events.push(...r.events);
    if (keepStates) states.push(state);
  }
  const lastQ = Math.min(quarters - 1, Math.max(started, 0));
  quarterCash[lastQ].endFen = state.cashFen;
  return { state, events, quarterCash: quarterCash.slice(0, lastQ + 1), choices, states, pausedStepUnchanged };
}

export function withChoices(decisions: QuarterDecision[], choices: Played["choices"]): QuarterDecision[] {
  return decisions.map((d, q) => ({
    ...d,
    bulkShortChoices: choices.filter((c) => c.quarter === q).map(({ inquiryId, choice }) => ({ inquiryId, choice })),
  }));
}

export { createRng };

// 最关键的一个决定（docs/06 第八节）：把某一个季度的决定换成"参考做法"，其他季度不变，整局重算，看净资产变化最大的是哪个季度。
// 参考做法只用来比较，不在做决定时显示成建议。
import type { Product } from "../engine/product";
import type { GameConfig, GameState, QuarterDecision } from "../engine/types";
import type { Params } from "../engine/util";
import { createGame } from "../engine/game";
import { startQuarter } from "../engine/quarter";
import { stepDay } from "../engine/day";
import { answerPending } from "../engine/pending";
import { netWorthFen } from "../engine/summary";
import { expectedMonthly } from "./reference";

export function referencePlan(state: GameState, product: Product, params: Params): QuarterDecision {
  const exp = expectedMonthly(state, product, params);
  return {
    monthlyRestockQty: exp === 0 ? 0 : Math.min(product.supplierMonthlyCap, Math.max(product.moq, Math.ceil(exp / 10) * 10)),
    priceSen: product.refPriceSen,
    adBidFen: 0,
    adDailyBudgetFen: 0,
    bulkQuotes: [],
    buyCompliance: false,
    upgradeToLocal: false,
  };
}

/**
 * 从开局算到结束。swapQuarter 那个季度用参考做法（按那天的状态算），其他季度用玩家的决定。
 * useChoices 为 true 时用玩家在季度中间的选择，否则一律当作"不处理"。
 */
function run(
  config: GameConfig,
  decisions: readonly QuarterDecision[],
  product: Product,
  params: Params,
  swapQuarter: number | null,
  useChoices: boolean,
): GameState {
  let state = createGame(config, product, params).state;
  let started = -1;
  while (state.phase === "running" || state.phase === "closing") {
    const q = Math.floor(state.day / 90);
    if (state.phase === "running" && state.day % 90 === 0 && started < q) {
      const d = q === swapQuarter ? referencePlan(state, product, params) : decisions[q];
      if (!d) break;
      state = startQuarter(state, d, product, params).state;
      started = q;
    }
    if (state.pending) {
      const id = state.pending.inquiryId;
      const choice = (useChoices && decisions[q]?.bulkShortChoices?.find((c) => c.inquiryId === id)?.choice) || "ignore";
      state = answerPending(state, choice, product, params).state;
      continue;
    }
    state = stepDay(state, product, params).state;
  }
  return state;
}

export interface KeyDecision {
  quarter: number;
  playerNetWorthFen: number;
  referenceNetWorthFen: number;
}

/** 玩家做过决定的每一个季度都换一次，净资产变化（绝对值）最大的那个季度；一样大时取靠前的 */
export function keyDecision(config: GameConfig, decisions: readonly QuarterDecision[], product: Product, params: Params): KeyDecision | null {
  if (decisions.length === 0) return null;
  const player = netWorthFen(run(config, decisions, product, params, null, true), product, params);
  let best: KeyDecision | null = null;
  for (let q = 0; q < decisions.length; q++) {
    const alt = netWorthFen(run(config, decisions, product, params, q, false), product, params);
    if (!best || Math.abs(alt - player) > Math.abs(best.referenceNetWorthFen - player)) {
      best = { quarter: q, playerNetWorthFen: player, referenceNetWorthFen: alt };
    }
  }
  return best;
}

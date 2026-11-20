// 最关键的一个决定（docs/06 第八节）：把某一个季度的决定换成"参考做法"，其他季度不变，整局重算，看净资产变化最大的是哪个季度。
// 参考做法只用来比较，不在做决定时显示成建议。
import type { Product } from "../engine/product";
import type { GameConfig, GameState, MidChoice, QuarterDecision } from "../engine/types";
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
 * 最关键的决定用的重算（docs/06 第八节）。swapQuarter 那个季度用参考做法（按那天的状态算），其他季度用玩家的决定。
 * 季度中间的选择用玩家真的选过的（按询价编号对上），对不上的当作"不处理"。
 * 玩家没有某个季度的决定时（换掉之后多活了几个季度），沿用这一局上一个季度的补货量、售价和广告，不报大单、不买合规、不升级。
 * onDay 在每一天开始时（做季度决定之前）拿到当时的状态，测试用来逐天比较。
 */
export function keyDecisionRun(
  config: GameConfig,
  decisions: readonly QuarterDecision[],
  product: Product,
  params: Params,
  swapQuarter: number | null,
  onDay?: (state: GameState) => void,
): GameState {
  const choices = new Map<string, MidChoice>();
  for (const d of decisions) for (const c of d.bulkShortChoices ?? []) choices.set(c.inquiryId, c.choice);
  let state = createGame(config, product, params).state;
  let started = -1;
  let last: QuarterDecision | null = null;
  let seenDay = -1;
  while (state.phase === "running" || state.phase === "closing") {
    if (onDay && state.day !== seenDay) {
      onDay(state);
      seenDay = state.day;
    }
    const q = Math.floor(state.day / 90);
    if (state.phase === "running" && state.day % 90 === 0 && started < q) {
      const own = decisions[q];
      const d: QuarterDecision =
        q === swapQuarter
          ? referencePlan(state, product, params)
          : (own ?? carriedDecision(last ?? referencePlan(state, product, params)));
      state = startQuarter(state, d, product, params).state;
      last = d;
      started = q;
    }
    if (state.pending) {
      state = answerPending(state, choices.get(state.pending.inquiryId) ?? "ignore", product, params).state;
      continue;
    }
    state = stepDay(state, product, params).state;
  }
  return state;
}

/** 沿用上一个季度：补货量、售价、广告不变；不报大单、不买合规、不升级 */
function carriedDecision(d: QuarterDecision): QuarterDecision {
  return {
    monthlyRestockQty: d.monthlyRestockQty,
    priceSen: d.priceSen,
    adBidFen: d.adBidFen,
    adDailyBudgetFen: d.adDailyBudgetFen,
    bulkQuotes: [],
    buyCompliance: false,
    upgradeToLocal: false,
  };
}

export interface KeyDecision {
  quarter: number;
  playerNetWorthFen: number;
  referenceNetWorthFen: number;
}

/** 选出最关键的季度：变化（绝对值）最大的；一样大时取靠前的。changes[q] 是第 q 个季度换掉之后的净资产 */
export function pickKeyQuarter(playerNetWorthFen: number, changes: readonly number[]): KeyDecision | null {
  let best: KeyDecision | null = null;
  for (let q = 0; q < changes.length; q++) {
    const alt = changes[q];
    if (!best || Math.abs(alt - playerNetWorthFen) > Math.abs(best.referenceNetWorthFen - playerNetWorthFen)) {
      best = { quarter: q, playerNetWorthFen, referenceNetWorthFen: alt };
    }
  }
  return best;
}

/** 玩家做过决定的每一个季度都换一次，净资产变化（绝对值）最大的那个季度；一样大时取靠前的 */
export function keyDecision(config: GameConfig, decisions: readonly QuarterDecision[], product: Product, params: Params): KeyDecision | null {
  if (decisions.length === 0) return null;
  const player = netWorthFen(keyDecisionRun(config, decisions, product, params, null), product, params);
  const changes = decisions.map((_, q) => netWorthFen(keyDecisionRun(config, decisions, product, params, q), product, params));
  return pickKeyQuarter(player, changes);
}

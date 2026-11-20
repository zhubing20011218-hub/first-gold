// 模拟用的打法（任务 04 第二节）。只引用 engine、params、products。
import type { Product } from "../../src/engine/product";
import type { GameState, MidChoice, QuarterDecision } from "../../src/engine/types";
import type { Params } from "../../src/engine/util";
import type { Rng } from "../../src/engine/rng";
import { applyBp } from "../../src/engine/money";
import { marketOfDay } from "../../src/engine/market";
import { riskLevel } from "../../src/engine/summary";
import { rushOrder } from "../../src/engine/stock";

export type StrategyId = "conservative" | "balanced" | "aggressive" | "bulkOnly" | "random";

export const STRATEGY_NAMES: Record<string, string> = {
  conservative: "保守",
  balanced: "均衡",
  aggressive: "激进",
  bulkOnly: "只做大单",
  random: "随机",
};

/** 一种打法：每个季度第一天给出决定；季度中间要选择时给出选择 */
export interface Strategy {
  id: string;
  /** 第一批进货用启动资金（本土店扣掉开通费之后）的几成，万分之几 */
  firstStockBp(rng: Rng): number;
  decide(ctx: DecideContext): QuarterDecision;
  midChoice(state: GameState, shortQty: number, rng: Rng): MidChoice;
}

export interface DecideContext {
  state: GameState;
  quarter: number;
  product: Product;
  params: Params;
  rng: Rng;
  /** 上个季度平均每月发出的件数（零售加大单）。第一个季度用 organicPerDayMilli * 30 / 1000 */
  lastMonthlyShipped: number;
  upgrade: boolean;
}

function restockAtLeastMoq(qty: number, product: Product): number {
  return qty < product.moq ? product.moq : qty;
}

function rivalBid(ctx: DecideContext): number {
  return marketOfDay(ctx.state.config.seed, ctx.quarter * 90, ctx.product, ctx.params).refBidFen;
}

function inquiriesOf(ctx: DecideContext) {
  return ctx.state.schedule.inquiries.filter((i) => i.quarter === ctx.quarter);
}

function riskAtLeastMid(ctx: DecideContext): boolean {
  return ctx.state.fulfillment === "local" && riskLevel(ctx.state.riskPts, ctx.params) !== "low";
}

function rushIfAffordable(state: GameState, shortQty: number, product: Product, params: Params): MidChoice {
  return rushOrder(shortQty, state.fulfillment, product, params).totalFen <= state.cashFen ? "rush" : "ignore";
}

export function makeStrategies(product: Product, params: Params): Record<StrategyId, Strategy> {
  const base = (ctx: DecideContext) => ({ upgradeToLocal: ctx.upgrade, bulkShortChoices: [] });
  return {
    conservative: {
      id: "conservative",
      firstStockBp: () => 4000,
      decide: (ctx) => ({
        ...base(ctx),
        priceSen: product.refPriceSen,
        adBidFen: 0,
        adDailyBudgetFen: 0,
        monthlyRestockQty: restockAtLeastMoq(ctx.lastMonthlyShipped, product),
        bulkQuotes: [],
        buyCompliance: riskAtLeastMid(ctx),
      }),
      midChoice: (s, shortQty) => rushIfAffordable(s, shortQty, product, params),
    },
    balanced: {
      id: "balanced",
      firstStockBp: () => 4000,
      decide: (ctx) => {
        const restock = restockAtLeastMoq(Math.floor((ctx.lastMonthlyShipped * 12) / 10), product);
        return {
          ...base(ctx),
          priceSen: product.refPriceSen,
          adBidFen: applyBp(rivalBid(ctx), 8000),
          adDailyBudgetFen: 3000,
          monthlyRestockQty: restock,
          bulkQuotes: inquiriesOf(ctx)
            .filter((i) => i.qty <= ctx.state.stockQty + restock)
            .map((i) => ({ inquiryId: i.id, unitPriceSen: product.bulkRefPriceSen })),
          buyCompliance: riskAtLeastMid(ctx),
        };
      },
      midChoice: (s, shortQty) => rushIfAffordable(s, shortQty, product, params),
    },
    aggressive: {
      id: "aggressive",
      firstStockBp: () => 7000,
      decide: (ctx) => ({
        ...base(ctx),
        priceSen: product.minPriceSen,
        adBidFen: applyBp(rivalBid(ctx), 13000),
        adDailyBudgetFen: 15000,
        monthlyRestockQty: product.supplierMonthlyCap,
        bulkQuotes: inquiriesOf(ctx).map((i) => ({ inquiryId: i.id, unitPriceSen: applyBp(product.bulkRefPriceSen, 9200) })),
        buyCompliance: false,
      }),
      midChoice: () => "ignore",
    },
    bulkOnly: {
      id: "bulkOnly",
      firstStockBp: () => 3000,
      decide: (ctx) => {
        const list = inquiriesOf(ctx);
        return {
          ...base(ctx),
          priceSen: product.maxPriceSen,
          adBidFen: 0,
          adDailyBudgetFen: 0,
          monthlyRestockQty: restockAtLeastMoq(Math.floor(list.reduce((s, i) => s + i.qty, 0) / 3), product),
          bulkQuotes: list.map((i) => ({ inquiryId: i.id, unitPriceSen: applyBp(product.bulkRefPriceSen, 9500) })),
          buyCompliance: riskAtLeastMid(ctx),
        };
      },
      midChoice: () => "ignore",
    },
    random: {
      id: "random",
      firstStockBp: (rng) => rng.int(3000, 8000),
      decide: (ctx) => {
        const { rng } = ctx;
        const steps = (product.maxPriceSen - product.minPriceSen) / params.priceStepSen.value;
        const restock = rng.int(0, product.supplierMonthlyCap);
        return {
          ...base(ctx),
          priceSen: product.minPriceSen + rng.int(0, steps) * params.priceStepSen.value,
          adBidFen: rng.int(0, rivalBid(ctx) * 2),
          adDailyBudgetFen: rng.int(0, 20000),
          monthlyRestockQty: restock > 0 ? restockAtLeastMoq(restock, product) : 0,
          bulkQuotes: inquiriesOf(ctx)
            .filter(() => rng.next() < 0.5)
            .map((i) => ({ inquiryId: i.id, unitPriceSen: Math.floor((product.bulkRefPriceSen * rng.int(85, 110)) / 100) })),
          buyCompliance: rng.next() < 0.5,
        };
      },
      midChoice: (s, shortQty, rng) => (rng.next() < 0.5 ? rushIfAffordable(s, shortQty, product, params) : "ignore"),
    },
  };
}

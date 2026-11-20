// 季度第一天，处理这个季度的决定（docs/04 第 10.1 节）
import { resolveBulkQuote } from "./bulk";
import type { GameEvent } from "./events";
import { emptyQuarterStats, type StepResult } from "./game";
import type { Product } from "./product";
import { headHaulFen } from "./stock";
import type { GameState, QuarterDecision } from "./types";
import type { Params } from "./util";

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** 决定的限制（docs/04 第 2.2 节）。不合法时抛出错误 */
export function validateDecision(state: GameState, decision: QuarterDecision, product: Product, params: Params): void {
  const { priceSen, monthlyRestockQty, adBidFen, adDailyBudgetFen, bulkQuotes } = decision;
  const step = params.priceStepSen.value;
  if (
    !Number.isInteger(priceSen) ||
    priceSen < product.minPriceSen ||
    priceSen > product.maxPriceSen ||
    (priceSen - product.minPriceSen) % step !== 0
  ) {
    throw new Error(`priceSen must be minPriceSen + k * priceStepSen within [min, max], got ${priceSen}`);
  }
  if (!isNonNegInt(monthlyRestockQty) || (monthlyRestockQty > 0 && monthlyRestockQty < product.moq)) {
    throw new Error(`monthlyRestockQty must be 0 or an integer >= moq ${product.moq}, got ${monthlyRestockQty}`);
  }
  if (!isNonNegInt(adBidFen)) throw new Error(`adBidFen must be an integer >= 0, got ${adBidFen}`);
  if (!isNonNegInt(adDailyBudgetFen)) throw new Error(`adDailyBudgetFen must be an integer >= 0, got ${adDailyBudgetFen}`);
  const q = Math.floor(state.day / 90);
  const seen = new Set<string>();
  for (const quote of bulkQuotes) {
    const inquiry = state.schedule.inquiries.find((i) => i.id === quote.inquiryId);
    if (!inquiry || inquiry.quarter !== q) throw new Error(`inquiry ${quote.inquiryId} is not in quarter ${q}`);
    if (seen.has(quote.inquiryId)) throw new Error(`inquiry ${quote.inquiryId} quoted twice`);
    seen.add(quote.inquiryId);
    if (!Number.isInteger(quote.unitPriceSen) || quote.unitPriceSen <= 0) {
      throw new Error(`unitPriceSen must be a positive integer, got ${quote.unitPriceSen}`);
    }
  }
}

export function startQuarter(state: GameState, decision: QuarterDecision, product: Product, params: Params): StepResult {
  if (state.phase !== "running" || state.day % 90 !== 0) {
    throw new Error(`startQuarter can only be called on the first day of a quarter while running (day ${state.day}, phase ${state.phase})`);
  }
  validateDecision(state, decision, product, params);

  const day = state.day;
  const q = Math.floor(day / 90);
  const events: GameEvent[] = [];
  const s: GameState = {
    ...state,
    totals: { ...state.totals },
    restockBatches: state.restockBatches.slice(),
    bulkOrders: state.bulkOrders.slice(),
    // 1. 季度统计清零
    quarterStats: emptyQuarterStats(),
  };

  // 2. 升级成本土店
  if (s.fulfillment === "cross" && decision.upgradeToLocal) {
    const feeFen = params.localSetupFeeFen.value;
    const moveFreightFen = headHaulFen(s.stockQty, product, params);
    const needFen = feeFen + moveFreightFen;
    if (s.cashFen < needFen) {
      events.push({ type: "upgrade_failed", day, needFen, cashFen: s.cashFen });
    } else {
      s.cashFen -= needFen;
      s.totals.setupFeeFen += feeFen;
      s.totals.restockFen += moveFreightFen;
      const headHaul = params.headHaulDays.value;
      // 还在路上的补货也要多走一段海运
      s.restockBatches = s.restockBatches.map((b) => (b.arriveDay >= day ? { ...b, arriveDay: b.arriveDay + headHaul } : b));
      const movedQty = s.stockQty;
      if (movedQty > 0) {
        // 现有库存变成一批在路上的货。编号用 UP 开头，和进货单区分
        s.restockBatches.push({
          id: `UP${q + 1}`,
          orderDay: day,
          qty: movedQty,
          unitCostFen: product.costFen,
          arriveDay: day + headHaul,
          rush: false,
        });
      }
      s.stockQty = 0;
      s.fulfillment = "local";
      s.riskPts = params.riskStartPts.value;
      events.push({ type: "upgraded", day, feeFen, moveFreightFen, movedQty });
    }
  }

  // 3. 合规
  if (s.fulfillment === "local" && decision.buyCompliance && s.cashFen >= params.complianceCostFen.value) {
    s.cashFen -= params.complianceCostFen.value;
    s.totals.complianceFen += params.complianceCostFen.value;
    s.riskPts = Math.max(0, s.riskPts - params.compliancePts.value);
    events.push({ type: "compliance_bought", day, costFen: params.complianceCostFen.value, riskPts: s.riskPts });
  }

  // 4. 大单报价，按 bulkQuotes 的顺序
  for (const quote of decision.bulkQuotes) {
    const inquiry = s.schedule.inquiries.find((i) => i.id === quote.inquiryId);
    if (!inquiry) continue; // validateDecision 已经检查过
    const r = resolveBulkQuote(inquiry, quote.unitPriceSen, s.bulkRep, s.fulfillment, params);
    if (r.won && r.valueFen !== null && r.depositFen !== null && r.shipDay !== null) {
      const warnDay = Math.max(day + 1, r.shipDay - params.bulkWarnDays.value);
      s.bulkOrders.push({
        inquiryId: inquiry.id,
        qty: inquiry.qty,
        unitPriceSen: quote.unitPriceSen,
        valueFen: r.valueFen,
        depositFen: r.depositFen,
        warnDay,
        shipDay: r.shipDay,
        dueDay: inquiry.dueDay,
        balanceDay: null,
        status: "won",
      });
      s.cashFen += r.depositFen;
      s.totals.bulkInFen += r.depositFen;
      s.totals.bulkWon += 1;
      events.push({
        type: "bulk_won",
        day,
        inquiryId: inquiry.id,
        unitPriceSen: quote.unitPriceSen,
        effectiveSen: r.effectiveSen,
        valueFen: r.valueFen,
        depositFen: r.depositFen,
        shipDay: r.shipDay,
        warnDay,
      });
    } else {
      events.push({
        type: "bulk_lost",
        day,
        inquiryId: inquiry.id,
        unitPriceSen: quote.unitPriceSen,
        effectiveSen: r.effectiveSen,
        rivalBestSen: inquiry.rivalBestSen,
      });
    }
  }

  // 5. 记下新的售价、广告出价、每日预算、每月补货量
  s.priceSen = decision.priceSen;
  s.adBidFen = decision.adBidFen;
  s.adDailyBudgetFen = decision.adDailyBudgetFen;
  s.monthlyRestockQty = decision.monthlyRestockQty;

  return { state: s, events };
}

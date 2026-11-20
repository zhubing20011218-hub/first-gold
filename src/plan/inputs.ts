// 输入的检查和提示（docs/09 第五节）。现金够不够不算出错，只在现金计划里显示。
import type { Product } from "../engine/product";
import type { GameState } from "../engine/types";
import type { Params } from "../engine/util";
import { senToFen } from "../engine/money";
import { headHaulFen } from "../engine/stock";
import { expectedMonthly, referenceNumbers } from "./reference";

export interface Check {
  error: { key: string; data: Record<string, number> } | null;
  hints: { key: string; data: Record<string, number> }[];
}

const ok: Check = { error: null, hints: [] };

export function checkRestock(qty: number, product: Product): Check {
  if (!Number.isInteger(qty) || qty < 0 || (qty > 0 && qty < product.moq)) return { error: { key: "restockZeroOrMoq", data: { moq: product.moq } }, hints: [] };
  if (qty > product.supplierMonthlyCap) return { error: { key: "restockCap", data: { cap: product.supplierMonthlyCap } }, hints: [] };
  return ok;
}

export function checkPrice(priceSen: number, product: Product, params: Params): Check {
  const valid =
    Number.isInteger(priceSen) &&
    priceSen >= product.minPriceSen &&
    priceSen <= product.maxPriceSen &&
    (priceSen - product.minPriceSen) % params.priceStepSen.value === 0;
  return valid ? ok : { error: { key: "priceRange", data: { minSen: product.minPriceSen, maxSen: product.maxPriceSen } }, hints: [] };
}

export function checkBid(bidFen: number, state: GameState, product: Product, params: Params): Check {
  const ref = referenceNumbers(state, product, params).refBidFen;
  if (!Number.isInteger(bidFen) || bidFen < 0) return { error: { key: "min", data: { fen: 0 } }, hints: [] };
  if (bidFen > ref * 3) return { error: { key: "max", data: { fen: ref * 3 } }, hints: [] };
  return { error: null, hints: bidFen > 0 && bidFen * 2 < ref ? [{ key: "hintBid", data: {} }] : [] };
}

/** 每日预算最多 ¥9,999（docs/09 第五节） */
export const BUDGET_MAX_FEN = 999900;

export function checkBudget(budgetFen: number): Check {
  if (!Number.isInteger(budgetFen) || budgetFen < 0) return { error: { key: "min", data: { fen: 0 } }, hints: [] };
  if (budgetFen > BUDGET_MAX_FEN) return { error: { key: "budgetMax", data: {} }, hints: [] };
  return ok;
}

export function checkQuote(inquiryId: string, priceSen: number, restockQty: number, state: GameState, product: Product, params: Params): Check {
  const max = product.bulkRefPriceSen * 2;
  if (!Number.isInteger(priceSen) || priceSen < 10) return { error: { key: "min", data: { sen: 10 } }, hints: [] };
  if (priceSen > max) return { error: { key: "max", data: { sen: max } }, hints: [] };
  const hints: Check["hints"] = [];
  const freight = state.fulfillment === "cross" ? headHaulFen(1, product, params) : 0;
  if (senToFen(priceSen, params.cnyPerRmE4.value) < product.costFen + freight) hints.push({ key: "hintQuote", data: {} });
  const inquiry = state.schedule.inquiries.find((i) => i.id === inquiryId);
  if (inquiry) {
    const ship = state.fulfillment === "cross" ? inquiry.dueDay - params.headHaulDays.value : inquiry.dueDay;
    const lead = state.fulfillment === "cross" ? params.supplierLeadDays.value : params.supplierLeadDays.value + params.headHaulDays.value;
    const offset = ship - Math.floor(state.day / 90) * 90;
    const arrivals = [0, 30, 60].filter((o) => o + lead <= offset).length;
    const exp = expectedMonthly(state, product, params);
    const available = state.stockQty + arrivals * Math.min(restockQty, product.supplierMonthlyCap) - Math.ceil((exp * offset) / 30);
    if (available < inquiry.qty) hints.push({ key: "hintBulkShort", data: { day: ship, qty: inquiry.qty, short: inquiry.qty - available } });
  }
  return { error: null, hints };
}

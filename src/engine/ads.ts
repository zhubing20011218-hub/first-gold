// 广告（docs/04 第 6.3 节）。实际能花掉多少由市场和推流分决定，不一定等于预算。
import type { Product } from "./product";
import { applyBp } from "./money";
import type { Params } from "./util";

export function adShareBp(ratioBp: number, params: Params): number {
  const start = params.adShareStartBp.value;
  const mid = params.adShareMidBp.value;
  const full = params.adShareFullBp.value;
  const atMid = params.adShareAtMidBp.value;
  if (ratioBp < start) return 0;
  if (ratioBp < mid) return Math.floor(((ratioBp - start) * atMid) / (mid - start));
  if (ratioBp < full) return atMid + Math.floor(((ratioBp - mid) * (10000 - atMid)) / (full - mid));
  return 10000;
}

export interface AdAuctionInput {
  adBidFen: number;
  adDailyBudgetFen: number;
  cashFen: number;
  demandBp: number;
  refBidFen: number;
  pushBp: number;
}

export interface AdAuctionResult {
  ratioBp: number;
  shareBp: number;
  clicks: number;
  adSpendFen: number;
  /** 乘上价格和评分两个系数之前的千分之一单 */
  m: number;
}

export function runAdAuction(input: AdAuctionInput, product: Product, params: Params): AdAuctionResult {
  const { adBidFen, adDailyBudgetFen, cashFen, demandBp, refBidFen, pushBp } = input;
  const ratioBp = refBidFen > 0 ? Math.floor((adBidFen * pushBp) / refBidFen) : 0;
  const shareBp = adShareBp(ratioBp, params);
  const poolClicks = applyBp(product.adClickPoolPerDay, demandBp);
  const availableClicks = applyBp(poolClicks, shareBp);
  const budgetFen = Math.min(adDailyBudgetFen, Math.max(0, cashFen));
  const affordableClicks = adBidFen > 0 ? Math.floor(budgetFen / adBidFen) : 0;
  const clicks = Math.min(availableClicks, affordableClicks);
  const adSpendFen = clicks * adBidFen;
  const m = Math.floor((clicks * product.adCvrBp) / 10);
  return { ratioBp, shareBp, clicks, adSpendFen, m };
}

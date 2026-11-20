// 大单的报价和中标（docs/04 第 7.2 节）
import type { Fulfillment } from "./game";
import type { BulkInquiry } from "./schedule";
import { applyBp, senToFen } from "./money";
import type { Params } from "./util";

export interface BulkQuoteResult {
  /** 信誉越高，报价显得越低 */
  effectiveSen: number;
  won: boolean;
  /** 下面三项只在中标时有值 */
  valueFen: number | null;
  depositFen: number | null;
  shipDay: number | null;
}

export function resolveBulkQuote(
  inquiry: BulkInquiry,
  unitPriceSen: number,
  bulkRep: number,
  fulfillment: Fulfillment,
  params: Params,
): BulkQuoteResult {
  if (!Number.isInteger(unitPriceSen) || unitPriceSen <= 0) {
    throw new Error(`unitPriceSen must be a positive integer, got ${unitPriceSen}`);
  }
  const effectiveSen = applyBp(unitPriceSen, 10000 - bulkRep * params.bulkRepStepBp.value);
  const won = effectiveSen <= inquiry.rivalBestSen;
  if (!won) return { effectiveSen, won, valueFen: null, depositFen: null, shipDay: null };
  const valueFen = senToFen(inquiry.qty * unitPriceSen, params.cnyPerRmE4.value);
  const depositFen = applyBp(valueFen, params.bulkDepositBp.value);
  const shipDay = fulfillment === "cross" ? inquiry.dueDay - params.headHaulDays.value : inquiry.dueDay;
  return { effectiveSen, won, valueFen, depositFen, shipDay };
}

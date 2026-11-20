// 进货的价格、本土店的仓储费、加急补货（docs/04 第 10.3、10.4 节，第十六节）
import type { Fulfillment } from "./game";
import type { Product } from "./product";
import { applyBp, senToFen } from "./money";
import type { Params } from "./util";

/** 从中国运到马来西亚的运费 */
export function headHaulFen(qty: number, product: Product, params: Params): number {
  return Math.ceil((qty * product.weightG * params.headHaulFenPerKg.value) / 1000);
}

export interface RestockCost {
  discountBp: number;
  unitCostFen: number;
  /** 货款 */
  goodsFen: number;
  /** 头程运费，只有本土店有 */
  headHaulFen: number;
  totalFen: number;
}

export function restockCostFen(qty: number, fulfillment: Fulfillment, product: Product, params: Params): RestockCost {
  const multiple = Math.floor(qty / product.moq);
  const discountBp =
    multiple >= params.buyTier2Multiple.value
      ? params.buyTier2DiscountBp.value
      : multiple >= params.buyTier1Multiple.value
        ? params.buyTier1DiscountBp.value
        : 0;
  const unitCostFen = applyBp(product.costFen, 10000 - discountBp);
  const goodsFen = qty * unitCostFen;
  const haul = fulfillment === "local" ? headHaulFen(qty, product, params) : 0;
  return { discountBp, unitCostFen, goodsFen, headHaulFen: haul, totalFen: goodsFen + haul };
}

/** 没有折扣时买得起的最大件数（docs/04 第 10.4 节：按没有折扣的价格估算） */
export function affordableQty(cashFen: number, fulfillment: Fulfillment, product: Product, params: Params): number {
  if (cashFen <= 0) return 0;
  const haul = (q: number): number => (fulfillment === "local" ? headHaulFen(q, product, params) : 0);
  // 每件的头程运费是"千分之一分"，先放大一千倍再除，避免小数
  const perUnitMilli = product.costFen * 1000 + (fulfillment === "local" ? product.weightG * params.headHaulFenPerKg.value : 0);
  let qty = Math.floor((cashFen * 1000) / perUnitMilli);
  // 头程运费向上取整，可能多出一点，往回减到真的付得起
  while (qty > 0 && qty * product.costFen + haul(qty) > cashFen) qty--;
  return qty;
}

export interface StorageFee {
  normalQty: number;
  agedQty: number;
  normalSen: number;
  agedSen: number;
  totalSen: number;
  feeFen: number;
}

export function storageFeeFen(stockQty: number, lastMonthUnits: number, product: Product, params: Params): StorageFee {
  const normalQty = Math.min(stockQty, lastMonthUnits);
  const agedQty = stockQty - normalQty;
  const normalSen = Math.ceil((normalQty * product.volumeCm3 * params.storageSenPerCbmDay.value * 30) / 1000000);
  const agedSen = Math.ceil((agedQty * product.volumeCm3 * params.agedStorageSenPerCbmDay.value * 30) / 1000000);
  const totalSen = normalSen + agedSen;
  return { normalQty, agedQty, normalSen, agedSen, totalSen, feeFen: senToFen(totalSen, params.cnyPerRmE4.value) };
}

export interface RushOrder {
  qty: number;
  unitCostFen: number;
  totalFen: number;
  leadDays: number;
}

/** 加急补货：件数凑到 10 的倍数，每件按现在的发货方式加价（docs/04 第十六节） */
export function rushOrder(shortQty: number, fulfillment: Fulfillment, product: Product, params: Params): RushOrder {
  const qty = Math.ceil(shortQty / 10) * 10;
  const premiumBp = fulfillment === "cross" ? params.rushPremiumCrossBp.value : params.rushPremiumLocalBp.value;
  const unitCostFen = applyBp(product.costFen, 10000 + premiumBp);
  const leadDays = fulfillment === "cross" ? params.rushLeadCrossDays.value : params.rushLeadLocalDays.value;
  return { qty, unitCostFen, totalFen: qty * unitCostFen, leadDays };
}

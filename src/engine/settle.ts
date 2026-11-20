// 每单结算：卖出一单，平台打给卖家多少钱，卖家这一单赚多少（docs/03）。
// 平台那一边的钱用仙，卖家的成本和利润用分。每一项费用单独算，算完立刻取整。
import type { Param } from "../params/types";
import type { Fulfillment } from "./game";
import { applyBp, senToFen } from "./money";

export type Region = "west" | "east";

/** 每单结算用到的参数（docs/03 第八节） */
export interface SettleParams {
  cnyPerRmE4: Param;
  platformFixedFeeSen: Param;
  transactionFeeBp: Param;
  crossCommissionBp: Param;
  crossSstBp: Param;
  crossBuyerShippingWestSen: Param;
  crossBuyerShippingEastSen: Param;
  crossShipBaseWeightG: Param;
  crossShipBaseFeeSen: Param;
  crossShipStepG: Param;
  crossShipStepFeeSen: Param;
  crossShipSstBp: Param;
  crossForwarderFeeFen: Param;
  localCommissionBp: Param;
  localDeliveryFeeWestSen: Param;
  localDeliveryFeeEastSen: Param;
  localPlatformShippingBp: Param;
  localCashbackFeeBp: Param;
  localLabelFeeFen: Param;
}

export interface SettleInput {
  fulfillment: Fulfillment;
  priceSen: number;
  /** 本土店时不使用 */
  weightG: number;
  region: Region;
  /** 没有达人时传 0 */
  creatorBp: number;
  /** 只对本土店有效 */
  joinCashback: boolean;
  /** 不传时用这种发货方式的默认值 */
  commissionBp?: number;
}

export interface SettleResult {
  commissionSen: number;
  transactionFeeSen: number;
  fixedFeeSen: number;
  sstSen: number;
  crossShippingSen: number;
  platformShippingSen: number;
  cashbackFeeSen: number;
  creatorFeeSen: number;
  totalFeeSen: number;
  payoutSen: number;
  payoutFen: number;
}

export interface UnitProfitInput extends SettleInput {
  costFen: number;
  adsFen: number;
  otherFen: number;
}

export interface UnitProfitResult {
  settle: SettleResult;
  perOrderFeeFen: number;
  revenueFen: number;
  profitFen: number;
  marginBp: number;
}

function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

function assertWeight(weightG: number): void {
  if (!Number.isInteger(weightG) || weightG < 1) {
    throw new Error(`weightG must be an integer >= 1, got ${weightG}`);
  }
}

function validate(input: SettleInput): void {
  if (input.fulfillment !== "cross" && input.fulfillment !== "local") {
    throw new Error(`fulfillment must be "cross" or "local", got ${String(input.fulfillment)}`);
  }
  if (!Number.isInteger(input.priceSen) || input.priceSen <= 0) {
    throw new Error(`priceSen must be a positive integer, got ${input.priceSen}`);
  }
  if (input.fulfillment === "cross") assertWeight(input.weightG);
  if (input.region !== "west" && input.region !== "east") {
    throw new Error(`region must be "west" or "east", got ${String(input.region)}`);
  }
  if (!isNonNegativeInt(input.creatorBp)) {
    throw new Error(`creatorBp must be an integer >= 0, got ${input.creatorBp}`);
  }
  if (input.commissionBp !== undefined && !isNonNegativeInt(input.commissionBp)) {
    throw new Error(`commissionBp must be an integer >= 0, got ${input.commissionBp}`);
  }
}

/** 跨境运费：起算重量以内一个价，之后每一档加价，最后加税（docs/03 第五节） */
export function crossShippingSen(weightG: number, params: SettleParams): number {
  assertWeight(weightG);
  const baseWeightG = params.crossShipBaseWeightG.value;
  const steps = weightG <= baseWeightG ? 0 : Math.ceil((weightG - baseWeightG) / params.crossShipStepG.value);
  const baseSen = params.crossShipBaseFeeSen.value + params.crossShipStepFeeSen.value * steps;
  return baseSen + applyBp(baseSen, params.crossShipSstBp.value);
}

/** 一单的各项费用和平台打款（docs/03 第四、六、七节） */
export function settleOrder(input: SettleInput, params: SettleParams): SettleResult {
  validate(input);
  const { priceSen, region, creatorBp } = input;
  const fixedFeeSen = params.platformFixedFeeSen.value;
  const creatorFeeSen = applyBp(priceSen, creatorBp);

  let commissionSen: number;
  let transactionFeeSen: number;
  let sstSen = 0;
  let crossShipSen = 0;
  let platformShippingSen = 0;
  let cashbackFeeSen = 0;

  if (input.fulfillment === "cross") {
    const buyerShippingSen =
      region === "west" ? params.crossBuyerShippingWestSen.value : params.crossBuyerShippingEastSen.value;
    commissionSen = applyBp(priceSen, input.commissionBp ?? params.crossCommissionBp.value);
    transactionFeeSen = applyBp(priceSen + buyerShippingSen, params.transactionFeeBp.value);
    sstSen = applyBp(priceSen, params.crossSstBp.value);
    crossShipSen = crossShippingSen(input.weightG, params);
  } else {
    const deliveryFeeSen =
      region === "west" ? params.localDeliveryFeeWestSen.value : params.localDeliveryFeeEastSen.value;
    commissionSen = applyBp(priceSen, input.commissionBp ?? params.localCommissionBp.value);
    transactionFeeSen = applyBp(priceSen + deliveryFeeSen, params.transactionFeeBp.value);
    platformShippingSen = applyBp(deliveryFeeSen, params.localPlatformShippingBp.value);
    cashbackFeeSen = input.joinCashback ? applyBp(priceSen, params.localCashbackFeeBp.value) : 0;
  }

  const totalFeeSen =
    commissionSen +
    transactionFeeSen +
    fixedFeeSen +
    sstSen +
    crossShipSen +
    platformShippingSen +
    cashbackFeeSen +
    creatorFeeSen;
  const payoutSen = priceSen - totalFeeSen;

  return {
    commissionSen,
    transactionFeeSen,
    fixedFeeSen,
    sstSen,
    crossShippingSen: crossShipSen,
    platformShippingSen,
    cashbackFeeSen,
    creatorFeeSen,
    totalFeeSen,
    payoutSen,
    payoutFen: senToFen(payoutSen, params.cnyPerRmE4.value),
  };
}

/** 一单的利润（docs/03 第七节） */
export function unitProfit(input: UnitProfitInput, params: SettleParams): UnitProfitResult {
  for (const key of ["costFen", "adsFen", "otherFen"] as const) {
    if (!isNonNegativeInt(input[key])) {
      throw new Error(`${key} must be an integer >= 0, got ${input[key]}`);
    }
  }
  const settle = settleOrder(input, params);
  const perOrderFeeFen =
    input.fulfillment === "cross" ? params.crossForwarderFeeFen.value : params.localLabelFeeFen.value;
  const revenueFen = senToFen(input.priceSen, params.cnyPerRmE4.value);
  const profitFen = settle.payoutFen - input.costFen - perOrderFeeFen - input.adsFen - input.otherFen;
  const marginBp = revenueFen === 0 ? 0 : Math.round((profitFen * 10000) / revenueFen);
  return { settle, perOrderFeeFen, revenueFen, profitFen, marginBp };
}

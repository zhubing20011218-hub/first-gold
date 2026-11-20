// 市场热度和两个成交系数（docs/04 第四节、6.1）
import type { Product } from "./product";
import { applyBp } from "./money";
import { dayRng } from "./dayRng";
import { calendarOf, clamp, type Params } from "./util";

export interface Market {
  demandBp: number;
  competitionBp: number;
  /** 对手的广告出价，显示给玩家 */
  refBidFen: number;
}

export function marketOfDay(seed: number, day: number, product: Product, params: Params): Market {
  const { season, year } = calendarOf(day);
  const yearBp = year === 0 ? 10000 : params.year2DemandBp.value;
  const noiseBp = dayRng(seed, day, 1).int(params.demandNoiseMinBp.value, params.demandNoiseMaxBp.value);
  const demandBp = applyBp(applyBp(product.seasonBp[season], yearBp), noiseBp);
  const competitionBp = applyBp(
    params.seasonCompetitionBp.value[season],
    year === 0 ? 10000 : params.year2CompetitionBp.value,
  );
  const refBidFen = applyBp(product.baseCpcFen, competitionBp);
  return { demandBp, competitionBp, refBidFen };
}

export function priceFactorBp(priceSen: number, product: Product, params: Params): number {
  const raw =
    10000 - Math.round((product.elasticityE2 * (priceSen - product.refPriceSen) * 100) / product.refPriceSen);
  return clamp(raw, params.priceFactorMinBp.value, params.priceFactorMaxBp.value);
}

export function ratingFactorBp(ratingE1: number, params: Params): number {
  return Math.max(
    params.ratingFactorMinBp.value,
    10000 - (params.initialRatingE1.value - ratingE1) * params.ratingStepBp.value,
  );
}

/** 自然订单的千分之一单，返回每一步乘完之后的值（docs/04 第 6.2 节） */
export function organicMilliSteps(
  product: Product,
  demandBp: number,
  pushBp: number,
  priceFactor: number,
  ratingFactor: number,
): number[] {
  const steps = [product.organicPerDayMilli];
  for (const bp of [demandBp, pushBp, priceFactor, ratingFactor]) steps.push(applyBp(steps[steps.length - 1], bp));
  return steps;
}

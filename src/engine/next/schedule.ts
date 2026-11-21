// 开局时按种子定好的事：每季的趋势、询单和对手报价、事件、延误、差评、达人直播日、对手的综合分和利润
import { applyBp } from "../money";
import { dayRng } from "../dayRng";
import type { Rng } from "../rng";
import { clamp } from "../util";
import { DAYS_PER_QUARTER } from "./core";
import { BAD_EVENTS, GOOD_EVENTS, type EventKind, type Inquiry, type Schedule, type ScheduledEvent, type World } from "./types";

const QUARTERS = 8;

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[rng.int(0, list.length - 1)];
}

/** 双 11 那天（第 4、第 8 季度） */
export function double11Day(quarter: number, offset: number): number | null {
  return quarter % 4 === 3 ? quarter * DAYS_PER_QUARTER + offset : null;
}

function avoidDouble11(day: number, offset: number): number {
  const q = Math.floor(day / DAYS_PER_QUARTER);
  const d11 = double11Day(q, offset);
  return d11 !== null && Math.abs(day - d11) <= 2 ? day + 5 : day;
}

export function buildSchedule(seed: number, world: World): Schedule {
  const { params, products } = world;
  const rng = dayRng(seed, 0, 16);
  const ids = products.map((p) => p.id);
  const d11 = params.double11Offset.value;

  // 1. 每季的趋势：一种货特别火，一种货变冷
  const trendBp: Record<string, number>[] = [];
  const hotOf: string[] = [];
  for (let q = 0; q < QUARTERS; q++) {
    const hot = rng.int(0, ids.length - 1);
    let cold = rng.int(0, ids.length - 2);
    if (cold >= hot) cold++;
    const t: Record<string, number> = {};
    for (const id of ids) t[id] = 10000;
    t[ids[hot]] = params.trendHotBp.value;
    t[ids[cold]] = params.trendColdBp.value;
    trendBp.push(t);
    hotOf.push(ids[hot]);
  }
  const surpriseBp: Record<string, number>[] = [];
  for (let q = 0; q < QUARTERS; q++) {
    const t: Record<string, number> = {};
    for (const id of ids) t[id] = rng.int(params.surpriseMinBp.value, params.surpriseMaxBp.value);
    surpriseBp.push(t);
  }

  // 2. 询单：第 2 到第 8 季度，每季准备 bulkInquiryMax 张
  const inquiries: Inquiry[] = [];
  const inquiryCount: number[] = [0];
  for (let q = 1; q < QUARTERS; q++) {
    inquiryCount.push(rng.int(params.bulkPerQuarterMin.value, params.bulkPerQuarterMax.value));
    const year = Math.floor(q / 4);
    for (let i = 0; i < params.bulkInquiryMax.value; i++) {
      const productId = i === 0 && rng.int(0, 1) === 0 ? hotOf[q] : pick(rng, ids);
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error(`unknown product ${productId}`);
      const qtyBp = rng.int(params.bulkQtyMinBp.value, params.bulkQtyMaxBp.value);
      const baseQty = Math.max(10, Math.floor(applyBp(applyBp(product.bulkQtyBase, params.bulkQtyScaleBp.value), qtyBp) / 10) * 10);
      const dueDay = avoidDouble11(q * DAYS_PER_QUARTER + rng.int(params.bulkDueMinOffset.value, params.bulkDueMaxOffset.value), d11);
      const refPriceSen = applyBp(
        applyBp(product.bulkRefPriceSen, params.bulkRefPriceBp.value),
        year === 0 ? 10000 : params.year2BulkPriceBp.value,
      );
      const rivalBidSen: number[] = [];
      const rivalEstimateSen: number[] = [];
      for (let r = 0; r < 3; r++) {
        const bid = Math.round(applyBp(refPriceSen, rng.int(params.rivalBidMinBp.value, params.rivalBidMaxBp.value)) / 10) * 10;
        const noise = params.rivalEstimateNoiseBp.value;
        rivalBidSen.push(bid);
        rivalEstimateSen.push(Math.round(applyBp(bid, rng.int(10000 - noise, 10000 + noise)) / 10) * 10);
      }
      inquiries.push({
        id: `q${q}-${i + 1}`,
        quarter: q,
        index: i,
        productId,
        baseQty,
        dueDay,
        refPriceSen,
        rivalBidSen,
        rivalEstimateSen,
        clientNo: rng.int(0, 9),
      });
    }
  }

  // 3. 事件：第 2 到第 8 季度每季一件，好坏交替出现，不会连着三次一样
  const events: ScheduledEvent[] = [];
  let last: EventKind | null = null;
  const polarity: boolean[] = [];
  for (let q = 1; q < QUARTERS; q++) {
    let good = rng.int(0, 1) === 0;
    const n = polarity.length;
    if (n >= 2 && polarity[n - 1] === good && polarity[n - 2] === good) good = !good;
    polarity.push(good);
    let kind = pick(rng, good ? GOOD_EVENTS : BAD_EVENTS);
    if (kind === last) kind = pick(rng, good ? GOOD_EVENTS : BAD_EVENTS);
    last = kind;
    const day = avoidDouble11(q * DAYS_PER_QUARTER + rng.int(params.eventMinOffset.value, params.eventMaxOffset.value), d11);
    events.push({ quarter: q, day, kind });
  }

  // 4. 运输延误每年 1 次，差评每年 2 次
  const delayDays: number[] = [];
  const badReviewDays: number[] = [];
  for (let y = 0; y < 2; y++) {
    delayDays.push(y * 360 + rng.int(params.delayMinOffset.value, params.delayMaxOffset.value));
    for (let i = 0; i < 2; i++) {
      let d = y * 360 + rng.int(params.badReviewMinOffset.value, params.badReviewMaxOffset.value);
      while (badReviewDays.includes(d)) d++;
      badReviewDays.push(d);
    }
  }

  // 5. 达人直播日：第 3 到第 8 季度
  const creatorDays: number[] = [];
  for (let q = 2; q < QUARTERS; q++) {
    for (let i = 0; i < params.creatorPerQuarter.value; i++) {
      let d = avoidDouble11(q * DAYS_PER_QUARTER + rng.int(10, 80), d11);
      while (creatorDays.includes(d)) d++;
      creatorDays.push(d);
    }
  }

  // 6. 对手：综合分每季上下变；利润只用来排名
  const rivalComp: number[][] = [];
  const rivalProfitFen: number[][] = [];
  const base = params.rivalCompBase.value;
  const drift = params.rivalCompDrift.value;
  for (let r = 0; r < 3; r++) {
    const comps: number[] = [];
    const profits: number[] = [];
    let comp = base[r];
    for (let q = 0; q < QUARTERS; q++) {
      if (q > 0) comp = clamp(comp + rng.int(-drift, drift), 40, 95);
      comps.push(comp);
      const grown = applyBp(params.rivalProfitBaseFen.value[r], 10000 + q * params.rivalProfitGrowthBp.value);
      const noiseBp = r === 1 ? rng.int(-4000, 12000) : rng.int(6000, 13000);
      profits.push(Math.round((grown * noiseBp) / 10000 / 10000) * 10000);
    }
    rivalComp.push(comps);
    rivalProfitFen.push(profits);
  }

  return {
    trendBp,
    surpriseBp,
    inquiries,
    inquiryCount,
    events,
    delayDays,
    badReviewDays,
    creatorDays,
    rivalComp,
    rivalProfitFen,
    goodCard: pick(rng, GOOD_EVENTS),
    badCard: pick(rng, BAD_EVENTS),
  };
}

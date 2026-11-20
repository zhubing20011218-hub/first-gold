// 开局时定好的事：运输延误、差评、询价单（docs/04 第九节、7.1）
import type { Product } from "./product";
import { applyBp } from "./money";
import { dayRng } from "./dayRng";
import type { Params } from "./util";

export interface BulkInquiry {
  id: string;
  quarter: number;
  qty: number;
  /** 交货日 */
  dueDay: number;
  /** 对手里最低的报价。报价之前不显示给玩家 */
  rivalBestSen: number;
}

export interface Schedule {
  delayDays: number[];
  badReviewDays: number[];
  inquiries: BulkInquiry[];
}

export function buildSchedule(seed: number, product: Product, params: Params): Schedule {
  const rng = dayRng(seed, 0, 6);
  const years = Math.ceil(params.quartersPerGame.value / 4);

  // 1. 运输延误，每年 1 次
  const delayDays: number[] = [];
  for (let year = 0; year < years; year++) {
    delayDays.push(year * 360 + rng.int(params.delayMinOffset.value, params.delayMaxOffset.value));
  }

  // 2. 差评，每年 badReviewCount 次。和已有的差评日期相同就加 1 天
  const badReviewDays: number[] = [];
  for (let year = 0; year < years; year++) {
    for (let i = 0; i < product.badReviewCount; i++) {
      let d = year * 360 + rng.int(params.badReviewMinOffset.value, params.badReviewMaxOffset.value);
      while (badReviewDays.includes(d)) d++;
      badReviewDays.push(d);
    }
  }

  // 3. 询价单：从 bulkStartQuarter 到最后一个季度
  const inquiries: BulkInquiry[] = [];
  for (let q = params.bulkStartQuarter.value; q < params.quartersPerGame.value; q++) {
    const year = Math.floor(q / 4);
    const count = rng.int(params.bulkPerQuarterMin.value, params.bulkPerQuarterMax.value);
    for (let i = 1; i <= count; i++) {
      const qtyBp = rng.int(params.bulkQtyMinBp.value, params.bulkQtyMaxBp.value);
      const qty = Math.max(10, Math.floor(applyBp(product.bulkQtyBase, qtyBp) / 10) * 10);
      const dueDay = q * 90 + rng.int(params.bulkDueMinOffset.value, params.bulkDueMaxOffset.value);
      const rivalBp = rng.int(params.bulkRivalMinBp.value, params.bulkRivalMaxBp.value);
      const rivalBestSen = applyBp(
        applyBp(product.bulkRefPriceSen, rivalBp),
        year === 0 ? 10000 : params.year2BulkPriceBp.value,
      );
      inquiries.push({ id: `q${q}-${i}`, quarter: q, qty, dueDay, rivalBestSen });
    }
  }

  return { delayDays, badReviewDays, inquiries };
}

// 任务 03 第一步：不依赖状态的函数和它们的核对用例（docs/04 第 14.1 到 14.5 节、第十五节，docs/05 第四节）。
// 期望的数字照抄文档。
import { describe, expect, it } from "vitest";
import { malaysia as P } from "../src/params/malaysia";
import { getProduct, products } from "../src/products/catalog";
import { computePushScore, emptyMonthStats } from "../src/engine/push";
import { runAdAuction, adShareBp } from "../src/engine/ads";
import { priceFactorBp, ratingFactorBp, marketOfDay } from "../src/engine/market";
import { applyBp } from "../src/engine/money";
import { resolveBulkQuote } from "../src/engine/bulk";
import { restockCostFen, storageFeeFen, rushOrder, affordableQty } from "../src/engine/stock";
import { buildSchedule } from "../src/engine/schedule";
import { dayRng, roundMilli } from "../src/engine/dayRng";
import { unitProfit } from "../src/engine/settle";

const hijab = getProduct("hijab");
const earbuds = getProduct("earbuds");
const phoneCase = getProduct("phone_case");

describe("商品库核对：参考售价下每单赚多少（docs/05 第四节）", () => {
  const check = (id: string, f: "cross" | "local", payoutSen: number, payoutFen: number, profitFen: number) => {
    const p = getProduct(id);
    const r = unitProfit(
      {
        fulfillment: f,
        priceSen: p.refPriceSen,
        weightG: p.weightG,
        region: "west",
        creatorBp: 0,
        joinCashback: false,
        costFen: p.costFen,
        adsFen: 0,
        otherFen: 0,
      },
      P,
    );
    expect(r.settle.payoutSen).toBe(payoutSen);
    expect(r.settle.payoutFen).toBe(payoutFen);
    expect(r.profitFen).toBe(profitFen);
  };
  it("[G05-4#01] phone_case cross 990", () => check("phone_case", "cross", 622, 1026, 496));
  it("[G05-4#02] phone_case local 990", () => check("phone_case", "local", 752, 1241, 641));
  it("[G05-4#03] arm_sleeve cross 1290", () => check("arm_sleeve", "cross", 814, 1343, 713));
  it("[G05-4#04] arm_sleeve local 1290", () => check("arm_sleeve", "local", 1011, 1668, 968));
  it("[G05-4#05] hijab cross 1990", () => check("hijab", "cross", 1271, 2097, 1067));
  it("[G05-4#06] hijab local 1990", () => check("hijab", "local", 1614, 2663, 1563));
  it("[G05-4#07] mini_fan cross 2990", () => check("mini_fan", "cross", 1805, 2978, 1348));
  it("[G05-4#08] mini_fan local 2990", () => check("mini_fan", "local", 2476, 4085, 2385));
  it("[G05-4#09] blouse cross 3290", () => check("blouse", "cross", 2061, 3401, 1871));
  it("[G05-4#10] blouse local 3290", () => check("blouse", "local", 2735, 4513, 2913));
  it("[G05-4#11] earbuds cross 4590", () => check("earbuds", "cross", 3131, 5166, 2836));
  it("[G05-4#12] earbuds local 4590", () => check("earbuds", "local", 3856, 6362, 3962));
});

describe("商品库", () => {
  it("6 种商品，id 不重复，最低价 ≤ 参考价 ≤ 最高价", () => {
    expect(products).toHaveLength(6);
    expect(new Set(products.map((p) => p.id)).size).toBe(6);
    for (const p of products) {
      expect(p.minPriceSen).toBeLessThanOrEqual(p.refPriceSen);
      expect(p.refPriceSen).toBeLessThanOrEqual(p.maxPriceSen);
      expect(p.seasonBp).toHaveLength(4);
    }
  });
  it("找不到的商品抛出错误", () => expect(() => getProduct("nope")).toThrow());
});

describe("推流分（docs/04 第 14.1 节）", () => {
  it("[G04-14.1#01] P1 头巾 跨境直发 没有数据 售价 1990", () => {
    const r = computePushScore(emptyMonthStats(), false, 1990, "cross", hijab, P);
    expect(r).toEqual({ sales: 6, stock: 20, price: 12, complete: 17, speed: 10, total: 65, pushBp: 10000 });
  });
  it("[G04-14.1#02] P2 头巾 本土店 发出 240 来单 270 缺货 30 签收 200 退货 8 售价 1690", () => {
    const stats = { ...emptyMonthStats(), shipped: 240, wanted: 270, lost: 30, delivered: 200, returned: 8, delayed: false };
    const r = computePushScore(stats, true, 1690, "local", hijab, P);
    expect(r).toEqual({ sales: 20, stock: 11, price: 18, complete: 16, speed: 20, total: 85, pushBp: 12000 });
  });
  it("[G04-14.1#03] P3 蓝牙耳机 跨境直发 发出 30 来单 30 签收 20 退货 4 延误 售价 5990", () => {
    const stats = { ...emptyMonthStats(), shipped: 30, wanted: 30, lost: 0, delivered: 20, returned: 4, delayed: true };
    const r = computePushScore(stats, true, 5990, "cross", earbuds, P);
    expect(r).toEqual({ sales: 5, stock: 20, price: 0, complete: 0, speed: 4, total: 29, pushBp: 6400 });
  });
});

describe("广告（docs/04 第 14.2 节）", () => {
  const run = (adBidFen: number, budget: number, cash: number, demandBp: number, refBid: number, pushBp: number) =>
    runAdAuction({ adBidFen, adDailyBudgetFen: budget, cashFen: cash, demandBp, refBidFen: refBid, pushBp }, hijab, P);
  const expectRow = (r: ReturnType<typeof run>, ratio: number, share: number, clicks: number, spend: number, m: number) =>
    expect(r).toEqual({ ratioBp: ratio, shareBp: share, clicks, adSpendFen: spend, m });

  it("[G04-14.2#01] A1 出价 30 预算 10000", () => expectRow(run(30, 10000, 500000, 10000, 30, 10000), 10000, 6000, 180, 5400, 6300));
  it("[G04-14.2#02] A2 出价 20", () => expectRow(run(20, 10000, 500000, 10000, 30, 10000), 6666, 1999, 60, 1200, 2100));
  it("[G04-14.2#03] A3 出价 45", () => expectRow(run(45, 10000, 500000, 10000, 30, 10000), 15000, 10000, 222, 9990, 7770));
  it("[G04-14.2#04] A4 出价 14", () => expectRow(run(14, 10000, 500000, 10000, 30, 10000), 4666, 0, 0, 0, 0));
  it("[G04-14.2#05] A5 demandBp 30000 对手出价 42", () => expectRow(run(30, 10000, 500000, 30000, 42, 10000), 7142, 2570, 231, 6930, 8085));
  it("[G04-14.2#06] A6 现金 1000", () => expectRow(run(30, 10000, 1000, 10000, 30, 10000), 10000, 6000, 33, 990, 1155));
  it("[G04-14.2#07] A7 出价 0", () => expectRow(run(0, 10000, 500000, 10000, 30, 10000), 0, 0, 0, 0, 0));
  it("[G04-14.2#08] A8 pushBp 12000", () => expectRow(run(30, 10000, 500000, 10000, 30, 12000), 12000, 7600, 228, 6840, 7980));
  it("[G04-14.2#09] A9 pushBp 6400", () => expectRow(run(30, 10000, 500000, 10000, 30, 6400), 6400, 1680, 50, 1500, 1750));

  it("adShareBp 的四段", () => {
    expect(adShareBp(4999, P)).toBe(0);
    expect(adShareBp(5000, P)).toBe(0);
    expect(adShareBp(10000, P)).toBe(6000);
    expect(adShareBp(14999, P)).toBe(9999);
    expect(adShareBp(15000, P)).toBe(10000);
    expect(adShareBp(99999, P)).toBe(10000);
  });
  it("现金是负数时预算按 0 算", () => {
    expect(run(30, 10000, -500, 10000, 30, 10000).clicks).toBe(0);
  });
});

describe("价格系数和自然订单（docs/04 第 14.3 节）", () => {
  it("[G04-14.3#01] 头巾 1990 → 10000", () => expect(priceFactorBp(1990, hijab, P)).toBe(10000));
  it("[G04-14.3#02] 头巾 2190 → 8492", () => expect(priceFactorBp(2190, hijab, P)).toBe(8492));
  it("[G04-14.3#03] 头巾 1690 → 12261", () => expect(priceFactorBp(1690, hijab, P)).toBe(12261));
  it("[G04-14.3#04] 头巾 2590 → 5477", () => expect(priceFactorBp(2590, hijab, P)).toBe(5477));
  it("[G04-14.3#05] 手机壳 1290 → 2000（算出来是 909，被下限挡住）", () => expect(priceFactorBp(1290, phoneCase, P)).toBe(2000));
  it("[G04-14.3#06] 自然订单的 m：4000、4000、4400、3736、3736", () => {
    const steps: number[] = [];
    let m = hijab.organicPerDayMilli;
    steps.push(m);
    m = applyBp(m, 10000);
    steps.push(m);
    m = applyBp(m, 11000);
    steps.push(m);
    m = applyBp(m, priceFactorBp(2190, hijab, P));
    steps.push(m);
    m = applyBp(m, ratingFactorBp(48, P));
    steps.push(m);
    expect(steps).toEqual([4000, 4000, 4400, 3736, 3736]);
  });

  it("ratingFactorBp：评分每低 0.1 分少 8%，最低 3000", () => {
    expect(ratingFactorBp(48, P)).toBe(10000);
    expect(ratingFactorBp(45, P)).toBe(7600);
    expect(ratingFactorBp(30, P)).toBe(3000);
  });
});

describe("大单报价（docs/04 第 14.4 节）", () => {
  const inquiry = { id: "q1-1", quarter: 1, qty: 300, dueDay: 60, rivalBestSen: 1010 };
  it("[G04-14.4#01] B1 报价 1020 信誉 0 跨境直发 → 有效 1020，不中标", () => {
    expect(resolveBulkQuote(inquiry, 1020, 0, "cross", P)).toEqual({
      effectiveSen: 1020, won: false, valueFen: null, depositFen: null, shipDay: null,
    });
  });
  it("[G04-14.4#02] B2 报价 1020 信誉 4 跨境直发 → 有效 979，中标", () => {
    expect(resolveBulkQuote(inquiry, 1020, 4, "cross", P)).toEqual({
      effectiveSen: 979, won: true, valueFen: 504900, depositFen: 151470, shipDay: 50,
    });
  });
  it("[G04-14.4#03] B3 报价 1010 信誉 0 本土店 → 有效 1010，中标", () => {
    expect(resolveBulkQuote(inquiry, 1010, 0, "local", P)).toEqual({
      effectiveSen: 1010, won: true, valueFen: 499950, depositFen: 149985, shipDay: 60,
    });
  });
  it("[G04-14.4#04] B2 的后续：运费 24000，尾款 353430，违约时退定金 151470、赔违约金 100980", () => {
    const r = resolveBulkQuote(inquiry, 1020, 4, "cross", P);
    const valueFen = r.valueFen ?? 0;
    const depositFen = r.depositFen ?? 0;
    expect(Math.ceil((inquiry.qty * hijab.weightG * P.headHaulFenPerKg.value) / 1000)).toBe(24000);
    expect(valueFen - depositFen).toBe(353430);
    expect(depositFen).toBe(151470);
    expect(applyBp(valueFen, P.bulkPenaltyBp.value)).toBe(100980);
  });
  it("报价不是正整数时抛出错误", () => expect(() => resolveBulkQuote(inquiry, 0, 0, "cross", P)).toThrow(/unitPriceSen/));
});

describe("进货价格和仓储费（docs/04 第 14.5 节）", () => {
  it("[G04-14.5#01] 100 件 跨境直发 没有折扣", () =>
    expect(restockCostFen(100, "cross", hijab, P)).toEqual({ discountBp: 0, unitCostFen: 900, goodsFen: 90000, headHaulFen: 0, totalFen: 90000 }));
  it("[G04-14.5#02] 300 件 跨境直发 便宜 5%", () =>
    expect(restockCostFen(300, "cross", hijab, P)).toEqual({ discountBp: 500, unitCostFen: 855, goodsFen: 256500, headHaulFen: 0, totalFen: 256500 }));
  it("[G04-14.5#03] 500 件 跨境直发 便宜 10%", () =>
    expect(restockCostFen(500, "cross", hijab, P)).toEqual({ discountBp: 1000, unitCostFen: 810, goodsFen: 405000, headHaulFen: 0, totalFen: 405000 }));
  it("[G04-14.5#04] 500 件 本土店 便宜 10%，加头程运费", () =>
    expect(restockCostFen(500, "local", hijab, P)).toEqual({ discountBp: 1000, unitCostFen: 810, goodsFen: 405000, headHaulFen: 40000, totalFen: 445000 }));
  it("[G04-14.5#05] 仓储费：库存 600 件、上个月发出 250 件 → 600 仙 + 1680 仙 = 2280 仙，折合 3762 分", () => {
    expect(storageFeeFen(600, 250, hijab, P)).toEqual({
      normalQty: 250, agedQty: 350, normalSen: 600, agedSen: 1680, totalSen: 2280, feeFen: 3762,
    });
  });

  it("买得起的最大件数按没有折扣的价格估算", () => {
    expect(affordableQty(90000, "cross", hijab, P)).toBe(100);
    expect(affordableQty(89999, "cross", hijab, P)).toBe(99);
    // 本土店每件 900 + 80 = 980
    expect(affordableQty(98000, "local", hijab, P)).toBe(100);
    expect(affordableQty(97999, "local", hijab, P)).toBe(99);
    expect(affordableQty(-1, "local", hijab, P)).toBe(0);
  });
});

describe("加急补货（docs/04 第十五节）", () => {
  it("[G04-15#01] 缺 96 件 跨境直发 → 补 100 件，每件 1080，一共 108000，3 天到", () =>
    expect(rushOrder(96, "cross", hijab, P)).toEqual({ qty: 100, unitCostFen: 1080, totalFen: 108000, leadDays: 3 }));
  it("[G04-15#02] 缺 96 件 本土店 → 补 100 件，每件 1260，一共 126000，5 天到", () =>
    expect(rushOrder(96, "local", hijab, P)).toEqual({ qty: 100, unitCostFen: 1260, totalFen: 126000, leadDays: 5 }));
});

describe("随机数和开局安排（docs/04 第四节、第九节）", () => {
  it("dayRng：同样的种子、天、用途，结果相同；换一个就不同", () => {
    expect(dayRng(7, 10, 1).next()).toBe(dayRng(7, 10, 1).next());
    expect(dayRng(7, 10, 1).next()).not.toBe(dayRng(7, 10, 2).next());
    expect(dayRng(7, 10, 1).next()).not.toBe(dayRng(7, 11, 1).next());
    expect(dayRng(7, 10, 1).next()).not.toBe(dayRng(8, 10, 1).next());
  });
  it("roundMilli：整数部分不变，零头按概率进位", () => {
    expect(roundMilli(3000, dayRng(1, 1, 2))).toBe(3);
    let up = 0;
    for (let d = 0; d < 1000; d++) up += roundMilli(2500, dayRng(1, d, 2)) - 2;
    expect(up).toBeGreaterThan(400);
    expect(up).toBeLessThan(600);
  });
  it("marketOfDay：第一年按季节，第二年乘 1.2，波动在 0.85 到 1.15 之间", () => {
    for (let day = 0; day < 720; day += 7) {
      const m = marketOfDay(99, day, hijab, P);
      const q = Math.floor(day / 90);
      const base = applyBp(hijab.seasonBp[q % 4], q >= 4 ? 12000 : 10000);
      expect(m.demandBp).toBeGreaterThanOrEqual(applyBp(base, 8500));
      expect(m.demandBp).toBeLessThanOrEqual(applyBp(base, 11500));
      expect(m.refBidFen).toBe(applyBp(hijab.baseCpcFen, m.competitionBp));
    }
    expect(marketOfDay(99, 0, hijab, P).competitionBp).toBe(12000);
    expect(marketOfDay(99, 360, hijab, P).competitionBp).toBe(14400);
  });
  it("buildSchedule：两次延误、每年 badReviewCount 次差评、第一个季度没有询价单", () => {
    for (const product of products) {
      for (let seed = 1; seed <= 50; seed++) {
        const s = buildSchedule(seed, product, P);
        expect(s).toEqual(buildSchedule(seed, product, P));
        expect(s.delayDays).toHaveLength(2);
        expect(s.delayDays[0]).toBeGreaterThanOrEqual(20);
        expect(s.delayDays[0]).toBeLessThanOrEqual(340);
        expect(s.delayDays[1]).toBeGreaterThanOrEqual(380);
        expect(s.delayDays[1]).toBeLessThanOrEqual(700);
        expect(s.badReviewDays).toHaveLength(2 * product.badReviewCount);
        expect(new Set(s.badReviewDays).size).toBe(s.badReviewDays.length);
        expect(s.inquiries.some((i) => i.quarter === 0)).toBe(false);
        for (let q = 1; q < 8; q++) {
          const list = s.inquiries.filter((i) => i.quarter === q);
          expect(list.length).toBeGreaterThanOrEqual(1);
          expect(list.length).toBeLessThanOrEqual(2);
          list.forEach((inq, idx) => {
            expect(inq.id).toBe(`q${q}-${idx + 1}`);
            expect(inq.dueDay).toBeGreaterThanOrEqual(q * 90 + 40);
            expect(inq.dueDay).toBeLessThanOrEqual(q * 90 + 80);
            expect(inq.qty % 10).toBe(0);
            expect(inq.qty).toBeGreaterThanOrEqual(10);
          });
        }
      }
    }
  });
});

describe("商品的文案", () => {
  it("每种商品在 src/text 里都有名字、介绍、要小心的地方", async () => {
    const { zh } = await import("../src/text/zh");
    for (const p of products) {
      const t = zh.products[p.id];
      expect(t?.name, p.id).toBeTruthy();
      expect(t?.intro, p.id).toBeTruthy();
      expect(t?.caution, p.id).toBeTruthy();
    }
  });
});

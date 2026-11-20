// 任务 06 第三步：界面的每个动作和取数（docs/12 第四节）。动作都是纯函数，不用打开页面就能测。
import { describe, expect, it } from "vitest";
import { malaysia as P } from "../src/params/malaysia";
import { getProduct } from "../src/products/catalog";
import { verifyQuarter } from "../src/engine/bills";
import { defaultFirstStock } from "../src/plan/setup";
import { initialUi, type UiState } from "../src/ui/store/state";
import {
  allConfirmed,
  autoConfirmed,
  backHome,
  closePopup,
  nextCoach,
  openDesk,
  openPopup,
  openShop,
  pickFulfillment,
  pickProduct,
  runQuarter,
  setDecision,
  setFirstStock,
  startNewGame,
  startQuarterPlay,
} from "../src/ui/store/actions";
import { canProceed, planOf, statusOf, timelineOf, worldViewOf } from "../src/ui/store/selectors";

const hijab = getProduct("hijab");

/** 首页 → 开局（头巾、跨境直发、默认件数）→ 开店 */
function opened(seed = 11, fulfillment: "cross" | "local" = "cross"): UiState {
  return openShop(pickFulfillment(pickProduct(startNewGame(initialUi(), seed), "hijab"), fulfillment));
}

/** 三个功能区都定好（用参考价、补货 200 件） */
function decided(ui: UiState): UiState {
  let u = setDecision(ui, "purchase", { monthlyRestockQty: 200 });
  u = setDecision(u, "ops", { priceSen: hijab.refPriceSen });
  return setDecision(u, "finance", {});
}

describe("首页和开局", () => {
  it("startNewGame：进入开局，带上种子，其他全部清空", () => {
    const old = { ...initialUi(), stage: "decide" as const, decisions: [opened().decision] };
    const u = startNewGame(old, 42);
    expect(u.stage).toBe("setup");
    expect(u.seed).toBe(42);
    expect(u.decisions).toEqual([]);
    expect(u.game).toBeNull();
  });
  it("pickProduct、pickFulfillment：两样都选了才给第一批进货的默认值，换发货方式时重算", () => {
    const a = pickProduct(startNewGame(initialUi(), 1), "hijab");
    expect(a.setup.productId).toBe("hijab");
    expect(a.setup.firstStockQty).toBe(0);
    const b = pickFulfillment(a, "cross");
    expect(b.setup.firstStockQty).toBe(defaultFirstStock(P.startCashFen.value, "cross", hijab, P));
    const c = pickFulfillment(b, "local");
    expect(c.setup.firstStockQty).toBe(defaultFirstStock(P.startCashFen.value, "local", hijab, P));
  });
  it("setFirstStock：只改件数", () => {
    const u = setFirstStock(pickFulfillment(pickProduct(startNewGame(initialUi(), 1), "hijab"), "cross"), 120);
    expect(u.setup.firstStockQty).toBe(120);
    expect(u.setup.productId).toBe("hijab");
  });
  it("backHome：回到首页，关掉弹窗", () => {
    const u = backHome(openPopup(opened(), "stock"));
    expect(u.stage).toBe("home");
    expect(u.popup).toBeNull();
  });
  it("openShop：没选完会报错；选完进入第 1 个季度的做决定", () => {
    expect(() => openShop(startNewGame(initialUi(), 1))).toThrow();
    const u = opened();
    expect(u.stage).toBe("decide");
    expect(u.game?.day).toBe(0);
    expect(u.coachStep).toBe(1);
    // 第 1 个季度：财务区"以后会用到"，自动算定了；进货和运营要自己定
    expect(u.confirmed).toEqual({ purchase: false, ops: false, finance: true });
    expect(u.carried).toEqual({ purchase: false, ops: false, finance: false });
    expect(u.decision.priceSen).toBe(hijab.refPriceSen);
  });
});

describe("做决定", () => {
  it("autoConfirmed：只有第 1 个季度的财务区", () => {
    const u = opened();
    expect(autoConfirmed(u.game!)).toEqual(["finance"]);
    expect(autoConfirmed({ ...u.game!, day: 90 })).toEqual([]);
  });
  it("setDecision：改值、标成已定、不再是沿用、关掉弹窗", () => {
    const u = setDecision(openPopup(opened(), "stock"), "purchase", { monthlyRestockQty: 300 });
    expect(u.decision.monthlyRestockQty).toBe(300);
    expect(u.confirmed.purchase).toBe(true);
    expect(u.carried.purchase).toBe(false);
    expect(u.popup).toBeNull();
  });
  it("allConfirmed、canProceed：三个功能区都定了才能点主要按钮", () => {
    const u = opened();
    expect(allConfirmed(u)).toBe(false);
    expect(canProceed(u)).toBe(false);
    const d = decided(u);
    expect(allConfirmed(d)).toBe(true);
    expect(canProceed(d)).toBe(true);
  });
  it("openPopup、closePopup、openDesk", () => {
    const u = openPopup(opened(), "retail");
    expect(u.popup).toBe("retail");
    expect(closePopup(u).popup).toBeNull();
    const d = openDesk(u, "finance");
    expect(d.popup).toBe("desk");
    expect(d.deskArea).toBe("finance");
  });
  it("nextCoach：1 → 2 → 3 → 关掉", () => {
    const u = opened();
    expect(nextCoach(u).coachStep).toBe(2);
    expect(nextCoach(nextCoach(u)).coachStep).toBe(3);
    expect(nextCoach(nextCoach(nextCoach(u))).coachStep).toBe(0);
  });
  it("planOf：现金计划跟着这个季度的决定变", () => {
    const u = opened();
    const a = planOf(u)!;
    const b = planOf(setDecision(u, "purchase", { monthlyRestockQty: 200 }))!;
    expect(b.restockFen - a.restockFen).toBe(3 * 200 * hijab.costFen);
    expect(b.worstEndFen).toBe(b.startFen + b.sureInFen - b.sureOutFen - b.adsMaxFen);
  });
});

describe("过一个季度", () => {
  it("runQuarter：没定完会报错；定完算到第 90 天，每天的现金都记下来", () => {
    expect(() => runQuarter(opened())).toThrow();
    const run = runQuarter(decided(opened()));
    expect(run.game.day).toBe(90);
    expect(run.cashByDay.length).toBe(run.eventsByDay.length);
    expect(run.cashByDay[run.cashByDay.length - 1]).toBe(run.game.cashFen);
    expect(run.decision.bulkShortChoices).toEqual([]);
  });
  it("startQuarterPlay：直接进入下一个季度的做决定，三个功能区沿用上个季度", () => {
    const u = startQuarterPlay(decided(opened()));
    expect(u.stage).toBe("decide");
    expect(timelineOf(u).quarter).toBe(1);
    expect(u.decisions).toHaveLength(1);
    expect(u.history).toHaveLength(1);
    expect(u.carried).toEqual({ purchase: true, ops: true, finance: true });
    expect(u.confirmed).toEqual({ purchase: true, ops: true, finance: true });
    expect(u.decision.monthlyRestockQty).toBe(200);
    expect(u.decision.priceSen).toBe(hijab.refPriceSen);
    // 大单和合规、升级不沿用
    expect(u.decision.bulkQuotes).toEqual([]);
    expect(u.decision.upgradeToLocal).toBe(false);
    // 账单能对上：季初 + 收入 − 支出 = 季末
    const h = u.history[0];
    expect(verifyQuarter(h.startCashFen, u.bills[0], h.endCashFen)).toBe(true);
  });
  it("能从首页一路点到第 8 个季度结束（两种发货方式，几个种子）", () => {
    for (const [seed, f] of [[3, "cross"], [8, "local"], [21, "cross"]] as const) {
      let u = decided(opened(seed, f));
      let guard = 0;
      while (u.stage === "decide" && guard < 10) {
        u = startQuarterPlay(u);
        guard++;
      }
      expect(u.stage).toBe("ending");
      expect(["finished", "bankrupt", "banned"]).toContain(u.game?.phase);
      // 每一个季度都有账单，并且都对得上
      u.history.forEach((h, i) => expect(verifyQuarter(h.startCashFen, u.bills[i], h.endCashFen)).toBe(true));
    }
  });
});

describe("取数", () => {
  it("timelineOf：季度、年、季节", () => {
    expect(timelineOf(initialUi())).toEqual({ quarter: 0, year: 0, season: 0 });
    const u = opened();
    expect(timelineOf({ ...u, game: { ...u.game!, day: 450 } })).toEqual({ quarter: 5, year: 1, season: 1 });
    expect(timelineOf({ ...u, game: { ...u.game!, day: 800 } })).toEqual({ quarter: 7, year: 1, season: 3 });
  });
  it("statusOf：跨境店没有风险等级，本土店有；第 1 个季度没有推流分的变化", () => {
    expect(statusOf(initialUi())).toBeNull();
    expect(statusOf(opened(11, "cross"))?.risk).toBeNull();
    expect(statusOf(opened(11, "local"))?.risk).toBe("low");
    expect(statusOf(opened())?.pushDelta).toBeNull();
    expect(typeof statusOf(startQuarterPlay(decided(opened())))?.pushDelta).toBe("number");
  });
  it("worldViewOf：发货方式和季节跟着游戏的状态", () => {
    const u = opened(11, "local");
    expect(worldViewOf(u).fulfillment).toBe("local");
    expect(worldViewOf(u).season).toBe(0);
    expect(worldViewOf(startQuarterPlay(decided(u))).season).toBe(1);
  });
});

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
  answerBulkShort,
  confirmBill,
  declareBankruptcy,
  nextQuarter,
  playQuarterThrough,
  seeResult,
  skipPlay,
  tickPlay,
  setDecision,
  setFirstStock,
  startNewGame,
  startQuarterPlay,
} from "../src/ui/store/actions";
import { keyDecisionRun } from "../src/plan/keyDecision";
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

describe("过一个季度：播放和结算（任务 07）", () => {
  it("startQuarterPlay：没定完不动；定完开始播放，模型先算到停下的地方", () => {
    const o = opened();
    expect(startQuarterPlay(o)).toBe(o);
    const u = startQuarterPlay(decided(opened()));
    expect(u.stage).toBe("play");
    expect(u.playIndex).toBe(0);
    expect(u.play?.days.length).toBeGreaterThan(80);
    expect(u.game).toBe(decided(opened()).game === null ? null : u.play?.startState);
  });
  it("tickPlay：一天一天放，界面上的状态就是那一天的；放完自动结算，打开季度报表", () => {
    let u = startQuarterPlay(decided(opened()));
    u = tickPlay(u, 10);
    expect(u.playIndex).toBe(10);
    expect(u.game).toBe(u.play?.days[9].state);
    u = skipPlay(u);
    expect(u.stage).toBe("settle");
    expect(u.popup).toBe("bill");
    expect(u.report?.verified).toBe(true);
    expect(u.report?.verdict).toBe("continue");
    expect(u.game?.day).toBe(90);
    // 结算时时间线和季节还停在刚放完的那个季度
    expect(timelineOf(u).quarter).toBe(0);
    expect(u.history).toHaveLength(1);
    expect(verifyQuarter(u.history[0].startCashFen, u.bills[0], u.history[0].endCashFen)).toBe(true);
  });
  it("没确认报表时 nextQuarter 无效；确认之后进入下一个季度，三个功能区沿用上个季度", () => {
    const s = skipPlay(startQuarterPlay(decided(opened())));
    expect(nextQuarter(s)).toBe(s);
    const c = confirmBill(s);
    expect(c.billConfirmed).toBe(true);
    expect(c.popup).toBeNull();
    const u = nextQuarter(c);
    expect(u.stage).toBe("decide");
    expect(timelineOf(u).quarter).toBe(1);
    expect(u.carried).toEqual({ purchase: true, ops: true, finance: true });
    expect(u.decision.monthlyRestockQty).toBe(200);
    expect(u.decision.bulkQuotes).toEqual([]);
    expect(u.decision.upgradeToLocal).toBe(false);
  });
  it("结论是 bankrupt 时只能 declareBankruptcy：确认报表、进入下一个季度都无效", () => {
    // 补满供应商上限、广告开到最大，第一个季度季末付不起
    let u = opened(5, "cross");
    u = setDecision(u, "purchase", { monthlyRestockQty: hijab.supplierMonthlyCap });
    u = setDecision(u, "ops", { priceSen: hijab.minPriceSen, adBidFen: 200, adDailyBudgetFen: 20000 });
    u = setDecision(u, "finance", {});
    const s = skipPlay(startQuarterPlay(u));
    expect(s.report?.verdict).toBe("bankrupt");
    expect(confirmBill(s)).toBe(s);
    expect(nextQuarter(s)).toBe(s);
    expect(seeResult(s)).toBe(s);
    const e = declareBankruptcy(s);
    expect(e.stage).toBe("ending");
    expect(e.game?.phase).toBe("bankrupt");
  });
  it("播放遇到大单货不够会停下，打开 P9；回答之后接着往下放，选择记进这个季度的决定", () => {
    const found = findPending();
    expect(found).not.toBeNull();
    if (!found) return;
    let u = skipPlay(found);
    expect(u.stage).toBe("play");
    expect(u.popup).toBe("bulkShort");
    expect(u.game?.pending).not.toBeNull();
    const id = u.game?.pending?.inquiryId;
    // 弹窗开着时播放不往前走
    expect(tickPlay(u, 5)).toBe(u);
    u = answerBulkShort(u, "rush");
    expect(u.popup).toBeNull();
    expect(u.play?.decision.bulkShortChoices).toContainEqual({ inquiryId: id, choice: "rush" });
    for (let i = 0; i < 10 && u.stage === "play"; i++) u = u.popup === "bulkShort" ? answerBulkShort(u, "ignore") : skipPlay(u);
    expect(u.stage).toBe("settle");
    expect(u.report?.verified).toBe(true);
  });
  it("能从首页一路点到结局；把实际做过的决定（含季度中间的选择）重放一遍，结果完全一样", () => {
    for (const [seed, f] of [[3, "cross"], [8, "local"], [21, "cross"]] as const) {
      let u = withQuotes(decided(opened(seed, f)));
      for (let guard = 0; guard < 12 && u.stage === "decide"; guard++) u = playQuarterThrough(withQuotes(u), () => "rush");
      expect(u.stage).toBe("ending");
      expect(["finished", "bankrupt", "banned"]).toContain(u.game?.phase);
      u.history.forEach((h, i) => expect(verifyQuarter(h.startCashFen, u.bills[i], h.endCashFen)).toBe(true));
      const replayed = keyDecisionRun(u.game!.config, u.decisions, getProduct(u.game!.config.productId), P, null);
      expect(replayed).toEqual(u.game);
    }
  });
});

/** 给这个季度的每张询价单报参考价的八成（比对手低，能中标，让大单出现） */
function withQuotes(ui: UiState): UiState {
  if (ui.stage !== "decide" || !ui.game) return ui;
  const q = Math.floor(ui.game.day / 90);
  const product = getProduct(ui.game.config.productId);
  const quotes = ui.game.schedule.inquiries.filter((i) => i.quarter === q).map((i) => ({ inquiryId: i.id, unitPriceSen: Math.floor((product.bulkRefPriceSen * 8) / 10) }));
  return quotes.length > 0 ? setDecision(ui, "ops", { ...ui.decision, bulkQuotes: quotes }) : ui;
}

/** 找一局：报了大单、补货很少，播放时会停在大单货不够 */
function findPending(): UiState | null {
  for (let seed = 1; seed < 80; seed++) {
    let u = decided(opened(seed, "cross"));
    for (let q = 0; q < 6 && u.stage === "decide"; q++) {
      const quoted = setDecision(withQuotes(decided(u)), "purchase", { monthlyRestockQty: 0 });
      const started = startQuarterPlay(quoted);
      if (started.play?.stoppedAt === "pending") return started;
      u = playQuarterThrough(withQuotes(u));
    }
  }
  return null;
}

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
    expect(typeof statusOf(playQuarterThrough(decided(opened())))?.pushDelta).toBe("number");
  });
  it("worldViewOf：发货方式和季节跟着游戏的状态", () => {
    const u = opened(11, "local");
    expect(worldViewOf(u).fulfillment).toBe("local");
    expect(worldViewOf(u).season).toBe(0);
    expect(worldViewOf(playQuarterThrough(decided(u))).season).toBe(1);
  });
});

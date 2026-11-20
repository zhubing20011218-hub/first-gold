// ?demo= 的固定状态（docs/09 第九节）：种子固定，全部用 actions 和模型一步一步算出来，不手写假数据。
import * as A from "../store/actions";
import { financeOf, referenceOf } from "../store/selectors";
import { getProduct } from "../../products/catalog";
import { initialUi, type UiState } from "../store/state";

const SEED = 20261120;

function shop(): UiState {
  let ui = A.startNewGame(initialUi(), SEED);
  ui = A.pickProduct(ui, "hijab");
  ui = A.pickFulfillment(ui, "local");
  return A.openShop(ui);
}

/** 这个季度的固定决定 */
function decide(ui: UiState, q: number): UiState {
  let u = A.setDecision(ui, "purchase", { monthlyRestockQty: 150 });
  u = A.setDecision(u, "ops", { priceSen: 1990, adBidFen: 30, adDailyBudgetFen: 3000, bulkQuotes: [] });
  return A.setDecision(u, "finance", { buyCompliance: q > 0 });
}

/** 用固定的决定往前走 n 个季度（每个季度都放完、确认报表），停在第 n 个季度的做决定 */
function quarters(n: number): UiState {
  let ui = shop();
  for (let q = 0; q < n && ui.stage === "decide"; q++) ui = A.playQuarterThrough(decide(ui, q));
  return ui;
}

/** 停住的播放：截图每次一样 */
function paused(ui: UiState): UiState {
  return { ...ui, playPaused: true };
}

/** 第 3 个季度放到第 37 天 */
function playing(): UiState {
  return paused(A.tickPlay(A.startQuarterPlay(decide(quarters(3), 3)), 37));
}

/** 第 3 个季度放完，打开季度报表 */
function settled(): UiState {
  return A.skipPlay(A.startQuarterPlay(decide(quarters(3), 3)));
}

/** 季末付不起：补满供应商上限、广告开到最大 */
function bankruptSettle(): UiState {
  let ui = shop();
  ui = A.setDecision(ui, "purchase", { monthlyRestockQty: 800 });
  ui = A.setDecision(ui, "ops", { priceSen: ui.game?.priceSen ?? 1990, adBidFen: 200, adDailyBudgetFen: 20000, bulkQuotes: [] });
  ui = A.setDecision(ui, "finance", {});
  return A.skipPlay(A.startQuarterPlay(ui));
}

/** 大单货不够：第 2 个季度报低价拿下询价单、不补货，放到停下的那一天 */
function bulkShort(): UiState {
  let ui = quarters(1);
  const g = ui.game;
  if (!g) return ui;
  const quotes = g.schedule.inquiries.filter((i) => i.quarter === 1).map((i) => ({ inquiryId: i.id, unitPriceSen: 840 }));
  ui = decide(ui, 1);
  ui = A.setDecision(ui, "ops", { ...ui.decision, bulkQuotes: quotes });
  ui = A.setDecision(ui, "purchase", { monthlyRestockQty: 0 });
  return A.skipPlay(A.startQuarterPlay(ui));
}

/** 用一种打法把一整局玩完（四种结局的演示用），全部走 actions，大单货不够时加急 */
function wholeGame(productId: string, f: "cross" | "local", seed: number, style: "balanced" | "reference"): UiState {
  let u = A.openShop(A.pickFulfillment(A.pickProduct(A.startNewGame(initialUi(), seed), productId), f));
  const pr = getProduct(productId);
  for (let guard = 0; guard < 10 && u.stage === "decide"; guard++) {
    const ref = referenceOf(u);
    const g = u.game;
    if (!ref || !g) break;
    const q = Math.floor(g.day / 90);
    const want = Math.min(pr.supplierMonthlyCap, Math.max(pr.moq, Math.ceil((ref.expMonthly * (style === "balanced" ? 12 : 10)) / 100) * 10));
    if (style === "balanced") {
      u = A.setDecision(u, "purchase", { monthlyRestockQty: want });
      const quotes = g.schedule.inquiries.filter((i) => i.quarter === q && i.qty <= g.stockQty + want).map((i) => ({ inquiryId: i.id, unitPriceSen: pr.bulkRefPriceSen }));
      u = A.setDecision(u, "ops", { priceSen: pr.refPriceSen, adBidFen: Math.floor((ref.refBidFen * 8) / 10), adDailyBudgetFen: 3000, bulkQuotes: quotes });
      u = A.setDecision(u, "finance", { buyCompliance: f === "local" && financeOf(u)?.risk !== "low" });
    } else {
      u = A.setDecision(u, "purchase", { monthlyRestockQty: ref.expMonthly === 0 ? 0 : want });
      u = A.setDecision(u, "ops", { priceSen: pr.refPriceSen, adBidFen: 0, adDailyBudgetFen: 0, bulkQuotes: [] });
      u = A.setDecision(u, "finance", {});
    }
    u = A.playQuarterThrough(u, () => "rush");
  }
  return u;
}

export function demoState(name: string): UiState | null {
  switch (name) {
    case "home":
      return initialUi();
    case "setup": {
      let ui = A.startNewGame(initialUi(), SEED);
      ui = A.pickProduct(ui, "hijab");
      return A.pickFulfillment(ui, "local");
    }
    case "decide":
      return quarters(3);
    case "popup-stock":
      return A.openPopup(quarters(3), "stock");
    case "popup-retail":
      return A.openPopup(quarters(3), "retail");
    case "popup-bulk":
      return A.openPopup(quarters(3), "bulk");
    case "popup-risk":
      return A.openPopup(quarters(3), "risk");
    case "popup-push":
      return A.openPopup(quarters(3), "push");
    case "popup-source":
      return A.openPopup(quarters(3), "source");
    case "play":
      return playing();
    case "settle":
    case "popup-bill":
      return settled();
    case "settle-bankrupt":
      return bankruptSettle();
    case "popup-desk":
      return A.openDesk(quarters(3), "purchase");
    case "popup-bulkshort":
      return bulkShort();
    case "ending-goal":
      return wholeGame("arm_sleeve", "cross", 2, "balanced");
    case "ending-survive":
      return wholeGame("hijab", "cross", 1, "reference");
    case "ending-banned":
      return wholeGame("phone_case", "local", 1, "reference");
    case "ending-bankrupt":
      return A.declareBankruptcy(bankruptSettle());
    case "panel":
      return A.openPopup(quarters(3), "source");
    case "season-0":
    case "season-1":
    case "season-2":
    case "season-3":
      return quarters(Number(name.slice(-1)));
    default:
      return null;
  }
}

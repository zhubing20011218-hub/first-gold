// ?demo= 的固定状态（docs/09 第九节）：种子固定，全部用 actions 和模型一步一步算出来，不手写假数据。
import * as A from "../store/actions";
import { initialUi, type UiState } from "../store/state";

const SEED = 20261120;

function shop(): UiState {
  let ui = A.startNewGame(initialUi(), SEED);
  ui = A.pickProduct(ui, "hijab");
  ui = A.pickFulfillment(ui, "local");
  return A.openShop(ui);
}

/** 用固定的决定往前走 n 个季度，停在第 n 个季度的做决定 */
function quarters(n: number): UiState {
  let ui = shop();
  for (let q = 0; q < n && ui.stage === "decide"; q++) {
    ui = A.setDecision(ui, "purchase", { monthlyRestockQty: 150 });
    ui = A.setDecision(ui, "ops", { priceSen: 1990, adBidFen: 30, adDailyBudgetFen: 3000, bulkQuotes: [] });
    ui = A.setDecision(ui, "finance", { buyCompliance: q > 0 });
    ui = A.startQuarterPlay(ui);
  }
  return ui;
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
    case "season-0":
    case "season-1":
    case "season-2":
    case "season-3":
      return quarters(Number(name.slice(-1)));
    default:
      return null;
  }
}

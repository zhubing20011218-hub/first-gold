// P2 零售：售价和广告（docs/09 第四节）
import { useState } from "react";
import { Stepper } from "../components/base/Stepper";
import { Explain } from "../components/base/Explain";
import { useStore } from "../store/store";
import { params as P, productOf, referenceOf, checkBid, checkBudget, checkPrice, formatRM, formatYuan, rmToSen, yuanToFen } from "../store/selectors";
import { zh } from "../../text/zh";
import { DecisionShell, errorText } from "../components/biz/DecisionShell";

export function RetailPopup() {
  const ui = useStore();
  const product = productOf(ui);
  const ref = referenceOf(ui);
  const [price, setPrice] = useState(ui.decision.priceSen / 100);
  const [bid, setBid] = useState(ui.decision.adBidFen / 100);
  const [budget, setBudget] = useState(ui.decision.adDailyBudgetFen / 100);
  if (!product || !ref || !ui.game) return null;
  const priceSen = rmToSen(price);
  const bidFen = yuanToFen(bid);
  const budgetFen = yuanToFen(budget);
  const checks = [checkPrice(priceSen, product, P), checkBid(bidFen, ui.game, product, P), checkBudget(budgetFen)];
  return (
    <DecisionShell name="retail" area="ops" draft={{ priceSen, adBidFen: bidFen, adDailyBudgetFen: budgetFen }} checks={checks}>
      <p className="text-body text-muted">
        {zh.area.refPrice} {formatRM(ref.refPriceSen)}
        {zh.dot}
        <Explain text={zh.explain.rivalBid}>{`${zh.area.rivalBid} ${formatYuan(ref.refBidFen)}`}</Explain>
      </p>
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <Stepper label={zh.popups.price} value={price} step={1} decimals={2} unit={zh.input.rm} error={errorText(checks[0])} onChange={setPrice} />
        <Stepper label={zh.popups.bid} value={bid} step={0.01} decimals={2} unit={zh.input.yuan} error={errorText(checks[1])} onChange={setBid} />
        <Stepper label={zh.popups.budget} value={budget} step={10} decimals={0} unit={zh.input.yuan} error={errorText(checks[2])} onChange={setBudget} />
      </div>
    </DecisionShell>
  );
}

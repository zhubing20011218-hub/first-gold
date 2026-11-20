// P1 进货：每月补货量（docs/09 第四节）
import { useState } from "react";
import { Stepper } from "../components/base/Stepper";
import { Explain } from "../components/base/Explain";
import { useStore } from "../store/store";
import { productOf, referenceOf, checkRestock } from "../store/selectors";
import { zh } from "../../text/zh";
import { DecisionShell, errorText } from "../components/biz/DecisionShell";

export function StockPopup() {
  const ui = useStore();
  const product = productOf(ui);
  const ref = referenceOf(ui);
  const [qty, setQty] = useState(ui.decision.monthlyRestockQty);
  if (!product || !ref) return null;
  const check = checkRestock(qty, product);
  return (
    <DecisionShell name="stock" area="purchase" draft={{ monthlyRestockQty: qty }} checks={[check]}>
      <p className="text-body text-muted">
        <Explain text={zh.explain.expMonthly}>{zh.area.expMonthly(String(ref.expMonthly))}</Explain>
        {zh.dot}
        {zh.area.stockDays(String(ref.stockDays))}
        {zh.dot}
        {zh.popups.tiers(String(ref.tierQty[0]), String(ref.tierQty[1]))}
      </p>
      <Stepper label={zh.popups.restockQty} value={qty} step={10} unit={zh.input.piece} error={errorText(check)} onChange={setQty} />
    </DecisionShell>
  );
}

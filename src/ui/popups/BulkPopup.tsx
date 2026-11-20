// P3 大单：对这个季度的询价单报价（docs/09 第四节）
import { useState } from "react";
import { Stepper } from "../components/base/Stepper";
import { Segmented } from "../components/base/Segmented";
import { Explain } from "../components/base/Explain";
import { useStore } from "../store/store";
import { inquiriesOf, params as P, productOf, checkQuote, formatRM, rmToSen } from "../store/selectors";
import { zh } from "../../text/zh";
import { DecisionShell } from "../components/biz/DecisionShell";

export function BulkPopup() {
  const ui = useStore();
  const product = productOf(ui);
  const items = inquiriesOf(ui);
  const [quotes, setQuotes] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(items.map((i) => [i.id, (ui.decision.bulkQuotes.find((b) => b.inquiryId === i.id)?.unitPriceSen ?? null) as number | null])),
  );
  if (!product || !ui.game) return null;
  const game = ui.game;
  const checks = items
    .filter((i) => quotes[i.id] !== null && quotes[i.id] !== undefined)
    .map((i) => checkQuote(i.id, quotes[i.id] ?? 0, ui.decision.monthlyRestockQty, game, product, P));
  const draft = {
    bulkQuotes: items.filter((i) => quotes[i.id] !== null && quotes[i.id] !== undefined).map((i) => ({ inquiryId: i.id, unitPriceSen: quotes[i.id] ?? 0 })),
  };
  return (
    <DecisionShell name="bulk" area="ops" draft={draft} checks={checks}>
      <p className="text-body text-muted">
        <Explain text={zh.explain.bulkRef}>{`${zh.inquiry.refPrice} ${formatRM(product.bulkRefPriceSen)}`}</Explain>
      </p>
      {items.map((i) => {
        const v = quotes[i.id];
        return (
          <div key={i.id} className="flex flex-col gap-2 rounded-control border-2 border-line p-3">
            <div className="flex items-baseline justify-between">
              <span className="num text-title font-bold">
                {i.qty} <span className="font-sans text-cap text-muted">{zh.inquiry.piece}</span>
              </span>
              <span className="text-cap text-muted">{zh.inquiry.due(i.dueDay)}</span>
            </div>
            <Segmented
              label={zh.popups.quote}
              value={v === null || v === undefined ? "no" : "yes"}
              onChange={(x) => setQuotes({ ...quotes, [i.id]: x === "no" ? null : product.bulkRefPriceSen })}
              options={[
                { value: "no", label: zh.popups.quoteNo },
                { value: "yes", label: zh.popups.quoteYes },
              ]}
            />
            {v !== null && v !== undefined && (
              <Stepper label={zh.popups.quote} value={v / 100} step={0.1} decimals={2} unit={zh.input.rm} onChange={(x) => setQuotes({ ...quotes, [i.id]: rmToSen(x) })} />
            )}
          </div>
        );
      })}
    </DecisionShell>
  );
}
